import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Fetcher, GenIndex, GenWord } from '../src/content/generated'
import { SITUATIONS, SITUATION_TOPIC } from '../src/content/packs/helpers'
import { content, ContentRegistry } from '../src/content/registry'
import { stripStress } from '../src/domain/text'
import { defaultProfile } from '../src/data/repo'
import type { Profile } from '../src/domain/types'
import { planSession, SESSION_MAX_NEW } from '../src/screens/daily'
import { findCloze, lessonSteps } from '../src/screens/steps'
import { freshRepo } from './helpers'

// Durumlara dayalı başlangıç yolu (Rusça, İngilizce, Macarca): Sesler ve Harfler ile sıklık listesi arasında,
// elle hazırlanmış başlangıç derslerinin hemen ardından. İçerik yapay zekâ taslağıdır; uzman doğrulaması yoktur.

const LANGS = ['ru', 'en', 'hu'] as const
const DIR = join(__dirname, '..', 'public', 'content')
const fsFetcher: Fetcher = async (path) => JSON.parse(readFileSync(join(DIR, path), 'utf-8'))
const genWords = (lang: string): GenWord[] => {
  const idx = JSON.parse(readFileSync(join(DIR, lang, 'index.json'), 'utf-8')) as GenIndex
  return idx.chunks.flatMap((c) => JSON.parse(readFileSync(join(DIR, lang, c), 'utf-8')) as GenWord[])
}

const isSituation = (lang: string, id: string) => content.senses.get(id)?.lang === lang && content.senses.get(id)!.topics.includes(SITUATION_TOPIC)
const situationLessons = (lang: string) =>
  content.coreLessons(lang).filter((l) => l.senseIds.length > 0 && l.senseIds.every((id) => isSituation(lang, id)))
const situationSenses = (lang: string) => situationLessons(lang).flatMap((l) => l.senseIds.map((id) => content.sense(id)))
const bare = (s: string, lang: string) => stripStress(s).toLocaleLowerCase(lang).replace(/ё/g, 'е')

describe('Başlangıç yolu: ders yapısı', () => {
  for (const lang of LANGS) {
    it(`${lang}: beş durum dersi, sırayla ve 4–5 öğeyle`, () => {
      const lessons = situationLessons(lang)
      expect(lessons.map((l) => l.title)).toEqual(SITUATIONS.map((s) => s.title))
      for (const l of lessons) {
        expect(l.senseIds.length, l.id).toBeGreaterThanOrEqual(4)
        expect(l.senseIds.length, l.id).toBeLessThanOrEqual(5)
        expect(l.track).toBe('core')
        expect(l.id).toMatch(new RegExp(`^${lang}-core-\\d+$`)) // mevcut kimlik biçimi
      }
    })

    it(`${lang}: mevcut başlangıç derslerinin hemen ardından, sık kelime derslerinden önce`, () => {
      const lessons = situationLessons(lang)
      const curated = content.coreLessons(lang).filter((l) => !lessons.includes(l) && !l.id.startsWith('g-'))
      const lastCurated = Math.max(...curated.map((l) => l.order))
      expect(lessons.map((l) => l.order)).toEqual(lessons.map((_, i) => lastCurated + 1 + i))
      expect(Math.max(...lessons.map((l) => l.order))).toBeLessThan(1000) // sık kelime dersleri 1000'den başlar
      // Mevcut dersler ve kimlikleri yerinde
      expect(curated.map((l) => l.id)).toEqual(curated.map((_, i) => `${lang}-core-${i + 1}`))
    })
  }

  it('mevcut ders kimlikleri ve içerikleri değişmedi', () => {
    expect(content.lessons.get('ru-core-4')!.senseIds).toEqual(['ru-marriage'])
    expect(content.lessons.get('en-core-4')!.senseIds).toEqual(['en-book-reserve'])
    expect(content.lessons.get('hu-core-3')!.senseIds).toEqual(['hu-hello', 'hu-thanks'])
    expect(content.lessons.get('ru-core-5')!.title).toBe('Selamlaşma ve tanışma')
    expect(content.lessons.get('hu-core-4')!.title).toBe('Selamlaşma ve tanışma')
  })
})

describe('Başlangıç yolu: içerik', () => {
  for (const lang of LANGS) {
    it(`${lang}: her örnekte öğretilen kalıp gerçekten geçiyor`, () => {
      const bad: string[] = []
      for (const s of situationSenses(lang)) {
        s.examples.forEach((ex, i) => {
          const cloze = findCloze(s, i)
          // Boşluk doldurma kurulabiliyor ve bulunan parça kabul edilen biçimlerden biri
          if (!cloze || !s.forms.some((f) => bare(f, lang) === bare(cloze.answer, lang))) bad.push(`${s.id}: ${ex.text}`)
          // Bağımsız denetim: biçimlerden biri cümlede kelime sınırlarıyla geçiyor
          else if (!s.forms.some((f) => new RegExp(`(^|[^\\p{L}])${bare(f, lang).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u').test(bare(ex.text, lang)))) bad.push(`${s.id}: ${ex.text}`)
        })
      }
      expect(bad).toEqual([])
    })

    it(`${lang}: her öğenin Türkçe çevirili, Tatoeba kaynaklı örneği var; yapay zekâ taslağı olarak etiketli`, () => {
      for (const s of situationSenses(lang)) {
        expect(s.examples.length, s.id).toBeGreaterThan(0)
        for (const ex of s.examples) {
          expect(ex.tr.trim().length, s.id).toBeGreaterThan(0)
          expect(ex.src, s.id).toMatch(/^tatoeba:\d+$/)
          expect(['human', 'mt', 'fixed'], s.id).toContain(ex.trSource)
        }
        expect(s.validation, s.id).toBe('ai-draft')
        expect(s.source, s.id).toMatch(/yapay zekâ taslağı/)
        expect(s.source, s.id).not.toMatch(/uzman onay|doğrulandı/i)
        expect(s.explanation.length, s.id).toBeGreaterThan(0)
        expect(s.productionPrompt.length, s.id).toBeGreaterThan(0)
        expect(content.concept(s.conceptId).imageNeed, s.id).toBe('none') // görsel iddiası yok
      }
    })

    it(`${lang}: Türkçe anlamlar ders içinde ayırt edilebilir (anlam seçme sorusu belirsiz kalmaz)`, () => {
      const glosses = situationSenses(lang).map((s) => content.gloss(s).toLocaleLowerCase('tr'))
      expect(new Set(glosses).size).toBe(glosses.length)
    })

    it(`${lang}: kalıplar sık kelime listesindeki kelimelerle çakışmıyor (mevcut kelime kimlikleri korunur)`, () => {
      const generated = new Set(genWords(lang).map((w) => w.w.toLocaleLowerCase(lang)))
      const clashes = situationSenses(lang).map((s) => content.lemma(s).toLocaleLowerCase(lang)).filter((l) => generated.has(l))
      expect(clashes).toEqual([])
    })

    it(`${lang}: dersler adım adım kurulabiliyor; tanıma sorularında doğru cevap seçeneklerde, çeldiriciler de kalıp ifade`, async () => {
      // Sık kelime paketi yüklüyken de çeldiriciler tek kelimelerden değil, diğer kalıp ifadelerden seçilir
      await content.ensureLanguage(lang, fsFetcher)
      for (const l of situationLessons(lang)) {
        const steps = lessonSteps(l)
        expect(steps.filter((s) => s.kind === 'intro').length, l.id).toBe(l.senseIds.length)
        const checks = steps.filter((s) => s.kind === 'choose-gloss')
        expect(checks.length, l.id).toBe(l.senseIds.length)
        for (const st of checks) {
          if (st.kind !== 'choose-gloss') continue
          expect(st.options.some((o) => o.id === st.sense.id), l.id).toBe(true)
          expect(st.options.length, l.id).toBe(4)
          expect(new Set(st.options.map((o) => content.gloss(o))).size, l.id).toBe(st.options.length)
          expect(st.options.every((o) => o.topics.includes(SITUATION_TOPIC)), l.id).toBe(true)
        }
      }
    })
  }
})

describe('Başlangıç yolu: günlük oturum sırası', () => {
  const profile = (lang: string): Profile => ({ ...defaultProfile('d'), onboarded: true, targetLanguages: [lang], activeLang: lang })
  const NOW = new Date(2026, 10, 24, 15, 0)

  for (const lang of LANGS) {
    it(`${lang}: müfredat sırası = eski başlangıç kelimeleri → durum ifadeleri → sık kelimeler`, async () => {
      const reg = new ContentRegistry()
      await reg.ensureLanguage(lang, fsFetcher)
      const order = reg.coreSenseOrder(lang)
      const kind = (id: string) => (id.startsWith('g:') ? 'freq' : reg.sense(id).topics.includes(SITUATION_TOPIC) ? 'situation' : 'curated')
      const kinds = order.map(kind)
      const firstSit = kinds.indexOf('situation')
      const lastSit = kinds.lastIndexOf('situation')
      expect(firstSit).toBeGreaterThan(0)
      expect(kinds.slice(0, firstSit).every((k) => k === 'curated')).toBe(true)
      expect(kinds.slice(firstSit, lastSit + 1).every((k) => k === 'situation')).toBe(true)
      expect(kinds.slice(lastSit + 1).every((k) => k === 'freq')).toBe(true)
      expect(kinds.slice(lastSit + 1).length).toBeGreaterThan(1000)
    })

    it(`${lang}: eski başlangıç kelimelerini bitiren öğrencinin sıradaki yeni kelimeleri durum ifadeleri`, async () => {
      const repo = freshRepo()
      const order = content.coreSenseOrder(lang)
      const firstSit = order.findIndex((id) => isSituation(lang, id))
      const before = new Date(NOW.getTime() - 3 * 24 * 3600_000)
      for (const id of order.slice(0, firstSit)) {
        await repo.recordReview({ lang, senseId: id, skill: 'recognizeText', grade: 3, source: 'lesson', now: before })
      }
      const s = await planSession(repo, profile(lang), lang, { now: NOW, extra: true })
      expect(s).not.toBeNull()
      expect(s!.newSenseIds).toEqual(order.slice(firstSit, firstSit + SESSION_MAX_NEW))
      expect(s!.newSenseIds.every((id) => isSituation(lang, id))).toBe(true)
    })
  }
})
