import { ASSETS, CONCEPTS } from './concepts'
import { browserFetcher, convertWords, lowerLemma, type Fetcher, type GenIndex, type GenWord } from './generated'
import { INDUSTRIES } from './industries'
import { LANGUAGES } from './languages'
import { EN_CORE, EN_TEXTILE } from './packs/en'
import { FR_CORE, ES_CORE, HU_CORE, TR_CORE } from './packs/others'
import { RU_CORE, RU_TEXTILE } from './packs/ru'
import { isSoundSense, soundContent } from './sounds'
import type { Concept, ContentPack, Lesson, Lexeme, MediaAsset, Sense, TaskSpec } from './types'

// İçerik kayıt defteri. Elle hazırlanmış paketler kodla gelir; açık veriden üretilen büyük sık kelime
// paketleri ise dil başına, ilk kullanımda indirilir (ensureLanguage) ve çevrimdışı önbelleğe alınır.
export const PACKS: ContentPack[] = [RU_CORE, RU_TEXTILE, EN_CORE, EN_TEXTILE, HU_CORE, FR_CORE, ES_CORE, TR_CORE]

export type Visual = { kind: 'illustration'; asset: MediaAsset } | { kind: 'emoji'; char: string }

export class ContentRegistry {
  readonly senses = new Map<string, Sense>()
  readonly lexemes = new Map<string, Lexeme>()
  readonly lessons = new Map<string, Lesson>()
  readonly tasks = new Map<string, TaskSpec>()
  readonly concepts = new Map<string, Concept>()
  readonly assets = new Map<string, MediaAsset>()
  /** Yüklenmiş büyük paketlerin özet bilgisi (kapsam istatistikleri) */
  readonly indexes = new Map<string, GenIndex>()
  private loading = new Map<string, Promise<void>>()
  private glossIndex = new Map<string, Map<string, Sense[]>>()

  constructor(readonly packs: ContentPack[] = PACKS, concepts: Concept[] = CONCEPTS, assets: MediaAsset[] = ASSETS) {
    for (const c of concepts) this.concepts.set(c.id, c)
    for (const a of assets) this.assets.set(a.id, a)
    for (const p of packs) {
      for (const l of p.lexemes) this.add(this.lexemes, l.id, l, p.id)
      for (const s of p.senses) this.add(this.senses, s.id, s, p.id)
      for (const l of p.lessons) this.add(this.lessons, l.id, l, p.id)
      for (const t of p.tasks ?? []) this.add(this.tasks, t.id, t, p.id)
    }
    const snd = soundContent()
    for (const l of snd.lexemes) this.add(this.lexemes, l.id, l, 'sounds')
    for (const s of snd.senses) this.add(this.senses, s.id, s, 'sounds')
    for (const l of snd.lessons) this.add(this.lessons, l.id, l, 'sounds')
  }

  private add<T>(map: Map<string, T>, id: string, value: T, packId: string) {
    if (map.has(id)) throw new Error(`Yinelenen içerik kimliği "${id}" (paket ${packId})`)
    map.set(id, value)
  }

  // ---- Büyük sık kelime paketleri ----
  isLoaded(lang: string) {
    return this.indexes.has(lang)
  }

  ensureLanguage(lang: string, fetcher: Fetcher = browserFetcher): Promise<void> {
    let p = this.loading.get(lang)
    if (!p) {
      p = (async () => {
        const index = (await fetcher(`${lang}/index.json`)) as GenIndex
        const parts = (await Promise.all(index.chunks.map((c) => fetcher(`${lang}/${c}`)))) as GenWord[][]
        this.addGenerated(lang, index, parts.flat())
      })()
      p.catch(() => this.loading.delete(lang))
      this.loading.set(lang, p)
    }
    return p
  }

  /** Paket kelimelerini ekler; elle hazırlanmış içerikte bulunan kelimeler atlanır. */
  addGenerated(lang: string, index: GenIndex, words: GenWord[]) {
    if (this.indexes.has(lang)) return
    const curated = new Set(
      [...this.lexemes.values()].filter((l) => l.lang === lang && !l.id.startsWith('snd-')).map((l) => lowerLemma(l.lemma, lang)),
    )
    const out = convertWords(lang, index, words, curated)
    // Elle hazırlanmış kelimelere paketteki insan sesi kaydı ve IPA eklenir
    for (const w of out.skipped) {
      const lower = lowerLemma(w.w, lang)
      for (const lx of this.lexemes.values()) {
        if (lx.lang !== lang || lx.id.startsWith('snd-') || lowerLemma(lx.lemma, lang) !== lower) continue
        if (w.i) lx.pronunciation = { ...lx.pronunciation, ipa: lx.pronunciation?.ipa ?? w.i }
        if (w.a) for (const s of this.senses.values()) if (s.lexemeId === lx.id && !s.audio) s.audio = { url: w.a.u, file: w.a.f }
      }
    }
    for (const l of out.lexemes) if (!this.lexemes.has(l.id)) this.lexemes.set(l.id, l)
    for (const s of out.senses) if (!this.senses.has(s.id)) this.senses.set(s.id, s)
    for (const l of out.lessons) if (!this.lessons.has(l.id)) this.lessons.set(l.id, l)
    this.indexes.set(lang, index)
    this.glossIndex.delete(lang)
  }

  // ---- Erişim ----
  sense(id: string): Sense {
    const s = this.senses.get(id)
    if (!s) throw new Error(`Anlam bulunamadı: ${id}`)
    return s
  }
  lexemeOf(sense: Sense): Lexeme {
    const l = this.lexemes.get(sense.lexemeId)
    if (!l) throw new Error(`Kelime bulunamadı: ${sense.lexemeId}`)
    return l
  }
  concept(id: string): Concept {
    const c = this.concepts.get(id)
    if (!c) throw new Error(`Kavram bulunamadı: ${id}`)
    return c
  }
  /** Bir anlamın çizimi: yalnızca o anlamın kavramına bağlı görsel döner. */
  imageFor(sense: Sense): MediaAsset | undefined {
    const concept = this.concepts.get(sense.conceptId)
    if (!concept?.imageId) return undefined
    const asset = this.assets.get(concept.imageId)
    return asset && asset.conceptIds.includes(concept.id) ? asset : undefined
  }
  /** Çizim veya (açık veride) anlamla eşleşen emoji */
  visual(sense: Sense): Visual | undefined {
    const asset = this.imageFor(sense)
    if (asset) return { kind: 'illustration', asset }
    if (sense.emoji) return { kind: 'emoji', char: sense.emoji }
    return undefined
  }
  gloss(sense: Sense, explanationLang: 'tr' | 'en' = 'tr'): string {
    if (explanationLang === 'en' && sense.glossEn) return sense.glossEn
    if (sense.customGloss) return sense.customGloss
    return this.concepts.get(sense.conceptId)?.gloss[explanationLang] ?? '—'
  }
  resolve(id: string, extra?: Map<string, Sense>): Sense | undefined {
    return this.senses.get(id) ?? extra?.get(id)
  }
  lemma(sense: Sense): string {
    return this.lexemes.get(sense.lexemeId)?.lemma ?? sense.forms[0] ?? '—'
  }
  /** Bir kelimenin diğer anlamları (aynı lexeme). */
  otherSenses(sense: Sense): Sense[] {
    return [...this.senses.values()].filter((s) => s.lexemeId === sense.lexemeId && s.id !== sense.id)
  }

  languagesWithContent(): string[] {
    return LANGUAGES.map((l) => l.code).filter((code) => this.packs.some((p) => p.lang === code))
  }
  /** Genel dersler: elle hazırlanmış başlangıç dersleri, ardından (yüklendiyse) sık kelime dersleri */
  coreLessons(lang: string): Lesson[] {
    return [...this.lessons.values()].filter((l) => l.lang === lang && l.track === 'core').sort((a, b) => a.order - b.order)
  }
  soundLessons(lang: string): Lesson[] {
    return [...this.lessons.values()].filter((l) => l.lang === lang && l.track === 'sounds').sort((a, b) => a.order - b.order)
  }
  industryLessons(lang: string, industry: string): Lesson[] {
    return [...this.lessons.values()]
      .filter((l) => l.lang === lang && l.track === 'industry' && l.industry === industry)
      .sort((a, b) => a.order - b.order)
  }
  industriesFor(lang: string) {
    return INDUSTRIES.map((ind) => ({ industry: ind, lessons: this.industryLessons(lang, ind.id) }))
  }
  /** Müfredat sırasıyla bir dilin genel anlamları (harf/ses öğeleri hariç) */
  coreSenseOrder(lang: string): string[] {
    return this.coreLessons(lang).flatMap((l) => l.senseIds)
  }
  /** Kelime anlamları (harf/ses öğeleri hariç) */
  sensesForLang(lang: string): Sense[] {
    return [...this.senses.values()].filter((s) => s.lang === lang && !isSoundSense(s.id))
  }
  /** Görseli olan, verilen anlamdan farklı kavramlı çeldiriciler */
  distractors(sense: Sense, count: number, rnd: () => number = Math.random): Sense[] {
    const pool = this.sensesForLang(sense.lang).filter(
      (s) => s.conceptId !== sense.conceptId && this.imageFor(s) && (s.industry ?? 'core') === (sense.industry ?? 'core'),
    )
    const fallback = this.sensesForLang(sense.lang).filter((s) => s.conceptId !== sense.conceptId && this.imageFor(s))
    const source = pool.length >= count ? pool : fallback
    return shuffle(source, rnd).slice(0, count)
  }
  /** Anlam seçme alıştırması için çeldiriciler: farklı anlamlı, mümkünse aynı türden ve yakın sıklıkta kelimeler */
  glossDistractors(sense: Sense, count: number, rnd: () => number = Math.random): Sense[] {
    const own = this.gloss(sense).toLocaleLowerCase('tr')
    const pool = isSoundSense(sense.id)
      ? [...this.senses.values()].filter((s) => s.lang === sense.lang && isSoundSense(s.id) && s.id !== sense.id)
      : this.sensesForLang(sense.lang).filter((s) => s.senseIndex === 1 && s.lexemeId !== sense.lexemeId)
    const distinct = pool.filter((s) => this.gloss(s).toLocaleLowerCase('tr') !== own)
    const near = distinct.filter(
      (s) => (!sense.posLabel || s.posLabel === sense.posLabel) && Math.abs((s.rank ?? 0) - (sense.rank ?? 0)) <= 400,
    )
    const source = near.length >= count * 3 ? near : distinct
    const picked: Sense[] = []
    const seen = new Set([own])
    for (const s of shuffle(source, rnd)) {
      const g = this.gloss(s).toLocaleLowerCase('tr')
      if (seen.has(g)) continue
      seen.add(g)
      picked.push(s)
      if (picked.length >= count) break
    }
    return picked
  }
  /** Aynı Türkçe anlama sahip diğer kelimeler (yazma alıştırmasında eşanlamlıyı yanlış saymamak için) */
  sameGloss(sense: Sense): Sense[] {
    let idx = this.glossIndex.get(sense.lang)
    if (!idx) {
      idx = new Map()
      for (const s of this.sensesForLang(sense.lang)) {
        const g = this.gloss(s).toLocaleLowerCase('tr')
        const arr = idx.get(g) ?? []
        arr.push(s)
        idx.set(g, arr)
      }
      this.glossIndex.set(sense.lang, idx)
    }
    return (idx.get(this.gloss(sense).toLocaleLowerCase('tr')) ?? []).filter((s) => s.lexemeId !== sense.lexemeId)
  }
}

export function shuffle<T>(items: T[], rnd: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const content = new ContentRegistry()
