import type { Cefr, Lexeme, Pronunciation, Sense, ValidationStatus } from '../types'

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
  examples: [string, string][]
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
    examples: w.examples.map(([text, tr], i) => ({ id: `${w.id}-ex${i + 1}`, text, tr, level: w.level })),
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
