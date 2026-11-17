import { DefaultScheduler } from 'ts-fsrs'
import type { Grade, StoredCard } from './types'

// Tekrar planlayıcı: FSRS-7 (ts-fsrs v6, MIT lisanslı). Varsayılan parametreler büyük ölçüde
// Anki kullanıcılarının verisinden türetilmiştir; herkes için "bilimsel olarak zorunlu" bir takvim değildir.
// Yalnızca bir öğenin hatırlanma olasılığını tahmin eder; dili kullanabilmeyi ölçmez.

type Scheduler = Awaited<ReturnType<typeof DefaultScheduler>>

const cache = new Map<number, Promise<Scheduler>>()

export function getScheduler(desiredRetention = 0.9): Promise<Scheduler> {
  const key = Math.round(desiredRetention * 100) / 100
  let s = cache.get(key)
  if (!s) {
    s = DefaultScheduler({ desiredRetention: key, enableFuzz: false })
    cache.set(key, s)
  }
  return s
}

function toPlain(card: Record<string, unknown>): StoredCard {
  return {
    stability: card.stability as number,
    stabilityFast: card.stabilityFast as number,
    difficulty: card.difficulty as number,
    state: card.state as number,
    scheduleStatus: card.scheduleStatus as string,
    dueAt: new Date(card.dueAt as Date),
    lastReviewAt: card.lastReviewAt ? new Date(card.lastReviewAt as Date) : null,
    cardId: card.cardId as string,
    reps: card.reps as number,
    lapses: card.lapses as number,
    scheduledDays: card.scheduledDays as number,
    learningStep: card.learningStep as number,
  }
}

export async function newCard(now: Date, desiredRetention?: number): Promise<StoredCard> {
  const s = await getScheduler(desiredRetention)
  return toPlain(s.newCard({ now }) as unknown as Record<string, unknown>)
}

export async function reviewCard(card: StoredCard, grade: Grade, now: Date, desiredRetention?: number): Promise<StoredCard> {
  const s = await getScheduler(desiredRetention)
  // JSON yedeğinden gelmiş olabilecek tarih alanlarını Date'e çevir
  const input = { ...card, dueAt: new Date(card.dueAt), lastReviewAt: card.lastReviewAt ? new Date(card.lastReviewAt) : null }
  const result = s.review({ card: input as never, grade, now })
  return toPlain(result.card as unknown as Record<string, unknown>)
}

/** Otomatik puanlanan alıştırmalarda sonuçtan puan çıkarma (tasarım tercihi, belgelendi). */
export function gradeFromOutcome(correct: boolean, hintsUsed: number, nearMiss = false): Grade {
  if (!correct) return 1
  if (hintsUsed > 0 || nearMiss) return 2
  return 3
}

export const GRADE_LABEL: Record<Grade, string> = { 1: 'Hatırlamadım', 2: 'Zor', 3: 'İyi', 4: 'Kolay' }
