import { content as defaultContent, type ContentRegistry } from '../content/registry'
import { isSoundSense } from '../content/sounds'
import type { Sense } from '../content/types'
import { uid, type Repository } from '../data/repo'
import { computeNewBudget, todayKey } from '../domain/planner'
import { introducedToday, personalSenseMap, startOfLocalDay } from '../domain/services'
import type { Profile, SkillMemory, StepDesc, StudySession } from '../domain/types'
import { LESSON_SEQ, recognize, reviewStep, seeded, toDesc, writeStep, type Step } from './steps'

// Günlük oturum: "Bugünkü çalışmama başla" düğmesinin kurduğu kısa, kaldığı yerden sürdürülebilir çalışma.
// Boyutlar bir TASARIM TERCİHİDİR (bilimsel kural değil): kısa oturum ~8–12 adım.

/** Bir oturumda en çok kaç yeni kelime tanıtılır (her biri tanıt + tanıma = 2 adım) */
export const SESSION_MAX_NEW = 4
/** Normal bir oturumun hedef adım sayısı (yanlış cevap tekrarları hariç) */
export const SESSION_TARGET = 12
/** Yanlış cevaplanan yeni kelimeler için oturum sonuna eklenen en fazla ek soru */
export const MAX_RETRIES = 3
/** Bir oturumda yazmayla ilk kez tanışan kelime sayısı */
export const MAX_WRITE_INTRO = 2

const SECONDS: Record<StepDesc['kind'], number> = { intro: 25, choose: 15, 'choose-gloss': 15, flash: 12, type: 30, produce: 90, letter: 30, task: 90 }

/** Yaklaşık süre (dk). Adım başına tahmini süre bir varsayımdır. */
export function estimateMinutes(steps: StepDesc[]): number {
  if (!steps.length) return 0
  return Math.max(1, Math.round(steps.reduce((a, d) => a + SECONDS[d.kind], 0) / 60))
}

export interface DayInfo {
  date: string
  /** Tekrar zamanı gelmiş farklı kelime sayısı */
  dueSenses: number
  /** Bugünkü yeni kelime hedefi (tekrar yüküne göre azalabilir) */
  newTarget: number
  introducedToday: number
  remainingNew: number
  wodSenseId?: string
}

/** Günün Kelimesi: günün ilk planında müfredatta sıradaki kelime; gün boyu aynı kalır. */
async function ensureWordOfDay(repo: Repository, lang: string, now: Date, registry: ContentRegistry, introduced: Set<string>): Promise<string | undefined> {
  const date = todayKey(now)
  const existing = await repo.getWordOfDay(lang, date)
  if (existing && registry.senses.has(existing.senseId)) return existing.senseId
  const pick = registry.coreSenseOrder(lang).find((id) => !introduced.has(id))
  if (!pick) return undefined
  const sense = registry.sense(pick)
  const related = [...introduced]
    .map((id) => registry.senses.get(id))
    .filter((s): s is Sense => Boolean(s) && s!.id !== pick && s!.topics.some((t) => sense.topics.includes(t)))
    .slice(0, 2)
    .map((s) => s.id)
  await repo.saveWordOfDay({ lang, date, senseId: pick, relatedSenseIds: related })
  return pick
}

/** Günlük akışın tekrarları: zamanı gelmiş ve BUGÜN henüz çalışılmamış beceriler. Bugün çalışılıp birkaç dakika sonraya
 *  planlanan kısa aralıklı tekrarlar ertesi güne kalır (gün "tamam" diye bitebilsin). Keşfet › Tekrar hepsini gösterir. */
export async function dailyDue(repo: Repository, lang: string, now: Date): Promise<SkillMemory[]> {
  const start = startOfLocalDay(now)
  return (await repo.dueSkills(lang, now.getTime())).filter((m) => !m.card.lastReviewAt || new Date(m.card.lastReviewAt).getTime() < start)
}

export async function dayInfo(repo: Repository, profile: Profile, lang: string, now = new Date(), registry: ContentRegistry = defaultContent): Promise<DayInfo> {
  const due = await dailyDue(repo, lang, now)
  const dueSenses = new Set(due.map((d) => d.senseId)).size
  const budget = computeNewBudget({ dailyMinutes: profile.dailyMinutes, newPerDay: profile.newPerDay, dueCount: due.length })
  const today = await introducedToday(repo, lang, now)
  const introduced = await repo.introducedSenseIds(lang)
  const wodSenseId = await ensureWordOfDay(repo, lang, now, registry, introduced)
  return { date: todayKey(now), dueSenses, newTarget: budget.newCount, introducedToday: today.size, remainingNew: Math.max(0, budget.newCount - today.size), wodSenseId }
}

/** Tanıma becerisi oturmuş (en az 2 başarılı tekrar) ama yazma kaydı olmayan kelimeler: yazmayla tanışmaya hazır. */
function readyToWrite(skills: SkillMemory[]): string[] {
  const bySense = new Map<string, SkillMemory[]>()
  for (const m of skills) if (!m.deleted) bySense.set(m.senseId, [...(bySense.get(m.senseId) ?? []), m])
  const out: { id: string; due: number }[] = []
  for (const [id, ms] of bySense) {
    if (isSoundSense(id) || id.startsWith('user:') || ms.some((m) => m.skill === 'write')) continue
    const rec = ms.find((m) => (m.skill === 'recognizeText' || m.skill === 'recognizeAudio') && m.card.reps >= 2 && (m.lastGrade ?? 0) >= 3)
    if (rec) out.push({ id, due: rec.due })
  }
  return out.sort((a, b) => a.due - b.due).map((x) => x.id)
}

/**
 * Önerilen oturumu kurar (kaydetmez). Sıra: ısınma tekrarları, yeni kelimeler (tanıt → bir sonrakinden sonra sor)
 * araya serpiştirilmiş tekrarlarla. Yapılacak bir şey yoksa null.
 * - extra = kullanıcı "Biraz daha çalış" ile günlük hedefin dışında yeni kelime istedi.
 */
export async function planSession(
  repo: Repository,
  profile: Profile,
  lang: string,
  opts: { now?: Date; extra?: boolean } = {},
  registry: ContentRegistry = defaultContent,
): Promise<StudySession | null> {
  const now = opts.now ?? new Date()
  const info = await dayInfo(repo, profile, lang, now, registry)
  const introduced = await repo.introducedSenseIds(lang)
  const personal = await personalSenseMap(repo, lang)
  const resolve = (id: string) => registry.resolve(id, personal)
  const id = uid()
  const rnd = seeded(`session-${id}`)

  const nNew = opts.extra ? SESSION_MAX_NEW : Math.min(SESSION_MAX_NEW, info.remainingNew)
  const newSenses = registry
    .coreSenseOrder(lang)
    .filter((x) => !introduced.has(x))
    .slice(0, nNew)
    .map((x) => registry.senses.get(x))
    .filter((s): s is Sense => Boolean(s))
  const wodIdx = newSenses.findIndex((s) => s.id === info.wodSenseId)
  if (wodIdx > 0) newSenses.unshift(...newSenses.splice(wodIdx, 1))

  let slots = SESSION_TARGET - 2 * newSenses.length
  const used = new Set(newSenses.map((s) => s.id))
  const other: Step[] = []

  // Zamanı gelen tekrarlar (en gecikmiş önce; her kelime oturumda bir kez)
  const writeReady = readyToWrite(await repo.skillsForLang(lang)).filter((x) => !used.has(x))
  const writeSlots = Math.min(MAX_WRITE_INTRO, Math.floor(slots / 2), writeReady.length)
  for (const m of await dailyDue(repo, lang, now)) {
    if (other.length >= slots - writeSlots) break
    if (used.has(m.senseId) || writeReady.slice(0, writeSlots).includes(m.senseId)) continue
    const s = resolve(m.senseId)
    const step = s ? reviewStep(m, s, rnd) : undefined
    if (!step) continue
    used.add(m.senseId)
    other.push(step)
  }
  // Yazmayla tanışma (yazma ve cümlede kullanma sonraki tekrarlara dağıtılır)
  for (const sid of writeReady.slice(0, writeSlots)) {
    const s = resolve(sid)
    if (!s || used.has(sid)) continue
    used.add(sid)
    other.push(writeStep(s, rnd))
  }
  slots = other.length

  if (newSenses.length === 0 && other.length === 0) return null

  const mode = (i: number): 'audio' | 'text' => (i % 2 === 0 ? 'audio' : 'text')
  const newSeq: Step[] = []
  newSenses.forEach((s, i) => {
    newSeq.push(s.id === info.wodSenseId ? { kind: 'intro', sense: s, tag: 'wod' } : { kind: 'intro', sense: s })
    if (i > 0) newSeq.push(recognize(newSenses[i - 1], mode(i - 1), rnd))
  })
  if (newSenses.length) newSeq.push(recognize(newSenses[newSenses.length - 1], mode(newSenses.length - 1), rnd))

  // Isınma: en çok 2 tekrar; sonra 2 yeni adım + 1 tekrar
  const out: Step[] = other.splice(0, newSeq.length ? Math.min(2, other.length) : other.length)
  while (newSeq.length || other.length) {
    out.push(...newSeq.splice(0, 2))
    out.push(...other.splice(0, 1))
  }

  return {
    id,
    lang,
    date: info.date,
    kind: opts.extra ? 'extra' : 'daily',
    steps: out.map(toDesc),
    index: 0,
    status: 'in-progress',
    newSenseIds: newSenses.map((s) => s.id),
    reviewCount: slots,
    retries: 0,
    scored: 0,
    correct: 0,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
    deviceId: repo.deviceId,
  }
}

/** Yeni kelimede yanlış cevap: oturum sonuna aynı kelime için bir tanıma sorusu daha (en çok MAX_RETRIES). */
export function appendRetry(s: StudySession, d: StepDesc, correct: boolean | undefined, registry: ContentRegistry = defaultContent): StudySession {
  if (correct !== false || s.retries >= MAX_RETRIES) return s
  if ((d.kind !== 'choose' && d.kind !== 'choose-gloss') || !s.newSenseIds.includes(d.senseId)) return s
  const sense = registry.senses.get(d.senseId)
  if (!sense) return s
  const step = recognize(sense, 'text', seeded(`retry-${s.id}-${s.retries}`))
  return { ...s, steps: [...s.steps, toDesc(step)], retries: s.retries + 1 }
}

/** Oturumu bitirir. Tüm kelimeleri tanıştırılmış ve HİÇ açılmamış dersler "tamamlandı" sayılır
 *  (ders kütüphanesi tutarlı kalsın). Yarım bırakılmış ders kendiliğinden bitirilmez. */
export async function finishSession(repo: Repository, s: StudySession, now = new Date(), registry: ContentRegistry = defaultContent): Promise<StudySession> {
  const saved = await repo.saveSession({ ...s, index: s.steps.length, status: 'completed', completedAt: now.getTime() })
  const introduced = await repo.introducedSenseIds(s.lang)
  const states = new Map((await repo.lessonStates(s.lang)).map((x) => [x.lessonId, x]))
  for (const l of registry.coreLessons(s.lang)) {
    if (states.has(l.id) || !l.senseIds.length || !l.senseIds.every((x) => introduced.has(x))) continue
    await repo.saveLessonState({ lang: s.lang, lessonId: l.id, track: l.track, status: 'completed', step: 0, seq: LESSON_SEQ, completedAt: now.getTime() })
  }
  return saved
}

export interface DaySummary {
  newToday: number
  reviewedToday: number
  sessionsDone: number
}

/** Bugünün kısa özeti (bitiş ekranı için) */
export async function daySummary(repo: Repository, lang: string, now = new Date()): Promise<DaySummary> {
  const start = startOfLocalDay(now)
  const fresh = await introducedToday(repo, lang, now)
  const reviewed = new Set((await repo.reviewsForLang(lang)).filter((r) => r.at >= start && !fresh.has(r.senseId) && r.source !== 'placement').map((r) => r.senseId))
  const sessions = (await repo.sessionsOn(lang, todayKey(now))).filter((x) => x.status === 'completed').length
  return { newToday: fresh.size, reviewedToday: reviewed.size, sessionsDone: sessions }
}
