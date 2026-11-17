// Günlük plan: yeni öğe miktarını tekrar yüküne göre ayarlar.
// Bu formül bir TASARIM TERCİHİDİR (araştırmadan doğrudan çıkan bir kural değildir) ve ayarlarla değiştirilebilir.

export interface BudgetInput {
  dailyMinutes: number
  newPerDay: number
  dueCount: number
  /** Tekrar başına tahmini süre (sn). Varsayım; ileride gerçek süre ölçümleriyle güncellenecek. */
  secondsPerReview?: number
  /** Yeni öğe başına tahmini süre (dk). Varsayım. */
  minutesPerNew?: number
  /** Günün Kelimesi açıksa en az 1 yeni öğe korunur */
  wordOfDay?: boolean
}

export interface Budget {
  reviewMinutes: number
  newCount: number
  reason: string
}

export function computeNewBudget(i: BudgetInput): Budget {
  const spr = i.secondsPerReview ?? 12
  const mpn = i.minutesPerNew ?? 1.5
  const minNew = i.wordOfDay === false ? 0 : 1
  const reviewMinutes = Math.round(((i.dueCount * spr) / 60) * 10) / 10
  const available = Math.max(0, i.dailyMinutes - reviewMinutes)
  const byTime = Math.floor(available / mpn)
  const newCount = Math.max(minNew, Math.min(i.newPerDay, byTime))
  let reason: string
  if (newCount >= i.newPerDay) reason = `Tekrar yükü düşük (≈${reviewMinutes} dk); seçtiğin ${i.newPerDay} yeni öğenin hepsi planlandı.`
  else if (newCount === minNew && minNew === 1)
    reason = `Bekleyen tekrarlar günlük sürenin çoğunu kaplıyor (≈${reviewMinutes} dk / ${i.dailyMinutes} dk). Bugün yalnızca Günün Kelimesi var.`
  else reason = `Bekleyen tekrarlar ≈${reviewMinutes} dk sürecek; kalan süreye göre ${newCount} yeni öğe planlandı (tercihin ${i.newPerDay}).`
  return { reviewMinutes, newCount, reason }
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDue(due: number, now = Date.now()): string {
  const diff = due - now
  if (diff <= 60_000) return 'şimdi'
  const min = Math.round(diff / 60_000)
  if (min < 60) return `${min} dk sonra`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} saat sonra`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} gün sonra`
  const mo = Math.round(d / 30)
  return mo < 12 ? `${mo} ay sonra` : `${Math.round(mo / 12)} yıl sonra`
}
