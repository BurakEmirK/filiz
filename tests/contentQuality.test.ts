import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { genKey, type Fetcher, type GenIndex, type GenWord } from '../src/content/generated'
import { content } from '../src/content/registry'

// İlk 100 kelime denetimi (2026-11-20). Yapay zekâ incelemesidir, uzman doğrulaması değildir.
// Ayrıntılar: docs/content-review-2026-11-20.md ve scripts/content/corrections.json

const DIR = join(__dirname, '..', 'public', 'content')
const fsFetcher: Fetcher = async (path) => JSON.parse(readFileSync(join(DIR, path), 'utf-8'))
const words = (lang: string): GenWord[] => {
  const idx = JSON.parse(readFileSync(join(DIR, lang, 'index.json'), 'utf-8')) as GenIndex
  return idx.chunks.flatMap((c) => JSON.parse(readFileSync(join(DIR, lang, c), 'utf-8')) as GenWord[]).sort((a, b) => a.r - b.r)
}
const word = (lang: string, w: string) => words(lang).find((x) => x.w === w)!

beforeAll(async () => {
  for (const l of ['en', 'ru', 'hu']) await content.ensureLanguage(l, fsFetcher)
})

describe('Önceki incelemede bulunan iki hata düzeldi', () => {
  it('İngilizce "This is never going to end." → "Bu asla bitmeyecek." (düzeltilmiş çeviri olarak etiketli)', () => {
    const x = word('en', 'this').x!
    expect(x.t).toBe('This is never going to end.')
    expect(x.tr).toBe('Bu asla bitmeyecek.')
    expect(content.sense(`${genKey('en', 'this')}#1`).examples[0].trSource).toBe('fixed')
  })

  it('Macarca "nem": olumsuz cevap anlamı cinsiyet/tür kelimeleriyle eşleşmiyor', () => {
    const nem = word('hu', 'nem')
    expect(nem.m[0].tr).toBe('hayır, değil')
    expect(nem.m[2].en).toMatch(/gender/)
    expect(nem.m[2].tr).toMatch(/cinsiyet/)
    for (const m of nem.m) if (/cins/.test(m.tr ?? '')) expect(m.en, 'cinsiyet anlamının İngilizcesi').not.toMatch(/negative answer/)
    // yanlış çevirili ikinci anlam ("yasaktır, yok") uygulamada gösterilmez; diğer anlam kimlikleri değişmez
    expect(content.senses.has(`${genKey('hu', 'nem')}#2`)).toBe(false)
    expect(content.sense(`${genKey('hu', 'nem')}#3`).glossEn).toMatch(/gender/)
  })
})

describe('İlk 100 kelimede örnek cümle öğretilen kelimeyi içerir', () => {
  // Elle kontrol edilmiş düzensiz biçimler (paketin biçim listesinde yok ama doğru): am, did, те, кого, дети, Macarca fiil çekimleri...
  const REVIEWED: Record<string, string[]> = {
    en: ['be', 'do'],
    ru: ['тот', 'кто', 'ребёнок'],
    hu: ['mi', 'ő', 'tud', 'kell', 'mond', 'megy', 'szeret', 'tesz', 'akar', 'lát', 'jön', 'vesz', 'áll', 'ad', 'kap', 'tart'],
  }
  const bare = (s: string, lang: string) => s.toLocaleLowerCase(lang).normalize('NFD').replace(/\p{M}/gu, '').replace(/ё/g, 'е')
  for (const lang of ['en', 'ru', 'hu']) {
    it(`${lang}: kelimenin kendisi ya da gerçek bir çekimi örnekte geçer (veya örnek yoktur)`, () => {
      const bad: string[] = []
      for (const w of words(lang).slice(0, 100)) {
        if (!w.x || REVIEWED[lang].includes(w.w)) continue
        const lemma = bare(w.w, lang)
        const forms = new Set([lemma, ...w.f.map((f) => bare(f, lang)).filter((f) => f.length >= 2 && f.startsWith(lemma.slice(0, 2)))])
        const toks = bare(w.x.t, lang).split(/[^\p{L}'’-]+/u)
        if (!toks.some((t) => forms.has(t))) bad.push(`${w.w}: ${w.x.t}`)
      }
      expect(bad).toEqual([])
    })
  }

  it('ana anlam yanlışları düzeldi (ör. may ≠ gitmek, le ≠ tüy, just = sadece)', () => {
    expect(word('en', 'may').m[0].tr).toMatch(/ebilmek/)
    expect(word('en', 'just').m[0].tr).toMatch(/sadece/)
    expect(word('hu', 'le').m[0].tr).toMatch(/aşağı/)
    expect(word('hu', 'igen').m[0].tr).toBe('evet')
    expect(word('ru', 'об').m.slice(1).every((m) => m.h)).toBe(true)
  })
})

describe('Diğer anlamlar listesi', () => {
  it('aynı Türkçe karşılığı tekrar eden anlamlar ayrı ayrı gösterilmez', () => {
    const go = content.sense(`${genKey('en', 'go')}#1`)
    expect(content.otherSenses(go).map((s) => content.gloss(s))).not.toContain(content.gloss(go))
    const glosses = content.otherSenses(go).map((s) => content.gloss(s).toLocaleLowerCase('tr'))
    expect(new Set(glosses).size).toBe(glosses.length)
  })
})
