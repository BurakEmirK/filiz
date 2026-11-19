import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { genKey, LESSON_SIZE, type Fetcher, type GenIndex, type GenWord } from '../src/content/generated'
import { ContentRegistry } from '../src/content/registry'
import { computeCareer } from '../src/domain/career'
import { acceptedForWord, findCloze, lessonSteps, relatedForWord, unitCheckSteps } from '../src/screens/steps'
import { freshRepo } from './helpers'

const LANGS = ['ru', 'hu', 'fr', 'es', 'en', 'tr']
const DIR = join(__dirname, '..', 'public', 'content')
const fsFetcher: Fetcher = async (path) => JSON.parse(readFileSync(join(DIR, path), 'utf-8'))
const load = (lang: string) => {
  const idx = JSON.parse(readFileSync(join(DIR, lang, 'index.json'), 'utf-8')) as GenIndex
  const words = idx.chunks.flatMap((c) => JSON.parse(readFileSync(join(DIR, lang, c), 'utf-8')) as GenWord[])
  return { idx, words }
}

describe('Kelime havuzu: dil başına en az 3000 sık kelime (açık veri)', () => {
  for (const lang of LANGS) {
    it(`${lang}: en az 3000 kelime, sıralı, tekrarsız, her birinde anlam var`, () => {
      const { idx, words } = load(lang)
      expect(words.length).toBeGreaterThanOrEqual(3000)
      expect(idx.count).toBe(words.length)
      expect(words.map((w) => w.r)).toEqual(words.map((_, i) => i + 1))
      const lemmas = words.map((w) => w.w.toLocaleLowerCase(lang))
      expect(new Set(lemmas).size).toBe(lemmas.length)
      for (const w of words) {
        expect(w.m.length, w.w).toBeGreaterThan(0)
        expect(w.m[0].en.length, w.w).toBeGreaterThan(0)
        expect(w.p, w.w).toBeTruthy()
      }
    })

    it(`${lang}: Türkçe anlam ve örnek cümle kapsamı yeterli; ses adresleri Wikimedia'dan`, () => {
      const { words } = load(lang)
      const withTr = words.filter((w) => w.m[0].tr).length / words.length
      expect(withTr).toBeGreaterThan(0.9)
      const withEx = words.filter((w) => w.x).length / words.length
      expect(withEx).toBeGreaterThan(0.9)
      // Ses dosyaları yalnızca Wikimedia'dan: doğrudan dosya adresi veya Commons'un dosyaya yönlendiren adresi
      for (const w of words) if (w.a) expect(w.a.u, w.w).toMatch(/^(https:)?\/\/(upload|commons)\.wikimedia\.org\//)
    })
  }

  it('es: İspanyolca Vikisözlük ile insan sesi kapsamı en az %15', () => {
    const { words } = load('es')
    expect(words.filter((w) => w.a).length / words.length).toBeGreaterThan(0.15)
  })

  it('en sık kelimeler gerçekten sık: bilinen temel kelimeler ilk 100 içinde', () => {
    const top = (lang: string) => new Set(load(lang).words.slice(0, 100).map((w) => w.w.toLocaleLowerCase(lang)))
    expect(top('ru')).toContain('в')
    expect(top('ru')).toContain('быть')
    expect(top('ru')).toContain('как')
    expect(top('fr')).toContain('être')
    expect(top('fr')).toContain('avoir')
    expect(top('es')).toContain('ser')
    expect(top('en')).toContain('the')
    expect(top('en')).toContain('be')
    expect(top('tr')).toContain('bir')
    expect(top('hu')).toContain('van')
  })

  it('kısaltma/yanlış eşleşme kaynaklı kelimeler ilk 100\'e girmiyor', () => {
    const top = (lang: string) => new Set(load(lang).words.slice(0, 100).map((w) => w.w))
    expect(top('ru').has('восток')).toBe(false)
    expect(top('ru').has('кака')).toBe(false)
    expect(top('en').has('inch')).toBe(false)
    expect(top('en').has('outfield')).toBe(false)
    expect(top('es').has('sudeste')).toBe(false)
  })
})

describe('Uygulamaya yükleme', () => {
  it('paket yüklenince dersler oluşur; elle hazırlanmış kelimeler tekrar edilmez; örnekte kelime bulunur', async () => {
    const reg = new ContentRegistry()
    await reg.ensureLanguage('ru', fsFetcher)
    expect(reg.isLoaded('ru')).toBe(true)
    const lessons = reg.coreLessons('ru')
    expect(lessons[0].id).toBe('ru-core-1') // önce elle hazırlanmış başlangıç dersleri
    const freq = lessons.filter((l) => l.id.startsWith('g-'))
    expect(freq.length).toBeGreaterThanOrEqual(Math.floor(3000 / LESSON_SIZE) - 10)
    expect(freq.every((l) => l.senseIds.length <= LESSON_SIZE)).toBe(true)
    expect(reg.lexemes.has(genKey('ru', 'вода'))).toBe(false) // elle hazırlanmış "вода" zaten var
    expect(reg.sense('ru-water').audio?.url).toMatch(/^https:\/\/upload\.wikimedia\.org\//) // ...ama paketteki insan sesini kullanır
    const senses = freq.slice(0, 40).flatMap((l) => l.senseIds).map((id) => reg.sense(id))
    const withCloze = senses.filter((s) => s.examples.length && findCloze(s, 0)).length / senses.filter((s) => s.examples.length).length
    expect(withCloze).toBeGreaterThan(0.85)
  })

  it('curated/normalize: elle hazırlanmış kelime paketteki insan kaydını bulur; büyük harf ve noktalama fark etmez', async () => {
    const reg = new ContentRegistry()
    await reg.ensureLanguage('hu', fsFetcher)
    const s = reg.wordSense('hu', 'Ház!')
    expect(s).toBeDefined()
    expect(s!.generated).toBeFalsy()
    expect(reg.lemma(s!)).toBe('ház')
    expect(s!.audio?.url).toMatch(/^https:\/\/upload\.wikimedia\.org\//)
    expect(reg.wordSense('hu', 'A ház nagy.')).toBeUndefined() // cümle bir kelime değildir
  })

  it('before load: paket yüklenmeden önce de hata vermez (kayıt yok, cihaz sesi çalar)', () => {
    // Not: elle hazırlanmış anlam nesneleri kayıt defterleri arasında ortaktır (önceki test onlara ses ekledi);
    // bu yüzden yalnızca paketteki bir kelimeyle sınanır.
    const reg = new ContentRegistry()
    expect(() => reg.wordSense('hu', 'hogy')).not.toThrow()
    expect(reg.wordSense('hu', 'hogy')).toBeUndefined()
  })

  it('görseli olmayan kelimelerde anlam seçme alıştırması kurulur; seçenekler farklı anlamlı', async () => {
    const reg = new ContentRegistry()
    await reg.ensureLanguage('en', fsFetcher)
    const lesson = reg.coreLessons('en').find((l) => l.id === 'g-en-3')!
    // steps.ts varsayılan kayıt defterini kullanır; aynı paketi oraya da yükle
    const { content } = await import('../src/content/registry')
    await content.ensureLanguage('en', fsFetcher)
    const steps = lessonSteps(content.lessons.get(lesson.id)!)
    const gloss = steps.filter((s) => s.kind === 'choose-gloss')
    expect(gloss.length).toBeGreaterThan(0)
    for (const s of gloss) {
      if (s.kind !== 'choose-gloss') continue
      expect(s.options.length).toBe(4)
      expect(s.options.some((o) => o.id === s.sense.id)).toBe(true)
      expect(new Set(s.options.map((o) => content.gloss(o).toLocaleLowerCase('tr'))).size).toBe(4)
    }
    const units = content.coreLessons('en').filter((l) => l.unit === 1)
    expect(unitCheckSteps(units, 'x')).toHaveLength(10)
  })

  it('aynı Türkçe anlamlı başka kelime birbirinin yerine geçmiş sayılmaz; ayrıca "benzer" diye açıklanır', async () => {
    const { content } = await import('../src/content/registry')
    await content.ensureLanguage('ru', fsFetcher)
    const sense = [...content.senses.values()].find((s) => s.generated && s.lang === 'ru' && content.sameGloss(s).length > 0)!
    expect(sense).toBeDefined()
    const acc = acceptedForWord(sense)
    const other = content.lemma(content.sameGloss(sense)[0])
    expect(acc).toContain(content.lemma(sense))
    expect(acc).not.toContain(other)
    expect(relatedForWord(sense)).toContain(other)
  })
})

describe('Kariyer hedefi ve yol haritası', () => {
  it('kilometre taşları, hız ve tahmini bitiş tarihi gerçek çalışma kayıtlarından hesaplanır', async () => {
    const { content } = await import('../src/content/registry')
    await content.ensureLanguage('ru', fsFetcher)
    const repo = freshRepo()
    const now = new Date('2026-11-19T12:00:00Z').getTime()
    const order = content.coreSenseOrder('ru')
    // Son 10 günde 140 kelimeye başlanmış olsun (günde 10)
    for (let i = 0; i < 140; i++) {
      await repo.recordReview({ lang: 'ru', senseId: order[i], skill: 'recognizeText', grade: 3, source: 'lesson', now: new Date(now - (i % 10) * 24 * 3600_000) })
    }
    const rep = await computeCareer(repo, { title: 'Rusça tekstil', lang: 'ru', industryId: 'textile', targetWords: 1000, targetDate: '2027-11-19', createdAt: now }, now)
    expect(rep.wordsIntroduced).toBe(140)
    expect(rep.pacePerDay).toBeCloseTo(10, 0)
    expect(rep.projectedDate).toBeDefined()
    expect(rep.milestones.map((m) => m.id)).toEqual(['sounds', 'w500', 'w1000', 'industry', 'tasks'])
    expect(rep.milestones.find((m) => m.id === 'w500')!.done).toBe(140)
    expect(rep.overall).toBeGreaterThan(0)
    expect(rep.overall).toBeLessThan(1)
  })
})
