import { ASSETS, CONCEPTS } from './concepts'
import { INDUSTRIES } from './industries'
import { LANGUAGES } from './languages'
import { EN_CORE, EN_TEXTILE } from './packs/en'
import { FR_CORE, ES_CORE, HU_CORE, TR_CORE } from './packs/others'
import { RU_CORE, RU_TEXTILE } from './packs/ru'
import type { Concept, ContentPack, Lesson, Lexeme, MediaAsset, Sense, TaskSpec } from './types'

// İçerik kayıt defteri: tüm paketleri tek yerden sunar. Yeni paket = PACKS listesine ekleme.
export const PACKS: ContentPack[] = [RU_CORE, RU_TEXTILE, EN_CORE, EN_TEXTILE, HU_CORE, FR_CORE, ES_CORE, TR_CORE]

export class ContentRegistry {
  readonly senses = new Map<string, Sense>()
  readonly lexemes = new Map<string, Lexeme>()
  readonly lessons = new Map<string, Lesson>()
  readonly tasks = new Map<string, TaskSpec>()
  readonly concepts = new Map<string, Concept>()
  readonly assets = new Map<string, MediaAsset>()

  constructor(readonly packs: ContentPack[] = PACKS, concepts: Concept[] = CONCEPTS, assets: MediaAsset[] = ASSETS) {
    for (const c of concepts) this.concepts.set(c.id, c)
    for (const a of assets) this.assets.set(a.id, a)
    for (const p of packs) {
      for (const l of p.lexemes) this.add(this.lexemes, l.id, l, p.id)
      for (const s of p.senses) this.add(this.senses, s.id, s, p.id)
      for (const l of p.lessons) this.add(this.lessons, l.id, l, p.id)
      for (const t of p.tasks ?? []) this.add(this.tasks, t.id, t, p.id)
    }
  }

  private add<T>(map: Map<string, T>, id: string, value: T, packId: string) {
    if (map.has(id)) throw new Error(`Yinelenen içerik kimliği "${id}" (paket ${packId})`)
    map.set(id, value)
  }

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
  /** Bir anlamın görseli: yalnızca o anlamın kavramına bağlı görsel döner. */
  imageFor(sense: Sense): MediaAsset | undefined {
    const concept = this.concepts.get(sense.conceptId)
    if (!concept?.imageId) return undefined
    const asset = this.assets.get(concept.imageId)
    return asset && asset.conceptIds.includes(concept.id) ? asset : undefined
  }
  gloss(sense: Sense, explanationLang: 'tr' | 'en' = 'tr'): string {
    if (sense.customGloss) return sense.customGloss
    return this.concepts.get(sense.conceptId)?.gloss[explanationLang] ?? '—'
  }
  /** İçerik anlamı veya kullanıcı ifadesinden üretilmiş anlam */
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
  coreLessons(lang: string): Lesson[] {
    return [...this.lessons.values()].filter((l) => l.lang === lang && l.track === 'core').sort((a, b) => a.order - b.order)
  }
  industryLessons(lang: string, industry: string): Lesson[] {
    return [...this.lessons.values()]
      .filter((l) => l.lang === lang && l.track === 'industry' && l.industry === industry)
      .sort((a, b) => a.order - b.order)
  }
  industriesFor(lang: string) {
    return INDUSTRIES.map((ind) => ({ industry: ind, lessons: this.industryLessons(lang, ind.id) }))
  }
  /** Müfredat sırasıyla bir dilin genel (temel) anlamları */
  coreSenseOrder(lang: string): string[] {
    return this.coreLessons(lang).flatMap((l) => l.senseIds)
  }
  sensesForLang(lang: string): Sense[] {
    return [...this.senses.values()].filter((s) => s.lang === lang)
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
