import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { content, ContentRegistry, PACKS } from '../src/content/registry'
import type { ContentPack } from '../src/content/types'
import { FilizDB } from '../src/data/db'
import { Repository } from '../src/data/repo'
import { memoryStore, SessionManager } from '../src/data/session'
import { checkClosedAnswer, localEvaluate, parseRemoteEvaluation, type Evaluator } from '../src/domain/evaluation'
import { computeNewBudget } from '../src/domain/planner'
import {
  computeProgress,
  getTodayPlan,
  prepareAnswer,
  processPending,
  submitClosed,
  submitProduction,
} from '../src/domain/services'
import { freshRepo, snapshot } from './helpers'

const DAY = 24 * 3600_000

describe('Kabul 1 — İlerleme yeniden başlatmadan sonra korunur', () => {
  it('veritabanı kapatılıp yeniden açılınca tekrar durumu, cevaplar ve ders konumu yerinde', async () => {
    const name = `persist-${Date.now()}`
    const repo = freshRepo(name)
    await repo.recordReview({ lang: 'ru', senseId: 'ru-apple', skill: 'write', grade: 3, source: 'lesson' })
    await repo.saveLessonState({ lang: 'ru', lessonId: 'ru-core-1', track: 'core', status: 'in-progress', step: 5 })
    await repo.addAttempt({ lang: 'ru', senseIds: ['ru-apple'], exerciseType: 'type-word', skill: 'write', context: 'core', taskMode: 'closed', prompt: 'x', inputMode: 'keyboard', hintsUsed: 0, evalStatus: 'local', finalText: 'яблоко' })
    repo.db.close()

    const reopened = new Repository(new FilizDB(name), 'device-A', 'owner')
    const skill = await reopened.getSkill('ru-apple', 'write')
    expect(skill?.card.reps).toBe(1)
    expect((await reopened.getLessonState('ru', 'ru-core-1'))?.step).toBe(5)
    expect(await reopened.attemptsForLang('ru')).toHaveLength(1)
    expect(skill?.card.dueAt).toBeInstanceOf(Date)
  })
})

describe('Kabul 2 — Öğrenme kayıtları hedef dillere göre ayrı', () => {
  it('Rusça kayıtlar İngilizce sorgularında görünmez', async () => {
    const repo = freshRepo()
    await repo.recordReview({ lang: 'ru', senseId: 'ru-apple', skill: 'recognizeText', grade: 3, source: 'lesson' })
    await repo.recordReview({ lang: 'en', senseId: 'en-apple', skill: 'recognizeText', grade: 1, source: 'lesson' })
    expect((await repo.skillsForLang('ru')).map((s) => s.senseId)).toEqual(['ru-apple'])
    expect((await repo.skillsForLang('en')).map((s) => s.senseId)).toEqual(['en-apple'])
    const ruProgress = await computeProgress(repo, 'ru')
    const enProgress = await computeProgress(repo, 'en')
    expect(ruProgress.core.introduced).toBe(1)
    expect(enProgress.core.introduced).toBe(1)
    expect((await repo.reviewsForLang('ru')).every((r) => r.lang === 'ru')).toBe(true)
  })
})

describe('Kabul 3 — Sektör ilerlemesi genel seviyeden ayrı', () => {
  it('iyi genel İngilizce, tekstil terimlerini atlatmaz; tekstil ilerlemesi ayrı hesaplanır', async () => {
    const repo = freshRepo()
    for (const id of content.coreSenseOrder('en')) {
      await repo.recordReview({ lang: 'en', senseId: id, skill: 'recognizeText', grade: 4, source: 'placement' })
    }
    const p1 = await computeProgress(repo, 'en')
    expect(p1.core.introduced).toBe(p1.core.total)
    const textile = p1.industries.find((i) => i.industryId === 'textile')!
    expect(textile.total).toBeGreaterThan(0)
    expect(textile.introduced).toBe(0) // genel seviye tekstili "öğrenilmiş" yapmaz
    // Tekstil dersi baştan başlayabilir
    expect(content.industryLessons('en', 'textile')[0].order).toBe(1)

    await repo.ensureIndustryTrack('en', 'textile')
    await repo.recordReview({ lang: 'en', senseId: 'en-tx-fabric', skill: 'recognizeText', grade: 3, source: 'lesson' })
    const p2 = await computeProgress(repo, 'en')
    expect(p2.industries.find((i) => i.industryId === 'textile')!.introduced).toBe(1)
    expect(p2.core.introduced).toBe(p1.core.introduced) // genel ilerleme değişmedi
  })
})

describe('Kabul 4 — Tekrar zamanı kaydedilen performansa göre belirlenir', () => {
  it('"İyi" puanı "Hatırlamadım"dan daha geç tekrar planlar; başarılı tekrarlar aralığı açar; unutma aralığı kısaltır', async () => {
    const repo = freshRepo()
    const t0 = new Date('2026-11-01T10:00:00Z')
    const good = await repo.recordReview({ lang: 'ru', senseId: 'ru-water', skill: 'write', grade: 3, source: 'lesson', now: t0 })
    const again = await repo.recordReview({ lang: 'ru', senseId: 'ru-milk', skill: 'write', grade: 1, source: 'lesson', now: t0 })
    expect(good.due).toBeGreaterThan(again.due)
    expect(again.due - t0.getTime()).toBeLessThan(DAY)

    const second = await repo.recordReview({ lang: 'ru', senseId: 'ru-water', skill: 'write', grade: 3, source: 'review', now: new Date(good.due) })
    const firstInterval = good.due - t0.getTime()
    const secondInterval = second.due - good.due
    expect(secondInterval).toBeGreaterThan(firstInterval)

    const lapse = await repo.recordReview({ lang: 'ru', senseId: 'ru-water', skill: 'write', grade: 1, source: 'review', now: new Date(second.due) })
    expect(lapse.due - second.due).toBeLessThan(secondInterval)
    expect(lapse.card.lapses).toBe(1)
    // Her tekrar ayrı kaydedilir (önce/sonra zamanlarıyla)
    expect((await repo.reviewsForLang('ru')).filter((r) => r.senseId === 'ru-water')).toHaveLength(3)
  })

  it('aynı kelimenin becerileri ayrı izlenir (tek bir "öğrenildi" bayrağı yok)', async () => {
    const repo = freshRepo()
    await repo.recordReview({ lang: 'ru', senseId: 'ru-cat', skill: 'recognizeText', grade: 4, source: 'lesson' })
    await repo.recordReview({ lang: 'ru', senseId: 'ru-cat', skill: 'write', grade: 1, source: 'lesson' })
    const read = await repo.getSkill('ru-cat', 'recognizeText')
    const write = await repo.getSkill('ru-cat', 'write')
    expect(read!.due).toBeGreaterThan(write!.due)
  })

  it('yeni öğe sayısı tekrar yüküne göre azalır, Günün Kelimesi korunur', () => {
    expect(computeNewBudget({ dailyMinutes: 15, newPerDay: 5, dueCount: 0 }).newCount).toBe(5)
    expect(computeNewBudget({ dailyMinutes: 15, newPerDay: 5, dueCount: 60 }).newCount).toBeLessThan(5)
    expect(computeNewBudget({ dailyMinutes: 15, newPerDay: 5, dueCount: 200 }).newCount).toBe(1)
  })
})

describe('Kabul 5 — Geçerli alternatif cümleler kabul edilir; dilbilgisi ve görev anlamı ayrı raporlanır', () => {
  it('kapalı cevapta kabul edilen tüm biçimler doğru sayılır; Rusça ё/е ve vurgu işareti fark yaratmaz', () => {
    expect(checkClosedAnswer('Thank you', ['thank you', 'thanks'], 'en').correct).toBe(true)
    expect(checkClosedAnswer('thanks', ['thank you', 'thanks'], 'en').correct).toBe(true)
    expect(checkClosedAnswer('молоко́', ['молоко'], 'ru').correct).toBe(true)
    // Türkçe büyük/küçük harf kuralı: İ → i, I → ı
    expect(checkClosedAnswer('İSTANBUL', ['istanbul'], 'tr').correct).toBe(true)
    expect(checkClosedAnswer('ISTANBUL', ['istanbul'], 'tr').correct).toBe(false)
    const typo = checkClosedAnswer('собока', ['собака'], 'ru')
    expect(typo.correct).toBe(false)
    expect(typo.nearMiss).toBe(true)
  })

  it('serbest cümlede görev anlamı dayatılmaz; dilbilgisi cihazda "hata" diye işaretlenmez', () => {
    const sense = content.sense('en-tx-fabric')
    const e = localEvaluate({ lang: 'en', text: 'My grandmother sewed curtains from an old fabric.', mode: 'free', targetSenses: [sense] })
    expect(e.axes.taskMeaning.status).toBe('notApplicable')
    expect(e.axes.targetWord.status).toBe('pass')
    expect(e.axes.grammar.status).toBe('pending')
    expect(e.axes.naturalness.status).toBe('pending')
    expect(e.corrections).toHaveLength(0)
  })

  it('görevde örnek cevaptan farklı ama geçerli olabilecek ifade reddedilmez, "bekliyor" kalır', () => {
    const task = content.tasks.get('en-task-delay')!
    const senses = task.targetSenseIds.map((id) => content.sense(id))
    const alt = localEvaluate({ lang: 'en', text: 'Sorry, because of a yarn shortage your shipment is going to be one week late.', mode: 'constrained', targetSenses: senses, task })
    expect(alt.axes.taskMeaning.status).toBe('pending')
    expect(alt.axes.grammar.status).toBe('pending')
    expect(Object.values(alt.axes).some((a) => a.status === 'fail')).toBe(false)
    // "delay" yok ama "late" var: hata değil, emin değilim
    expect(alt.axes.targetWord.status).toBe('uncertain')
    const sample = localEvaluate({ lang: 'en', text: task.sampleAnswers![0], mode: 'constrained', targetSenses: senses, task })
    expect(sample.axes.taskMeaning.status).toBe('pass')
  })

  it('sunucu cevabında dilbilgisi doğru ama görev anlamı yanlış olabilir; hata ve öneri ayrı tutulur', () => {
    const e = parseRemoteEvaluation({
      axes: { grammar: { status: 'pass' }, taskMeaning: { status: 'fail', note: 'Gecikme süresi belirtilmemiş.' }, targetWord: { status: 'pass' }, naturalness: { status: 'pass' } },
      corrections: [],
      suggestions: [{ original: 'is going to be late', suggestion: 'will be delayed', explanation: 'Daha resmî.' }],
    })
    expect(e.axes.grammar.status).toBe('pass')
    expect(e.axes.taskMeaning.status).toBe('fail')
    expect(e.corrections).toHaveLength(0)
    expect(e.suggestions).toHaveLength(1)
    const broken = parseRemoteEvaluation({ axes: {} })
    expect(broken.axes.grammar.status).toBe('uncertain') // eksik eksen başarı sayılmaz
  })
})

describe('Kabul 6 — Misafir işlemleri sahibin kayıtlarını değiştirmez; çıkışta sahibin dersi döner', () => {
  it('demo izolasyonu, çıkışta geri yükleme, uygulama kapanmasından kurtarma ve temiz yeniden başlatma', async () => {
    const store = memoryStore()
    const ownerDb = `owner-${Date.now()}`
    const sm = new SessionManager(store, ownerDb)
    const boot = await sm.boot()
    const owner = boot.repo
    await owner.recordReview({ lang: 'ru', senseId: 'ru-apple', skill: 'write', grade: 3, source: 'lesson' })
    await owner.saveLessonState({ lang: 'ru', lessonId: 'ru-core-1', track: 'core', status: 'in-progress', step: 3 })
    await owner.addPhrase({ lang: 'ru', text: 'секрет', meaningTr: 'özel not', context: 'müşteri e-postası', source: 'customer-email' })
    const before = await snapshot(owner)

    const guest = await sm.startDemo('#/lesson/ru-core-1')
    expect(guest.repo.kind).toBe('guest')
    expect(owner.db.isOpen()).toBe(false) // sahibin veritabanı demo boyunca kapalı
    expect(await guest.repo.phrasesForLang('ru')).toHaveLength(0) // sahibin kişisel verisi görünmez
    await guest.repo.recordReview({ lang: 'ru', senseId: 'ru-apple', skill: 'write', grade: 1, source: 'lesson' })
    await guest.repo.recordReview({ lang: 'en', senseId: 'en-cat', skill: 'recognizeAudio', grade: 3, source: 'lesson' })
    const p = await guest.repo.getProfile()
    await guest.repo.saveProfile({ ...p, dailyMinutes: 99 })

    const { session, resumeRoute } = await sm.endDemo()
    expect(resumeRoute).toBe('#/lesson/ru-core-1')
    expect(await snapshot(session.repo)).toBe(before)
    expect((await session.repo.getLessonState('ru', 'ru-core-1'))?.step).toBe(3)
    expect(await Dexie.exists(guest.repo.db.name)).toBe(false)

    // Uygulama demo sırasında kapanırsa: yeni açılışta misafir verisi silinir, sahip verisi aynı kalır
    const g2 = await sm.startDemo('#/today')
    await g2.repo.recordReview({ lang: 'ru', senseId: 'ru-milk', skill: 'write', grade: 3, source: 'lesson' })
    const sm2 = new SessionManager(store, ownerDb) // "uygulama yeniden açıldı"
    const boot2 = await sm2.boot()
    expect(boot2.mode).toBe('owner')
    if (boot2.mode === 'owner') expect(boot2.recoveredFromDemo).toBe(true)
    expect(await Dexie.exists(g2.repo.db.name)).toBe(false)
    expect(await snapshot(boot2.repo)).toBe(before)

    // Yeni misafir temiz başlar
    const g3 = await sm2.startDemo('#/today')
    await g3.repo.recordReview({ lang: 'fr', senseId: 'fr-cat', skill: 'write', grade: 3, source: 'lesson' })
    const g4 = await sm2.restartDemo()
    expect(await g4.repo.skillsForLang('fr')).toHaveLength(0)
    await sm2.endDemo()
  })
})

describe('Kabul 7 — Tanınan el yazısı değerlendirmeden önce düzeltilebilir', () => {
  it('onaylanmamış el yazısı değerlendirilmez; düzeltilmiş metin değerlendirilir; tanıma hatası dil hatası sayılmaz', async () => {
    expect(() => prepareAnswer({ inputMode: 'handwriting', recognized: 'co+ton' })).toThrow()
    const answer = prepareAnswer({ inputMode: 'handwriting', recognized: 'The shirt is made of co+ton.', confirmed: 'The shirt is made of cotton.' })
    expect(answer.recognitionEdited).toBe(true)
    const repo = freshRepo()
    const attempt = await submitProduction(repo, {
      lang: 'en', senses: [content.sense('en-tx-cotton')], mode: 'free', prompt: 'p', answer, hintsUsed: 0, context: 'industry', industryId: 'textile',
    })
    expect(attempt.finalText).toBe('The shirt is made of cotton.')
    expect(attempt.recognizedText).toBe('The shirt is made of co+ton.')
    expect(attempt.evaluation!.axes.targetWord.status).toBe('pass')
    expect(await repo.errorsForLang('en')).toHaveLength(0)
  })
})

describe('Kabul 8 — Çevrimdışı kullanım ve sonradan birleştirme veriyi korur', () => {
  it('çevrimdışıyken cevap "bekliyor" kalır; sahte başarı gösterilmez; bağlantı gelince tamamlanır', async () => {
    const repo = freshRepo()
    const answer = prepareAnswer({ inputMode: 'keyboard', text: 'We apologise for the delay.' })
    const a = await submitProduction(repo, { lang: 'en', senses: [content.sense('en-tx-delay')], mode: 'free', prompt: 'p', answer, hintsUsed: 0, context: 'industry' })
    expect(a.evalStatus).toBe('pending')
    let online = false
    const fake: Evaluator = {
      name: 'fake',
      available: () => online,
      evaluate: async () => parseRemoteEvaluation({ axes: { grammar: { status: 'pass' }, taskMeaning: { status: 'notApplicable' }, targetWord: { status: 'pass' }, naturalness: { status: 'pass' } }, corrections: [], suggestions: [] }),
    }
    expect(await processPending(repo, fake)).toBe(0)
    expect((await repo.pendingAttempts()).length).toBe(1)
    online = true
    expect(await processPending(repo, fake)).toBe(1)
    const done = (await repo.attemptsForLang('en'))[0]
    expect(done.evalStatus).toBe('done')
    expect(done.evaluation!.axes.taskMeaning.status).toBe('notApplicable') // serbest cümlede anlam dayatılmadı
  })

  it('iki cihazın verisi birleştirilince kayıt çoğalmaz, daha yeni kayıt kazanır', async () => {
    const phone = freshRepo()
    const tablet = new Repository(new FilizDB(`tablet-${Date.now()}`), 'device-B', 'owner')
    await phone.recordReview({ lang: 'ru', senseId: 'ru-book', skill: 'write', grade: 3, source: 'lesson' })
    await tablet.recordReview({ lang: 'ru', senseId: 'ru-dog', skill: 'write', grade: 3, source: 'lesson' })
    await tablet.saveProfile({ ...(await tablet.getProfile()), dailyMinutes: 25 })
    await new Promise((r) => setTimeout(r, 5))
    await phone.saveProfile({ ...(await phone.getProfile()), dailyMinutes: 10 })

    const fromTablet = await tablet.exportAll()
    const r1 = await phone.importAll(JSON.parse(JSON.stringify(fromTablet)))
    const r2 = await phone.importAll(JSON.parse(JSON.stringify(fromTablet)))
    expect(r1.added).toBeGreaterThan(0)
    expect(r2.added).toBe(0) // ikinci içe aktarma çoğaltmaz
    expect((await phone.skillsForLang('ru')).map((s) => s.senseId).sort()).toEqual(['ru-book', 'ru-dog'])
    expect((await phone.getProfile()).dailyMinutes).toBe(10) // telefondaki değişiklik daha yeni
    const dog = await phone.getSkill('ru-dog', 'write')
    expect(dog!.card.dueAt).toBeInstanceOf(Date) // JSON'dan gelen tarih geri çevrildi
    await phone.recordReview({ lang: 'ru', senseId: 'ru-dog', skill: 'write', grade: 3, source: 'review', now: new Date(dog!.due) })
  })
})

describe('Kabul 9 — Görseller öğretilen anlamla eşleşir', () => {
  it('görsel gerektiren her anlamın görseli kendi kavramına bağlı; aynı kelimenin farklı anlamları farklı görsel kullanır', () => {
    for (const sense of content.senses.values()) {
      const concept = content.concept(sense.conceptId)
      if (concept.imageNeed === 'none') continue
      const img = content.imageFor(sense)
      expect(img, `${sense.id} görselsiz`).toBeDefined()
      expect(img!.conceptIds).toContain(sense.conceptId)
      expect(img!.license).toBeTruthy()
      expect(img!.status).not.toBe('missing')
    }
    for (const sense of content.senses.values()) {
      for (const other of content.otherSenses(sense)) {
        expect(content.imageFor(other)?.id).not.toBe(content.imageFor(sense)?.id)
      }
    }
    expect(content.otherSenses(content.sense('ru-tx-defect')).map((s) => s.id)).toContain('ru-marriage')
  })
})

describe('Kabul 10 — Yeni dil, sektör ve içerik çekirdek kod değişmeden eklenebilir', () => {
  it('yeni bir dil paketi kayıt defterine eklenince dersleri ve planı çalışır', async () => {
    const de: ContentPack = {
      id: 'de-core', lang: 'de', version: 1, title: 'Almanca test', status: 'sample',
      lexemes: [{ id: 'lx-de-apple', lang: 'de', lemma: 'Apfel', pos: 'noun' }],
      senses: [{ id: 'de-apple', lang: 'de', lexemeId: 'lx-de-apple', conceptId: 'apple', senseIndex: 1, level: 'A1', topics: ['food'], explanation: 'Elma.', examples: [{ id: 'de-apple-ex1', text: 'Ich esse einen Apfel.', tr: 'Bir elma yiyorum.', level: 'A1' }], forms: ['apfel', 'äpfel'], productionPrompt: 'p', source: 'test', validation: 'ai-draft' }],
      lessons: [{ id: 'de-core-1', lang: 'de', title: 'Test', track: 'core', order: 1, senseIds: ['de-apple'] }],
    }
    const registry = new ContentRegistry([...PACKS, de])
    expect(registry.coreLessons('de')).toHaveLength(1)
    expect(registry.imageFor(registry.sense('de-apple'))?.render).toBe('apple')
    const repo = freshRepo()
    const plan = await getTodayPlan(repo, await repo.getProfile(), 'de', new Date(), registry)
    expect(plan.newSenseIds).toEqual(['de-apple'])
  })

  it('tüm derslerin anlamları ve görevleri mevcut', () => {
    for (const l of content.lessons.values()) for (const id of l.senseIds) expect(content.senses.has(id), id).toBe(true)
    for (const t of content.tasks.values()) for (const id of t.targetSenseIds) expect(content.senses.has(id), id).toBe(true)
  })
})

describe('Hata defteri', () => {
  it('yanlış yazılan kelime hata defterine düşer; misafir için hata defteri tutulmaz', async () => {
    const repo = freshRepo()
    const sense = content.sense('ru-dog')
    const r = await submitClosed(repo, { lang: 'ru', sense, skill: 'write', exerciseType: 'type-word', prompt: 'köpek', answer: prepareAnswer({ inputMode: 'keyboard', text: 'собока' }), accepted: ['собака'], hintsUsed: 0, context: 'core', source: 'lesson' })
    expect(r.check.nearMiss).toBe(true)
    const errors = await repo.errorsForLang('ru')
    expect(errors).toHaveLength(1)
    expect(errors[0].kind).toBe('spelling')
    const guest = new Repository(new FilizDB(`g-${Date.now()}`), 'guest', 'guest')
    await submitClosed(guest, { lang: 'ru', sense, skill: 'write', exerciseType: 'type-word', prompt: 'köpek', answer: prepareAnswer({ inputMode: 'keyboard', text: 'x' }), accepted: ['собака'], hintsUsed: 0, context: 'demo', source: 'lesson' })
    expect(await guest.errorsForLang('ru')).toHaveLength(0)
  })
})
