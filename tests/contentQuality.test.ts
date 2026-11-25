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
    fr: [],
    // düzensiz çekimler: puedo, di, sé, puso
    es: ['poder', 'dar', 'saber', 'poner'],
    // Türkçe fiil çekimleri biçim listesinde yok (olduğun, diye, et, vardık, yedim, söyledi, yaşayan…), hepsi doğru
    tr: [
      'olmak', 'demek', 'etmek', 'yapmak', 'gelmek', 'varmak', 'vermek', 'bilmek', 'gitmek', 'çıkmak', 'yemek', 'geçmek',
      'söylemek', 'başlamak', 'çalışmak', 'yaşamak',
    ],
  }
  const bare = (s: string, lang: string) => s.toLocaleLowerCase(lang).normalize('NFD').replace(/\p{M}/gu, '').replace(/ё/g, 'е')
  for (const lang of ['en', 'ru', 'hu', 'fr', 'es', 'tr']) {
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

describe('Biçim listesi (f) Vikisözlük etiketlerine göre süzüldü', () => {
  // Eski yazım, ağız biçimi, "alternative form" ve Roma rakamı biçimleri listeye girmez (build_content.py: DROP_FORM_TAGS)
  it('İngilizce: "one"/"first" için "i", "my" için "me", "they" için "the", "of" için "a" yok', () => {
    expect(word('en', 'one').f).not.toContain('i')
    expect(word('en', 'first').f).not.toContain('i')
    expect(word('en', 'my').f).not.toContain('me')
    expect(word('en', 'they').f).not.toContain('the')
    expect(word('en', 'of').f).not.toContain('a')
    expect(word('en', 'have').f).not.toContain('hath')
  })

  it('gerçek çekimler korunur (be → am, is, were; they → them, their)', () => {
    for (const f of ['am', 'is', 'was', 'were', 'are', 'been', 'being']) expect(word('en', 'be').f).toContain(f)
    for (const f of ['them', 'their']) expect(word('en', 'they').f).toContain(f)
    expect(word('fr', 'être').f).toContain('suis')
    expect(word('es', 'ser').f).toContain('soy')
  })
})

describe('Fransızca, İspanyolca, Türkçe ilk 100 denetimi (2026-11-24)', () => {
  it('kaymış Türkçe anlamlar düzeldi (şey ≠ erkeklik organı, gün ≠ Güneş, iyi ≠ aşırı)', () => {
    const sey = word('tr', 'şey')
    expect(sey.m[0].tr).not.toMatch(/organ/)
    expect(sey.m[2].h).toBe(1)
    expect(word('tr', 'gün').m[0].tr).not.toMatch(/^Güneş$/)
    expect(word('tr', 'iyi').m[0].tr).not.toMatch(/aşırı/)
    expect(word('tr', 'o').m[0].tr).toMatch(/kişi zamiri/)
  })

  it('"no/non" anlamı "yasaktır, yok" değil', () => {
    expect(word('fr', 'non').m[0].tr).toMatch(/hayır/)
    expect(word('fr', 'non').m[1].h).toBe(1)
    expect(word('es', 'no').m[1].tr).toBe('hayır')
  })

  it('örnek cümle doğru kelimeyi gösterir (mai ≠ mais, ver ≠ ven, varmak ≠ var, iç ≠ için)', () => {
    expect(word('fr', 'mai').x!.t).toMatch(/^Mai /)
    expect(word('fr', 'ils').x!.t).toMatch(/^Ils /)
    expect(word('es', 'ver').x!.t).toMatch(/\bver\b/)
    expect(word('es', 'nuevo').x!.t).not.toMatch(/Nueva York/)
    expect(word('tr', 'varmak').x!.t).not.toMatch(/\bvar\b/)
    expect(word('tr', 'iç').x!.t).not.toMatch(/\biçin\b/)
    // Türkçe pakette çeviri İngilizcedir; düzeltilen örnek çevirisiz kalmaz
    expect(word('tr', 'iç').x!.en).toBeTruthy()
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
