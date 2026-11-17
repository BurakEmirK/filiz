import { content as defaultContent, type ContentRegistry } from '../content/registry'
import type { Sense, TaskSpec } from '../content/types'
import { phraseToSense, type Repository } from '../data/repo'
import {
  checkClosedAnswer,
  hasPendingAxes,
  localEvaluate,
  mergeEvaluations,
  type ClosedCheck,
  type Evaluator,
} from './evaluation'
import { computeNewBudget, todayKey, type Budget } from './planner'
import { gradeFromOutcome } from './scheduler'
import type { Attempt, ExerciseType, Grade, Profile, Skill, SkillMemory, WordOfDay } from './types'

// Uygulama servisleri: arayüz ile veri katmanı arasındaki iş kuralları. Arayüzden bağımsız test edilir.

// ---- Cevap hazırlama (klavye / el yazısı) ----

export interface PreparedAnswer {
  inputMode: 'keyboard' | 'handwriting'
  finalText: string
  recognizedText?: string
  recognitionEdited?: boolean
}

/** El yazısında tanınan metin, kullanıcı onaylamadan değerlendirmeye gönderilemez.
 *  Kullanıcının tanıma düzeltmeleri dil hatası sayılmaz. */
export function prepareAnswer(input: { inputMode: 'keyboard'; text: string } | { inputMode: 'handwriting'; recognized: string; confirmed?: string }): PreparedAnswer {
  if (input.inputMode === 'keyboard') return { inputMode: 'keyboard', finalText: input.text.trim() }
  if (input.confirmed === undefined) throw new Error('El yazısından tanınan metin değerlendirmeden önce onaylanmalı.')
  const finalText = input.confirmed.trim()
  return { inputMode: 'handwriting', finalText, recognizedText: input.recognized, recognitionEdited: finalText !== input.recognized.trim() }
}

// ---- Kapalı cevaplı alıştırmalar ----

export interface ClosedSubmit {
  lang: string
  sense: Sense
  skill: Skill
  exerciseType: ExerciseType
  prompt: string
  answer: PreparedAnswer
  accepted: string[]
  hintsUsed: number
  elapsedMs?: number
  context: Attempt['context']
  industryId?: string
  source: 'lesson' | 'review' | 'error-practice' | 'collection'
  desiredRetention?: number
  exampleId?: string
}

export async function submitClosed(repo: Repository, s: ClosedSubmit): Promise<{ check: ClosedCheck; memory: SkillMemory; attempt: Attempt }> {
  const check = checkClosedAnswer(s.answer.finalText, s.accepted, s.lang)
  const attempt = await repo.addAttempt({
    lang: s.lang, senseIds: [s.sense.id], exerciseType: s.exerciseType, skill: s.skill, context: s.context, industryId: s.industryId,
    taskMode: 'closed', prompt: s.prompt, inputMode: s.answer.inputMode, recognizedText: s.answer.recognizedText,
    finalText: s.answer.finalText, recognitionEdited: s.answer.recognitionEdited, hintsUsed: s.hintsUsed, elapsedMs: s.elapsedMs,
    correct: check.correct, evalStatus: 'local',
  })
  const grade = gradeFromOutcome(check.correct, s.hintsUsed, check.nearMiss)
  const memory = await repo.recordReview({
    lang: s.lang, senseId: s.sense.id, skill: s.skill, grade, source: s.source, attemptId: attempt.id,
    elapsedMs: s.elapsedMs, hintsUsed: s.hintsUsed, desiredRetention: s.desiredRetention,
  })
  if (!check.correct && repo.kind === 'owner') {
    await repo.addError({
      lang: s.lang, senseId: s.sense.id, attemptId: attempt.id, kind: check.nearMiss ? 'spelling' : 'word-choice',
      userText: s.answer.finalText, correctText: check.expected, explanation: check.explanation, exampleId: s.exampleId,
    })
  }
  return { check, memory, attempt }
}

export async function submitChoice(
  repo: Repository,
  s: { lang: string; sense: Sense; skill: Skill; exerciseType: ExerciseType; prompt: string; correct: boolean; elapsedMs?: number; context: Attempt['context']; industryId?: string; source: 'lesson' | 'review'; desiredRetention?: number },
) {
  const attempt = await repo.addAttempt({
    lang: s.lang, senseIds: [s.sense.id], exerciseType: s.exerciseType, skill: s.skill, context: s.context, industryId: s.industryId,
    taskMode: 'closed', prompt: s.prompt, inputMode: 'choice', hintsUsed: 0, elapsedMs: s.elapsedMs, correct: s.correct, evalStatus: 'local',
  })
  const memory = await repo.recordReview({
    lang: s.lang, senseId: s.sense.id, skill: s.skill, grade: s.correct ? 3 : 1, source: s.source, attemptId: attempt.id,
    elapsedMs: s.elapsedMs, desiredRetention: s.desiredRetention,
  })
  return { attempt, memory }
}

export async function submitSelfRating(
  repo: Repository,
  s: { lang: string; sense: Sense; skill: Skill; grade: Grade; prompt: string; elapsedMs?: number; context: Attempt['context']; source: 'lesson' | 'review' | 'collection'; desiredRetention?: number },
) {
  const attempt = await repo.addAttempt({
    lang: s.lang, senseIds: [s.sense.id], exerciseType: 'flash', skill: s.skill, context: s.context, taskMode: 'closed',
    prompt: s.prompt, inputMode: 'self-rating', hintsUsed: 0, elapsedMs: s.elapsedMs, correct: s.grade > 1, evalStatus: 'not-needed',
  })
  const memory = await repo.recordReview({
    lang: s.lang, senseId: s.sense.id, skill: s.skill, grade: s.grade, source: s.source, attemptId: attempt.id,
    elapsedMs: s.elapsedMs, desiredRetention: s.desiredRetention,
  })
  return { attempt, memory }
}

// ---- Üretim (serbest cümle / görev) ----

export interface ProductionSubmit {
  lang: string
  senses: Sense[]
  task?: TaskSpec
  mode: 'free' | 'constrained'
  prompt: string
  answer: PreparedAnswer
  hintsUsed: number
  elapsedMs?: number
  context: Attempt['context']
  industryId?: string
}

/** Cevabı kaydeder ve cihazda yapılabilen kontrolleri uygular. Bilinmeyen eksenler "bekliyor" kalır;
 *  çevrimiçi değerlendirme yapılmadıysa başarı GÖSTERİLMEZ. */
export async function submitProduction(repo: Repository, s: ProductionSubmit): Promise<Attempt> {
  const evaluation = localEvaluate({ lang: s.lang, text: s.answer.finalText, mode: s.mode, targetSenses: s.senses, task: s.task })
  return repo.addAttempt({
    lang: s.lang, senseIds: s.senses.map((x) => x.id), taskId: s.task?.id, exerciseType: s.task ? 'task' : 'free-sentence',
    skill: 'produce', context: s.context, industryId: s.industryId, taskMode: s.mode, prompt: s.prompt,
    inputMode: s.answer.inputMode, recognizedText: s.answer.recognizedText, finalText: s.answer.finalText,
    recognitionEdited: s.answer.recognitionEdited, hintsUsed: s.hintsUsed, elapsedMs: s.elapsedMs, correct: null,
    evalStatus: hasPendingAxes(evaluation) ? 'pending' : 'local', evaluation,
  })
}

/** Bekleyen cevapları çevrimiçi değerlendiriciyle tamamlar (değerlendirici yoksa hiçbir şey yapmaz). */
export async function processPending(repo: Repository, evaluator: Evaluator, registry: ContentRegistry = defaultContent): Promise<number> {
  if (!evaluator.available()) return 0
  let done = 0
  for (const a of await repo.pendingAttempts()) {
    const senses = a.senseIds.map((id) => registry.senses.get(id)).filter((x): x is Sense => Boolean(x))
    const task = a.taskId ? registry.tasks.get(a.taskId) : undefined
    try {
      const remote = await evaluator.evaluate({
        lang: a.lang, explanationLang: 'tr', text: a.finalText ?? '', mode: a.taskMode === 'constrained' ? 'constrained' : 'free',
        requiredMeaning: task?.requiredMeaning,
        targetWords: senses.map((s) => ({ lemma: registry.lemma(s), senseExplanation: s.explanation })),
      })
      const mode = a.taskMode === 'constrained' ? 'constrained' : 'free'
      const merged = a.evaluation ? mergeEvaluations(a.evaluation, remote, mode) : remote
      await repo.updateAttempt(a.id, { evaluation: merged, evalStatus: 'done' })
      if (repo.kind === 'owner') {
        for (const c of merged.corrections) {
          await repo.addError({ lang: a.lang, senseId: a.senseIds[0], attemptId: a.id, kind: c.kind, userText: c.original, correctText: c.corrected, explanation: c.explanation })
        }
      }
      done++
    } catch {
      // Ağ hatası: cevap "bekliyor" durumunda kalır; başarı uydurulmaz
    }
  }
  return done
}

// ---- Günlük plan ve Günün Kelimesi ----

export interface TodayPlan {
  due: SkillMemory[]
  budget: Budget
  newSenseIds: string[]
  wordOfDay?: WordOfDay
  pendingCount: number
}

export async function getTodayPlan(repo: Repository, profile: Profile, lang: string, now = new Date(), registry: ContentRegistry = defaultContent): Promise<TodayPlan> {
  const due = await repo.dueSkills(lang, now.getTime())
  const introduced = await repo.introducedSenseIds(lang)
  const budget = computeNewBudget({ dailyMinutes: profile.dailyMinutes, newPerDay: profile.newPerDay, dueCount: due.length })
  const order = registry.coreSenseOrder(lang)
  const newSenseIds = order.filter((id) => !introduced.has(id)).slice(0, budget.newCount)
  const date = todayKey(now)
  let wod = await repo.getWordOfDay(lang, date)
  if (!wod) {
    const pick = newSenseIds[0] ?? order[(now.getDate() + order.length) % Math.max(order.length, 1)]
    if (pick) {
      const sense = registry.sense(pick)
      // Eski öğrenilmiş kelimelerle bağlantı: aynı konudaki, daha önce öğrenilmiş anlamlar
      const related = [...introduced]
        .map((id) => registry.senses.get(id))
        .filter((s): s is Sense => Boolean(s) && s!.id !== pick && s!.topics.some((t) => sense.topics.includes(t)))
        .slice(0, 2)
        .map((s) => s.id)
      wod = await repo.saveWordOfDay({ lang, date, senseId: pick, relatedSenseIds: related })
    }
  }
  const pending = (await repo.pendingAttempts()).filter((a) => a.lang === lang).length
  return { due, budget, newSenseIds, wordOfDay: wod, pendingCount: pending }
}

// ---- İlerleme (genel ve sektör ayrı; beceriler ayrı) ----

export interface SkillBreakdown {
  learning: number
  review: number
  strong: number
}

export interface ProgressReport {
  core: { introduced: number; total: number; bySkill: Record<Skill, SkillBreakdown> }
  industries: { industryId: string; introduced: number; total: number; started: boolean }[]
  personal: number
  reviews7d: number
  accuracy7d: number | null
}

const emptySkills = (): Record<Skill, SkillBreakdown> => ({
  recognizeText: { learning: 0, review: 0, strong: 0 },
  recognizeAudio: { learning: 0, review: 0, strong: 0 },
  write: { learning: 0, review: 0, strong: 0 },
  produce: { learning: 0, review: 0, strong: 0 },
})

export async function computeProgress(repo: Repository, lang: string, now = Date.now(), registry: ContentRegistry = defaultContent): Promise<ProgressReport> {
  const skills = (await repo.skillsForLang(lang)).filter((s) => !s.deleted)
  const coreIds = new Set(registry.coreSenseOrder(lang))
  const bySkill = emptySkills()
  const coreIntroduced = new Set<string>()
  for (const s of skills) {
    if (!coreIds.has(s.senseId)) continue
    coreIntroduced.add(s.senseId)
    const b = bySkill[s.skill]
    if (s.card.stability >= 21) b.strong++
    else if (s.card.state === 2) b.review++
    else b.learning++
  }
  const tracks = await repo.industryTracks(lang)
  const industries = registry.industriesFor(lang).map(({ industry, lessons }) => {
    const ids = new Set(lessons.flatMap((l) => l.senseIds))
    const intro = new Set(skills.filter((s) => ids.has(s.senseId)).map((s) => s.senseId))
    return { industryId: industry.id, introduced: intro.size, total: ids.size, started: tracks.some((t) => t.industryId === industry.id) }
  })
  const weekAgo = now - 7 * 24 * 3600_000
  const reviews = (await repo.reviewsForLang(lang)).filter((r) => r.at >= weekAgo)
  const accuracy = reviews.length ? reviews.filter((r) => r.grade > 1).length / reviews.length : null
  const personal = skills.filter((s) => s.senseId.startsWith('user:')).length
  return { core: { introduced: coreIntroduced.size, total: coreIds.size, bySkill }, industries, personal, reviews7d: reviews.length, accuracy7d: accuracy }
}

/** Kişisel ifadeler için anlam haritası (tekrar ekranında içerik dışı anlamları çözmek için) */
export async function personalSenseMap(repo: Repository, lang: string): Promise<Map<string, Sense>> {
  const phrases = await repo.phrasesForLang(lang)
  return new Map(phrases.map((p) => [`user:${p.id}`, phraseToSense(p)]))
}
