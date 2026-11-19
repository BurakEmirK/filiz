import { content as defaultContent, type ContentRegistry } from '../content/registry'
import { isSoundSense } from '../content/sounds'
import type { Repository } from '../data/repo'
import type { CareerGoal } from './types'

// Kariyer hedefi ve gelişim yolu. Tahminler GERÇEK çalışma verine dayanır ve garanti değildir:
// son 14 günde kaç yeni kelimeye başladıysan o hızla devam edeceğin varsayılır.

export interface Milestone {
  id: string
  title: string
  done: number
  total: number
  completed: boolean
}

export interface CareerReport {
  goal: CareerGoal
  milestones: Milestone[]
  wordsIntroduced: number
  /** Son 14 günde günlük ortalama yeni kelime */
  pacePerDay: number
  /** Bu hızla hedefe ulaşma tahmini (yyyy-mm-dd), hız 0 ise undefined */
  projectedDate?: string
  daysLeft: number
  /** Hedef tarihe yetişmek için gereken günlük yeni kelime */
  neededPerDay: number
  overall: number
}

const DAY = 24 * 3600_000
export const WORD_STEPS = [500, 1000, 2000, 3000]

function ymd(t: number) {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function computeCareer(repo: Repository, goal: CareerGoal, now = Date.now(), registry: ContentRegistry = defaultContent): Promise<CareerReport> {
  const lang = goal.lang
  const skills = (await repo.skillsForLang(lang)).filter((s) => !s.deleted)
  const reviews = await repo.reviewsForLang(lang)
  const coreIds = new Set(registry.coreSenseOrder(lang))
  const introduced = new Set(skills.filter((s) => coreIds.has(s.senseId)).map((s) => s.senseId))
  const wordsIntroduced = introduced.size

  // Bir anlamın ilk tekrar zamanı = öğrenmeye başlama zamanı
  const firstSeen = new Map<string, number>()
  for (const r of reviews) {
    if (!coreIds.has(r.senseId)) continue
    const prev = firstSeen.get(r.senseId)
    if (prev === undefined || r.at < prev) firstSeen.set(r.senseId, r.at)
  }
  const recent = [...firstSeen.values()].filter((t) => t >= now - 14 * DAY).length
  const pacePerDay = Math.round((recent / 14) * 10) / 10

  const target = Math.max(1, goal.targetWords)
  const remaining = Math.max(0, target - wordsIntroduced)
  const daysLeft = Math.max(0, Math.ceil((new Date(`${goal.targetDate}T23:59:59`).getTime() - now) / DAY))
  const neededPerDay = daysLeft > 0 ? Math.ceil((remaining / daysLeft) * 10) / 10 : remaining
  const projectedDate = remaining === 0 ? ymd(now) : pacePerDay > 0 ? ymd(now + (remaining / pacePerDay) * DAY) : undefined

  const milestones: Milestone[] = []
  const soundLessons = registry.soundLessons(lang)
  if (soundLessons.length) {
    const states = await repo.lessonStates(lang)
    const done = soundLessons.filter((l) => states.some((s) => s.lessonId === l.id && s.status !== 'in-progress')).length
    milestones.push({ id: 'sounds', title: 'Sesler ve Harfler', done, total: soundLessons.length, completed: done === soundLessons.length })
  }
  for (const step of WORD_STEPS.filter((n) => n <= target)) {
    milestones.push({ id: `w${step}`, title: `En sık ${step} kelime`, done: Math.min(wordsIntroduced, step), total: step, completed: wordsIntroduced >= step })
  }
  if (!WORD_STEPS.includes(target)) {
    milestones.push({ id: 'wtarget', title: `${target} kelime`, done: Math.min(wordsIntroduced, target), total: target, completed: wordsIntroduced >= target })
  }
  if (goal.industryId) {
    const lessons = registry.industryLessons(lang, goal.industryId)
    const ids = new Set(lessons.flatMap((l) => l.senseIds))
    const intro = new Set(skills.filter((s) => ids.has(s.senseId)).map((s) => s.senseId)).size
    milestones.push({ id: 'industry', title: 'Sektör terimleri', done: intro, total: ids.size, completed: ids.size > 0 && intro >= ids.size })
    const taskIds = new Set(lessons.flatMap((l) => l.taskIds ?? []))
    if (taskIds.size) {
      const attempts = await repo.attemptsForLang(lang)
      const tried = new Set(attempts.filter((a) => a.taskId && taskIds.has(a.taskId)).map((a) => a.taskId)).size
      milestones.push({ id: 'tasks', title: 'İş görevleri (yazılı)', done: tried, total: taskIds.size, completed: tried >= taskIds.size })
    }
  }
  const totalUnits = milestones.reduce((a, m) => a + (m.total || 0), 0)
  const doneUnits = milestones.reduce((a, m) => a + Math.min(m.done, m.total), 0)
  return {
    goal, milestones, wordsIntroduced, pacePerDay, projectedDate, daysLeft, neededPerDay,
    overall: totalUnits ? doneUnits / totalUnits : 0,
  }
}

/** Harf/ses öğelerini kelime sayısına katmamak için yardımcı */
export function countWords(senseIds: Iterable<string>) {
  let n = 0
  for (const id of senseIds) if (!isSoundSense(id)) n++
  return n
}
