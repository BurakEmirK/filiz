// Kullanıcı verisi şeması (IndexedDB'de saklanır). Her kayıt senkron ve tekilleştirme için
// benzersiz kimlik, değişiklik zamanı ve cihaz kimliği taşır.

import type { Cefr } from '../content/types'

export type Skill = 'recognizeText' | 'recognizeAudio' | 'write' | 'produce'

export const SKILL_LABEL: Record<Skill, string> = {
  recognizeText: 'Metinde tanıma',
  recognizeAudio: 'Seste anlama',
  write: 'Yazma',
  produce: 'Kendiliğinden üretme',
}

/** FSRS puanları: 1 Hatırlamadım, 2 Zor, 3 İyi, 4 Kolay */
export type Grade = 1 | 2 | 3 | 4

export interface SyncFields {
  updatedAt: number
  deviceId: string
  deleted?: boolean
}

export type ThemeId = 'kum' | 'adacayi' | 'sis' | 'oyun'
export type AgeGroup = 'child' | 'teen' | 'adult'

export interface KnownLanguage {
  lang: string
  level: Cefr | 'native'
}

export interface Profile extends SyncFields {
  id: 'profile'
  onboarded: boolean
  interfaceLang: 'tr'
  explanationLang: 'tr' | 'en'
  knownLanguages: KnownLanguage[]
  targetLanguages: string[]
  activeLang: string
  ageGroup: AgeGroup
  readingSupport: boolean
  goals: string[]
  interests: string[]
  dailyMinutes: number
  newPerDay: number
  desiredRetention: number
  theme: ThemeId
  appearance: 'system' | 'light' | 'dark'
  textScale: number
  reduceMotion: 'system' | 'on' | 'off'
  /** Dil başına telaffuz yardımı düzeyi */
  pronunciationAid: Record<string, 'full' | 'stress' | 'none'>
  /** Çevrimiçi değerlendirme sunucusu (Aşama 2). Boşsa değerlendirme "bekliyor" kalır. */
  evaluationEndpoint: string
}

export interface LanguageTrack extends SyncFields {
  id: string // = lang
  lang: string
  selfEstimate?: Cefr
  placement?: { checked: number; recognized: number; at: number }
  startedAt: number
}

export interface IndustryTrack extends SyncFields {
  id: string // `${lang}|${industryId}`
  lang: string
  industryId: string
  startedAt: number
}

export interface LessonState extends SyncFields {
  id: string // `${lang}|${lessonId}`
  lang: string
  lessonId: string
  track: 'core' | 'industry'
  industryId?: string
  status: 'in-progress' | 'completed' | 'skipped-known'
  step: number
  completedAt?: number
}

/** FSRS kart durumu (ts-fsrs v6 / FSRS-7 alanları). */
export interface StoredCard {
  stability: number
  stabilityFast: number
  difficulty: number
  state: number
  scheduleStatus: string
  dueAt: Date
  lastReviewAt: Date | null
  cardId: string
  reps: number
  lapses: number
  scheduledDays: number
  learningStep: number
}

export interface SkillMemory extends SyncFields {
  id: string // `${senseId}|${skill}`
  lang: string
  senseId: string
  skill: Skill
  card: StoredCard
  due: number
  lastGrade?: Grade
  origin: 'lesson' | 'placement' | 'collection' | 'review'
}

export interface ReviewLogEntry extends SyncFields {
  id: string
  lang: string
  senseId: string
  skill: Skill
  grade: Grade
  at: number
  source: 'lesson' | 'review' | 'placement' | 'collection' | 'error-practice'
  attemptId?: string
  elapsedMs?: number
  hintsUsed: number
  dueBefore: number
  dueAfter: number
}

export type AxisStatus = 'pass' | 'fail' | 'uncertain' | 'notApplicable' | 'pending'

export interface AxisResult {
  status: AxisStatus
  note?: string
  checkedBy: 'device' | 'tool' | 'model' | null
}

export interface Correction {
  /** Kullanıcının yazdığı parça */
  original: string
  /** En küçük gerekli düzeltme */
  corrected: string
  explanation: string
  kind: 'spelling' | 'grammar' | 'word-choice' | 'meaning'
}

export interface Suggestion {
  original: string
  suggestion: string
  explanation: string
}

export interface Evaluation {
  axes: {
    grammar: AxisResult
    taskMeaning: AxisResult
    targetWord: AxisResult
    naturalness: AxisResult
  }
  /** Gerçek hatalar (düzeltilmesi gereken) */
  corrections: Correction[]
  /** İsteğe bağlı üslup / doğallık önerileri — hata sayılmaz */
  suggestions: Suggestion[]
  correctedSentence?: string
  clarificationQuestion?: string
  provider: string
  at: number
}

export type ExerciseType = 'intro' | 'choose-image' | 'listen-choose' | 'flash' | 'type-word' | 'cloze' | 'free-sentence' | 'task'

export interface Attempt extends SyncFields {
  id: string
  lang: string
  senseIds: string[]
  taskId?: string
  exerciseType: ExerciseType
  skill: Skill
  context: 'core' | 'industry' | 'collection' | 'error-practice' | 'review' | 'demo'
  industryId?: string
  /** 'free' = serbest cümle (dayatılmış anlam yok); 'constrained' = görev/çeviri; 'closed' = kapalı cevaplı */
  taskMode: 'free' | 'constrained' | 'closed'
  prompt: string
  inputMode: 'keyboard' | 'handwriting' | 'choice' | 'self-rating'
  /** El yazısı modunda Scribble'ın ürettiği metin (düzeltme öncesi) */
  recognizedText?: string
  /** Değerlendirmeye giden son metin (kullanıcı onaylı) */
  finalText?: string
  recognitionEdited?: boolean
  hintsUsed: number
  elapsedMs?: number
  correct?: boolean | null
  evalStatus: 'not-needed' | 'local' | 'pending' | 'done' | 'failed'
  evaluation?: Evaluation
  createdAt: number
}

export interface ErrorNote extends SyncFields {
  id: string
  lang: string
  senseId: string
  attemptId: string
  kind: Correction['kind']
  userText: string
  correctText: string
  explanation: string
  /** Hatanın görüldüğü örnek cümle kimliği; pratikte farklı örnek kullanılır */
  exampleId?: string
  createdAt: number
  practicedCount: number
  lastPracticedAt?: number
  resolved: boolean
}

export interface PersonalPhrase extends SyncFields {
  id: string
  lang: string
  text: string
  meaningTr: string
  context: string
  source: 'daily' | 'text' | 'customer-email' | 'other'
  example?: string
  createdAt: number
}

export interface WordOfDay extends SyncFields {
  id: string // `${lang}|${yyyy-mm-dd}`
  lang: string
  date: string
  senseId: string
  relatedSenseIds: string[]
}
