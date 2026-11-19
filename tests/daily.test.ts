import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Fetcher } from '../src/content/generated'
import { content } from '../src/content/registry'
import { defaultProfile, migrateProfile } from '../src/data/repo'
import { checkClosedAnswer, evaluatorState } from '../src/domain/evaluation'
import { introducedToday, submitProduction } from '../src/domain/services'
import type { LessonState, Profile } from '../src/domain/types'
import { appendRetry, estimateMinutes, finishSession, MAX_RETRIES, planSession, SESSION_MAX_NEW, SESSION_TARGET } from '../src/screens/daily'
import { fromDesc, legacyLessonSteps, lessonSteps, lessonStepsFor, toDesc } from '../src/screens/steps'
import { freshRepo } from './helpers'

const DAY = 24 * 3600_000
const NOW = new Date(2026, 10, 20, 15, 0) // yerel saat: 20 Kasım 15:00
const profile = (patch: Partial<Profile> = {}): Profile => ({ ...defaultProfile('d'), onboarded: true, targetLanguages: ['ru'], activeLang: 'ru', ...patch })
const order = () => content.coreSenseOrder('ru')
const resolve = (id: string) => content.senses.get(id)
const DIR = join(__dirname, '..', 'public', 'content')
const fsFetcher: Fetcher = async (path) => JSON.parse(readFileSync(join(DIR, path), 'utf-8'))

// Gerçek Rusça sık kelime paketi (elle hazırlanmış 11 kelime + ~3200 kelime)
beforeAll(() => content.ensureLanguage('ru', fsFetcher))

describe('Günlük yeni kelime sayımı', () => {
  it('yalnızca bugün İLK kez tanıştırılan benzersiz anlamlar sayılır; harf, kişisel ifade ve "biliyorum" kontrolü sayılmaz', async () => {
    const repo = freshRepo()
    const yesterday = new Date(2026, 10, 19, 23, 30)
    await repo.recordReview({ lang: 'ru', senseId: 'ru-apple', skill: 'recognizeText', grade: 3, source: 'lesson', now: NOW })
    await repo.recordReview({ lang: 'ru', senseId: 'ru-apple', skill: 'recognizeAudio', grade: 3, source: 'lesson', now: NOW }) // aynı anlam: bir kez
    await repo.recordReview({ lang: 'ru', senseId: 'ru-milk', skill: 'recognizeText', grade: 3, source: 'lesson', now: yesterday })
    await repo.recordReview({ lang: 'ru', senseId: 'ru-milk', skill: 'recognizeText', grade: 3, source: 'review', now: NOW }) // dün tanıştı
    await repo.recordReview({ lang: 'ru', senseId: 'snd:ru-а', skill: 'recognizeText', grade: 3, source: 'lesson', now: NOW })
    await repo.recordReview({ lang: 'ru', senseId: 'user:x', skill: 'recognizeText', grade: 3, source: 'collection', now: NOW })
    await repo.recordReview({ lang: 'ru', senseId: 'ru-water', skill: 'recognizeText', grade: 3, source: 'placement', now: NOW })
    await repo.recordReview({ lang: 'en', senseId: 'en-cat', skill: 'recognizeText', grade: 3, source: 'lesson', now: NOW }) // başka dil
    expect([...(await introducedToday(repo, 'ru', NOW))]).toEqual(['ru-apple'])
  })
})

describe('Günlük oturum planı', () => {
  it('yeni başlayan için kısa oturum: en çok 4 yeni kelime, tanıt + tanıma; ilk yeni kelime Günün Kelimesi', async () => {
    const repo = freshRepo()
    const s = await planSession(repo, profile(), 'ru', { now: NOW })
    expect(s).not.toBeNull()
    expect(s!.newSenseIds).toHaveLength(SESSION_MAX_NEW)
    expect(s!.newSenseIds).toEqual(order().slice(0, SESSION_MAX_NEW))
    expect(s!.steps.length).toBeGreaterThanOrEqual(8)
    expect(s!.steps.length).toBeLessThanOrEqual(SESSION_TARGET)
    expect(s!.steps[0]).toMatchObject({ kind: 'intro', senseId: s!.newSenseIds[0], tag: 'wod' })
    expect(s!.steps.some((d) => d.kind === 'type' || d.kind === 'produce')).toBe(false)
    for (const id of s!.newSenseIds) {
      const intro = s!.steps.findIndex((d) => d.kind === 'intro' && d.senseId === id)
      const check = s!.steps.findIndex((d) => (d.kind === 'choose' || d.kind === 'choose-gloss') && d.senseId === id)
      expect(intro).toBeGreaterThanOrEqual(0)
      expect(check).toBeGreaterThan(intro) // önce tanıt, sonra sor
    }
    const wod = await repo.getWordOfDay('ru', '2026-11-20')
    expect(wod?.senseId).toBe(s!.newSenseIds[0])
  })

  it('kaydedilen oturum tanımlarından aynı adımlar yeniden kurulur (kaldığı yerden devam)', async () => {
    const repo = freshRepo()
    const s = (await planSession(repo, profile(), 'ru', { now: NOW }))!
    for (const d of s.steps) {
      const step = fromDesc(d, resolve)
      expect(step, JSON.stringify(d)).toBeDefined()
      expect(toDesc(step!)).toEqual(d)
    }
    await repo.saveSession({ ...s, index: 3 })
    const again = await repo.activeSession('ru')
    expect(again?.id).toBe(s.id)
    expect(again?.index).toBe(3)
    expect(again?.steps).toEqual(s.steps)
  })

  it('günlük hedef dolunca yeni kelime eklenmez; hiçbir iş yoksa oturum yok; "biraz daha" açık seçimle hedefin dışında yeni kelime verir', async () => {
    const repo = freshRepo()
    const first5 = order().slice(0, 5)
    for (const id of first5) await repo.recordReview({ lang: 'ru', senseId: id, skill: 'recognizeText', grade: 3, source: 'lesson', now: NOW })
    const later = new Date(NOW.getTime() + 60_000)
    expect(await planSession(repo, profile({ newPerDay: 5 }), 'ru', { now: later })).toBeNull()
    const extra = await planSession(repo, profile({ newPerDay: 5 }), 'ru', { now: later, extra: true })
    expect(extra?.kind).toBe('extra')
    expect(extra!.newSenseIds.length).toBeGreaterThan(0)
    expect(extra!.newSenseIds.some((id) => first5.includes(id))).toBe(false)
  })

  it('zamanı gelen tekrarlar eklenir; her kelime oturumda bir kez; toplam en çok 12 adım; bütçeden kalan kadar yeni kelime', async () => {
    const repo = freshRepo()
    const old = new Date(NOW.getTime() - 3 * DAY)
    const reviewIds = order().slice(0, 10)
    for (const id of reviewIds) {
      await repo.recordReview({ lang: 'ru', senseId: id, skill: 'recognizeText', grade: 1, source: 'lesson', now: old })
      await repo.recordReview({ lang: 'ru', senseId: id, skill: 'recognizeAudio', grade: 1, source: 'lesson', now: old })
    }
    // Bugün 3 yeni kelime zaten öğrenildi (ör. kütüphaneden bir dersle) → kalan bütçe 2
    for (const id of order().slice(10, 13)) await repo.recordReview({ lang: 'ru', senseId: id, skill: 'recognizeText', grade: 3, source: 'lesson', now: NOW })
    const s = (await planSession(repo, profile({ newPerDay: 5, dailyMinutes: 30 }), 'ru', { now: new Date(NOW.getTime() + 60_000) }))!
    expect(s.newSenseIds).toHaveLength(2)
    expect(s.steps.length).toBeLessThanOrEqual(SESSION_TARGET)
    const reviewed = s.steps.filter((d) => d.kind !== 'intro' && !s.newSenseIds.includes(d.senseId)).map((d) => d.senseId)
    expect(reviewed.length).toBe(s.reviewCount)
    expect(reviewed.length).toBeGreaterThan(0)
    expect(new Set(reviewed).size).toBe(reviewed.length)
    expect(reviewed.every((id) => reviewIds.includes(id))).toBe(true)
  })

  it('bugün zaten çalışılmış kelimenin kısa aralıklı tekrarı günlük akışta yarına kalır; böylece gün "tamam" diye bitebilir', async () => {
    const repo = freshRepo()
    for (const id of order().slice(0, 5)) await repo.recordReview({ lang: 'ru', senseId: id, skill: 'recognizeText', grade: 1, source: 'lesson', now: NOW })
    const later = new Date(NOW.getTime() + 30 * 60_000)
    expect((await repo.dueSkills('ru', later.getTime())).length).toBeGreaterThan(0) // planlayıcıya göre zamanı geldi…
    expect(await planSession(repo, profile({ newPerDay: 5 }), 'ru', { now: later })).toBeNull() // …ama bugünkü akış bitti
    const tomorrow = new Date(NOW.getTime() + DAY)
    const s = await planSession(repo, profile({ newPerDay: 5 }), 'ru', { now: tomorrow })
    expect(s!.reviewCount).toBeGreaterThan(0)
  })

  it('yazma sonraya dağıtılır: tanıma becerisi oturmuş ama yazma kaydı olmayan kelime yazma adımıyla tanışır', async () => {
    const repo = freshRepo()
    const id = order()[0]
    await repo.recordReview({ lang: 'ru', senseId: id, skill: 'recognizeText', grade: 3, source: 'lesson', now: new Date(NOW.getTime() - 10 * DAY) })
    await repo.recordReview({ lang: 'ru', senseId: id, skill: 'recognizeText', grade: 3, source: 'review', now: new Date(NOW.getTime() - 9 * DAY) })
    const s = (await planSession(repo, profile(), 'ru', { now: NOW }))!
    expect(s.steps.some((d) => d.kind === 'type' && d.senseId === id)).toBe(true)
  })

  it('tahmini süre adım sayısından hesaplanır ve en az 1 dakikadır', () => {
    expect(estimateMinutes([])).toBe(0)
    expect(estimateMinutes([{ kind: 'flash', senseId: 'x' }])).toBe(1)
    expect(estimateMinutes(Array.from({ length: 8 }, (_, i) => ({ kind: 'intro' as const, senseId: `x${i}` })))).toBeGreaterThanOrEqual(3)
  })
})

describe('Zorlanılan kelime oturumda tekrar sorulur', () => {
  it('yeni kelimede yanlış cevap oturum sonuna bir tanıma adımı ekler; en çok 3 kez; tekrarda ve doğru cevapta eklenmez', async () => {
    const repo = freshRepo()
    let s = (await planSession(repo, profile(), 'ru', { now: NOW }))!
    const check = s.steps.find((d) => d.kind === 'choose' || d.kind === 'choose-gloss')!
    const base = s.steps.length
    expect(appendRetry(s, check, true).steps).toHaveLength(base)
    s = appendRetry(s, check, false)
    expect(s.steps).toHaveLength(base + 1)
    const added = s.steps[base]
    expect(added.senseId).toBe(check.senseId)
    expect(['choose', 'choose-gloss']).toContain(added.kind)
    expect(fromDesc(added, resolve)).toBeDefined()
    for (let i = 0; i < 5; i++) s = appendRetry(s, check, false)
    expect(s.steps).toHaveLength(base + MAX_RETRIES)
    const review = { kind: 'flash' as const, senseId: 'ru-not-new' }
    expect(appendRetry(s, review, false).steps).toHaveLength(base + MAX_RETRIES)
  })
})

describe('Oturum bitince ders kütüphanesi tutarlı kalır', () => {
  it('tüm kelimeleri tanıştırılmış ve hiç açılmamış ders tamamlandı sayılır; yarım bırakılmış ders kendiliğinden bitirilmez', async () => {
    const repo = freshRepo()
    const [l1, l2] = content.coreLessons('ru')
    for (const id of [...l1.senseIds, ...l2.senseIds]) await repo.recordReview({ lang: 'ru', senseId: id, skill: 'recognizeText', grade: 3, source: 'lesson', now: NOW })
    await repo.saveLessonState({ lang: 'ru', lessonId: l2.id, track: 'core', status: 'in-progress', step: 4 })
    const s = (await planSession(repo, profile(), 'ru', { now: NOW, extra: true }))!
    await finishSession(repo, s, NOW)
    expect((await repo.getLessonState('ru', l1.id))?.status).toBe('completed')
    expect((await repo.getLessonState('ru', l2.id))?.status).toBe('in-progress')
    expect((await repo.getSession(s.id))?.status).toBe('completed')
    expect(await repo.activeSession('ru')).toBeUndefined()
  })
})

describe('Kısa dersler ve eski yarım dersler', () => {
  const lesson = () => content.coreLessons('ru')[0]

  it('5 kelimelik ders artık ~10 adım: her kelime önce tanıtılır sonra sorulur; yazma ve cümle sonraya kalır', () => {
    const l = lesson()
    const steps = lessonSteps(l)
    expect(steps.length).toBeLessThanOrEqual(SESSION_TARGET)
    expect(steps.length).toBe(l.senseIds.length * 2)
    expect(steps.every((s) => s.kind === 'intro' || s.kind === 'choose' || s.kind === 'choose-gloss')).toBe(true)
    expect(legacyLessonSteps(l).length).toBeGreaterThan(SESSION_TARGET)
  })

  it('eski düzende yarım kalan ders eski sırayla kaldığı adımdan sürer; yeni düzende kalan ders yeni sırayla; taşan adım son adıma çekilir', () => {
    const l = lesson()
    const st = (p: Partial<LessonState>): LessonState => ({ id: `ru|${l.id}`, lang: 'ru', lessonId: l.id, track: 'core', status: 'in-progress', step: 7, updatedAt: 0, deviceId: 'd', ...p })
    const legacy = lessonStepsFor(l, st({}))
    expect(legacy.legacy).toBe(true)
    expect(legacy.startAt).toBe(7)
    expect(legacy.steps.map((s) => s.kind)).toEqual(legacyLessonSteps(l).map((s) => s.kind))
    const fresh = lessonStepsFor(l, st({ seq: 2, step: 3 }))
    expect(fresh).toMatchObject({ legacy: false, startAt: 3 })
    expect(lessonStepsFor(l, st({ seq: 2, step: 99 })).startAt).toBe(fresh.steps.length - 1)
    expect(lessonStepsFor(l, st({ status: 'completed', step: 22 }))).toMatchObject({ legacy: false, startAt: 0 })
    expect(lessonStepsFor(l, undefined)).toMatchObject({ legacy: false, startAt: 0 })
  })
})

describe('Aynı Türkçe anlam, aynı kelime demek değildir', () => {
  it('aynı Türkçe anlamlı başka kelime doğru sayılmaz; ayrı ve nazik açıklanır', () => {
    const r = checkClosedAnswer('дом', ['здание'], 'ru', ['дом'])
    expect(r.correct).toBe(false)
    expect(r.related).toBe(true)
    expect(r.explanation).toContain('здание')
    expect(checkClosedAnswer('здание', ['здание'], 'ru', ['дом']).correct).toBe(true)
  })
})

describe('Cümle değerlendirme durumu dürüstçe ayrılır', () => {
  it('sunucu adresi yok = yapılandırılmamış; adres var ama bağlantı yok = çevrimdışı', () => {
    expect(evaluatorState('', true)).toBe('unconfigured')
    expect(evaluatorState('', false)).toBe('unconfigured')
    expect(evaluatorState('https://ornek.test/eval', false)).toBe('offline')
    expect(evaluatorState('https://ornek.test/eval', true)).toBe('ready')
  })

  it('değerlendirici yokken cümle pratik olarak kaydedilir; bekleme kuyruğuna girmez', async () => {
    const repo = freshRepo()
    const sense = content.sense('ru-apple')
    const base = { lang: 'ru', senses: [sense], mode: 'free' as const, prompt: 'p', hintsUsed: 0, context: 'core' as const }
    const a = await submitProduction(repo, { ...base, answer: { inputMode: 'keyboard', finalText: 'Я ем яблоко.' }, evaluator: 'unconfigured' })
    expect(a.evalStatus).toBe('local')
    expect(await repo.pendingAttempts()).toHaveLength(0)
    const b = await submitProduction(repo, { ...base, answer: { inputMode: 'keyboard', finalText: 'Это яблоко.' }, evaluator: 'offline' })
    expect(b.evalStatus).toBe('pending')
  })
})

describe('İçerik bildirimi ve yedek uyumluluğu', () => {
  it('bildirim yalnızca bu cihazdaki tabloda saklanır ve yedeğe girer; oturumlar da yedeklenir', async () => {
    const repo = freshRepo()
    await repo.addReport({ lang: 'en', senseId: 'g:en:end#1', word: 'end', issue: 'translation', note: 'Çeviri yanlış', context: 'örnek cümle' })
    expect(await repo.reports()).toHaveLength(1)
    const s = (await planSession(repo, profile(), 'ru', { now: NOW }))!
    await repo.saveSession(s)
    const file = await repo.exportAll()
    expect(file.schemaVersion).toBe(2)
    expect(file.tables.reports).toHaveLength(1)
    expect(file.tables.sessions).toHaveLength(1)
    const other = freshRepo()
    await other.importAll(file)
    expect(await other.reports()).toHaveLength(1)
    expect((await other.activeSession('ru'))?.id).toBe(s.id)
  })

  it('eski (sürüm 1) yedek dosyası yeni sürüme sorunsuz yüklenir', async () => {
    const repo = freshRepo()
    await repo.recordReview({ lang: 'ru', senseId: 'ru-apple', skill: 'write', grade: 3, source: 'lesson' })
    const file = await repo.exportAll()
    const v1 = { ...file, schemaVersion: 1, tables: { ...file.tables } }
    delete v1.tables.sessions
    delete v1.tables.reports
    const target = freshRepo()
    const r = await target.importAll(v1)
    expect(r.added).toBeGreaterThan(0)
    expect(await target.getSkill('ru-apple', 'write')).toBeDefined()
  })

  it('eski varsayılan tema bir kez yeni varsayılana geçer; kullanıcı sonra Kum seçerse korunur', () => {
    const old = { ...defaultProfile('d'), theme: 'kum' as const }
    delete (old as Partial<Profile>).themeVersion
    const migrated = migrateProfile(old)
    expect(migrated.theme).toBe('civit')
    expect(migrated.themeVersion).toBe(2)
    const chosen = migrateProfile({ ...migrated, theme: 'kum' })
    expect(chosen.theme).toBe('kum')
    expect(defaultProfile('d').theme).toBe('civit')
  })
})
