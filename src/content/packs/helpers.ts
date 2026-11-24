import type { Cefr, Example, Lesson, Lexeme, Pronunciation, Sense, ValidationStatus } from '../types'

/** Örnek cümlenin kaynağı: Tatoeba cümle kimliği ve Türkçe çevirinin türü */
export interface ExampleMeta {
  src?: string
  trSource?: Example['trSource']
}

/** [hedef dildeki cümle, Türkçe çeviri, isteğe bağlı kaynak] */
export type ExampleInput = [text: string, tr: string, meta?: ExampleMeta]

/** Tatoeba'dan alınan örnek. trSource: 'human' = Tatoeba'daki insan çevirisi, 'mt' = Türkçe çeviri yapay zekâ
 *  taslağı (makine çevirisi diye etiketlenir), 'fixed' = Tatoeba çevirisi düzeltildi. */
export const tatoeba = (id: number, trSource: Example['trSource'] = 'human'): ExampleMeta => ({ src: `tatoeba:${id}`, trSource })

export interface WordInput {
  id: string
  lang: string
  concept: string
  lemma: string
  pos: Lexeme['pos']
  grammar?: Record<string, string>
  pron?: Pronunciation
  /** Aynı kelimenin ikinci anlamı için mevcut lexeme kimliği */
  lexemeId?: string
  senseIndex?: number
  level: Cefr
  topics: string[]
  industry?: string
  subtopic?: string
  explanation: string
  examples: ExampleInput[]
  forms: string[]
  prompt: string
  collocations?: string[]
  synonyms?: { text: string; note: string }[]
  antonyms?: string[]
  usageNote?: string
  morphology?: string
  validation?: ValidationStatus
  source?: string
}

/** Kısa bir tanımdan Lexeme + Sense üretir. */
export function word(w: WordInput): { lexeme?: Lexeme; sense: Sense } {
  const lexemeId = w.lexemeId ?? `lx-${w.id}`
  const lexeme: Lexeme | undefined = w.lexemeId
    ? undefined
    : { id: lexemeId, lang: w.lang, lemma: w.lemma, pos: w.pos, grammar: w.grammar, pronunciation: w.pron }
  const sense: Sense = {
    id: w.id,
    lang: w.lang,
    lexemeId,
    conceptId: w.concept,
    senseIndex: w.senseIndex ?? 1,
    level: w.level,
    topics: w.topics,
    industry: w.industry,
    subtopic: w.subtopic,
    explanation: w.explanation,
    examples: w.examples.map(([text, tr, meta], i) => ({
      id: `${w.id}-ex${i + 1}`, text, tr, level: w.level,
      ...(meta?.src ? { src: meta.src } : {}),
      ...(meta?.trSource ? { trSource: meta.trSource } : {}),
    })),
    forms: w.forms,
    collocations: w.collocations,
    synonyms: w.synonyms,
    antonyms: w.antonyms,
    usageNote: w.usageNote,
    morphology: w.morphology,
    productionPrompt: w.prompt,
    source: w.source ?? 'Filiz örnek içeriği (yapay zekâ taslağı)',
    validation: w.validation ?? 'ai-draft',
  }
  return { lexeme, sense }
}

export function collect(items: { lexeme?: Lexeme; sense: Sense }[]) {
  return {
    lexemes: items.flatMap((i) => (i.lexeme ? [i.lexeme] : [])),
    senses: items.map((i) => i.sense),
  }
}

// ---- Durumlara dayalı başlangıç yolu ----
// Sesler ve Harfler ile sıklık listesi arasında yer alır: elle hazırlanmış başlangıç derslerinin hemen ardından,
// açık veriden gelen sık kelime derslerinden (order ≥ 1000) önce. Her derste 4–5 kalıp ifade veya kısa cümle var.
// Durum: yapay zekâ taslağı — uzman doğrulaması yok. Örnek cümleler Tatoeba'dan, kaynak kimliğiyle.

export const SITUATIONS = [
  { key: 'greetings', title: 'Selamlaşma ve tanışma' },
  { key: 'shopping', title: 'Kafede ve markette' },
  { key: 'directions', title: 'Yol sorma' },
  { key: 'time', title: 'Sayılar ve saat' },
  { key: 'work', title: 'İş yerinde' },
] as const

export type SituationKey = (typeof SITUATIONS)[number]['key']

/** Bu derslerdeki her ifadenin konu etiketi (dersin kendi anahtarına ek olarak) */
export const SITUATION_TOPIC = 'situations'

export const SITUATION_SOURCE = "Filiz başlangıç yolu (yapay zekâ taslağı); örnek cümle Tatoeba'dan, CC BY 2.0 FR"

export interface PhraseInput {
  lang: string
  /** Kavram kimliği; anlam kimliği `${lang}-${concept}` olur */
  concept: string
  lemma: string
  situation: SituationKey
  pron?: Pronunciation
  explanation: string
  example: ExampleInput
  /** Boşluk doldurmada kabul edilen biçimler; verilmezse yalnızca kalıbın kendisi */
  forms?: string[]
  prompt: string
  usageNote?: string
}

/** Kalıp ifade: tek bir Tatoeba örneğiyle, A1, yapay zekâ taslağı */
export function phrase(p: PhraseInput): { lexeme?: Lexeme; sense: Sense } {
  return word({
    id: `${p.lang}-${p.concept}`, lang: p.lang, concept: p.concept, lemma: p.lemma, pos: 'phrase', pron: p.pron,
    level: 'A1', topics: [SITUATION_TOPIC, p.situation], explanation: p.explanation, examples: [p.example],
    forms: p.forms ?? [p.lemma], prompt: p.prompt, usageNote: p.usageNote,
    validation: 'ai-draft', source: SITUATION_SOURCE,
  })
}

/** Başlangıç yolunun dersleri. Kimlikler mevcut biçimde (`ru-core-5`…); `firstOrder` mevcut başlangıç derslerinin
 *  son sırasından bir fazlası olmalı. */
export function situationLessons(lang: string, firstOrder: number, senses: Sense[]): Lesson[] {
  return SITUATIONS.map((s, i) => ({
    id: `${lang}-core-${firstOrder + i}`,
    lang,
    title: s.title,
    track: 'core' as const,
    order: firstOrder + i,
    senseIds: senses.filter((x) => x.topics.includes(s.key)).map((x) => x.id),
  }))
}
