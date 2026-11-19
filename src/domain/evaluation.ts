import type { Sense, TaskSpec } from '../content/types'
import { getLanguage } from '../content/languages'
import { charDiff, containsForm, hasCyrillic, levenshtein, normalize } from './text'
import type { AxisResult, Evaluation } from './types'

// Cümle değerlendirme hattı.
// 1) Cihazda yapılabilen kontroller (bu dosya): kapalı cevaplı sorular, hedef kelimenin geçip geçmediği.
// 2) Çevrimiçi değerlendirici (Aşama 2): dilbilgisi/yazım aracı + bağlamı kontrol eden dil modeli.
// İlke: Cihaz, bilmediği bir şey hakkında asla "hata" demez; bilemediği eksenleri "bekliyor" bırakır.

export const PENDING: AxisResult = { status: 'pending', checkedBy: null }
const NA: AxisResult = { status: 'notApplicable', checkedBy: null }

export interface EvalRequest {
  lang: string
  text: string
  /** 'free' = serbest cümle; 'constrained' = belirli bir anlam isteyen görev */
  mode: 'free' | 'constrained'
  targetSenses: Sense[]
  task?: TaskSpec
}

/** Hedef kelime kontrolü. Biçim listesi eksik olabileceği için bulunamaması "hata" değil, "emin değilim"dir. */
export function checkTargetWords(text: string, lang: string, senses: Sense[]): AxisResult {
  if (senses.length === 0) return NA
  const missing: string[] = []
  const synonymNotes: string[] = []
  for (const s of senses) {
    if (s.forms.some((f) => containsForm(text, f, lang))) continue
    const syn = s.synonyms?.find((x) => containsForm(text, x.text, lang))
    if (syn) synonymNotes.push(`"${s.forms[0]}" yerine eşanlamlı "${syn.text}" kullanılmış: ${syn.note}`)
    else missing.push(s.forms[0])
  }
  if (missing.length === 0 && synonymNotes.length === 0) {
    return { status: 'pass', checkedBy: 'device', note: 'Hedef kelime cümlede bulundu. Doğru anlamda kullanılıp kullanılmadığını çevrimiçi değerlendirme kontrol eder.' }
  }
  const notes = [...synonymNotes]
  if (missing.length) {
    notes.push(`Şu kelimeyi bildiğim biçimler arasında bulamadım: ${missing.join(', ')}. Farklı bir çekim kullandıysan bu bir hata olmayabilir.`)
  }
  return { status: 'uncertain', checkedBy: 'device', note: notes.join(' ') }
}

/** Yazı sistemi kontrolü (ör. Rusça için Kiril harfleri) — yalnızca bilgi notu üretir. */
export function scriptNote(text: string, lang: string): string | undefined {
  const info = getLanguage(lang)
  if (info.script === 'Cyrillic' && !hasCyrillic(text)) {
    return 'Metinde Kiril harfi görünmüyor. Rusça klavyeyi (veya Scribble için Rusça klavyeyi) açmayı unutmuş olabilirsin.'
  }
  return undefined
}

/** Cihazda yapılabilen ön değerlendirme. Dilbilgisi ve doğallık her zaman "bekliyor" kalır. */
export function localEvaluate(req: EvalRequest, now = Date.now()): Evaluation {
  const target = checkTargetWords(req.text, req.lang, req.targetSenses)
  const note = scriptNote(req.text, req.lang)
  if (note) target.note = `${target.note ?? ''} ${note}`.trim()

  let taskMeaning: AxisResult = req.mode === 'free' ? { ...NA, note: 'Serbest cümle: belirli bir anlam istenmedi, bu yüzden anlam dayatılmaz.' } : PENDING
  let grammar: AxisResult = PENDING
  let naturalness: AxisResult = PENDING

  // Görevde verilen örnek cevaplardan biriyle birebir eşleşme (normalleştirerek).
  // Eşleşmeme bir hata DEĞİLDİR: geçerli başka ifadeler olabilir.
  if (req.mode === 'constrained' && req.task?.sampleAnswers?.some((a) => normalize(a, req.lang) === normalize(req.text, req.lang))) {
    const m: AxisResult = { status: 'pass', checkedBy: 'device', note: 'Görevin örnek cevaplarından biriyle eşleşti (örnek cevaplar uzman onaylı değildir).' }
    taskMeaning = m
    grammar = m
    naturalness = m
  }

  return {
    axes: { grammar, taskMeaning, targetWord: target, naturalness },
    corrections: [],
    suggestions: [],
    provider: 'device-local-v1',
    at: now,
  }
}

/** Değerlendirmede hâlâ bekleyen eksen var mı? */
export function hasPendingAxes(e: Evaluation): boolean {
  return Object.values(e.axes).some((a) => a.status === 'pending')
}

// ---- Kapalı cevaplı sorular (tek kelime yazma, boşluk doldurma) ----

export interface ClosedCheck {
  correct: boolean
  nearMiss: boolean
  /** Cevap, aynı Türkçe anlamı taşıyan BAŞKA bir kelime (birbirinin yerine geçtiği varsayılmaz) */
  related?: boolean
  matched?: string
  expected: string
  diff?: ReturnType<typeof charDiff>
  explanation: string
}

/** Tek kelime / kısa ifade yazma kontrolü. Kabul edilen tüm biçimler doğru sayılır.
 *  `related`: aynı Türkçe anlamlı başka kelimeler — doğru sayılmaz, ama yazım hatası gibi de gösterilmez. */
export function checkClosedAnswer(answer: string, accepted: string[], lang: string, related: string[] = []): ClosedCheck {
  const a = normalize(answer, lang)
  const expected = accepted[0]
  const exact = accepted.find((x) => normalize(x, lang) === a)
  if (exact) return { correct: true, nearMiss: false, matched: exact, expected, explanation: 'Doğru.' }
  const rel = related.find((x) => normalize(x, lang) === a)
  if (rel) {
    return {
      correct: false,
      nearMiss: false,
      related: true,
      matched: rel,
      expected,
      explanation: `"${rel}" de benzer bir anlama gelebilir, ama her bağlamda aynı değildir. Burada istenen kelime: ${expected}.`,
    }
  }
  if (!a) return { correct: false, nearMiss: false, expected, explanation: 'Cevap boş.' }
  const best = accepted
    .map((x) => ({ x, d: levenshtein(normalize(x, lang), a) }))
    .sort((p, q) => p.d - q.d)[0]
  const n = normalize(best.x, lang)
  // Harf farkı yalnızca yazılışlar birbirine yakınsa gösterilir; tamamen farklı kelimede kafa karıştırır
  const diff = best.d <= Math.max(1, Math.floor(n.length * 0.4)) ? charDiff(a, n) : undefined
  // Uzun kelimelerde tek harf farkı: yazım hatası olarak işaretlenir (anlam hatası değil)
  if (best.d === 1 && n.length >= 4) {
    return { correct: false, nearMiss: true, expected: best.x, diff, explanation: `Neredeyse doğru: tek harf farkı var. Doğru yazılışı: ${best.x}.` }
  }
  return {
    correct: false,
    nearMiss: false,
    expected: best.x,
    diff,
    explanation: diff ? `Yazılışta fark var. Beklenen: ${best.x}.` : `Senin cevabın: ${answer.trim()}. Beklenen: ${best.x}.`,
  }
}

// ---- Çevrimiçi değerlendirici sözleşmesi (Aşama 2'de sunucu tarafında uygulanacak) ----

export interface RemoteEvalRequest {
  lang: string
  explanationLang: 'tr'
  text: string
  mode: 'free' | 'constrained'
  requiredMeaning?: string
  targetWords: { lemma: string; senseExplanation: string }[]
}

export interface Evaluator {
  readonly name: string
  available(): boolean
  evaluate(req: RemoteEvalRequest): Promise<Evaluation>
}

/** Değerlendirici durumu: hiç ayarlanmamış (sunucu yok) ile ayarlı ama şu an çevrimdışı birbirinden ayrılır. */
export type EvaluatorState = 'unconfigured' | 'offline' | 'ready'

export function evaluatorState(endpoint: string, online: boolean): EvaluatorState {
  if (!endpoint.trim()) return 'unconfigured'
  return online ? 'ready' : 'offline'
}

/** Sunucu yapılandırılmadığında kullanılan değerlendirici: hiçbir şeyi değerlendirmez. */
export const notConfiguredEvaluator: Evaluator = {
  name: 'not-configured',
  available: () => false,
  evaluate: () => Promise.reject(new Error('Çevrimiçi değerlendirme yapılandırılmadı')),
}

/** HTTP değerlendirici: anahtar istemcide değil, sunucudadır. Yalnızca cevap metni ve görev bilgisi gönderilir. */
export function httpEvaluator(endpoint: string, isOnline: () => boolean = () => navigator.onLine): Evaluator {
  return {
    name: `http:${endpoint}`,
    available: () => Boolean(endpoint) && isOnline(),
    async evaluate(req) {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) })
      if (!res.ok) throw new Error(`Değerlendirme sunucusu hata döndürdü: ${res.status}`)
      return parseRemoteEvaluation(await res.json())
    },
  }
}

const STATUSES = ['pass', 'fail', 'uncertain', 'notApplicable', 'pending'] as const

/** Sunucu cevabını doğrular. Eksik/bozuk eksen "bekliyor" değil "emin değilim" olur; başarı uydurulmaz. */
export function parseRemoteEvaluation(raw: unknown, now = Date.now()): Evaluation {
  const r = (raw ?? {}) as Record<string, any>
  const axis = (x: any): AxisResult =>
    x && STATUSES.includes(x.status) ? { status: x.status, note: typeof x.note === 'string' ? x.note : undefined, checkedBy: 'model' } : { status: 'uncertain', note: 'Sunucu bu ekseni döndürmedi.', checkedBy: null }
  return {
    axes: {
      grammar: axis(r.axes?.grammar),
      taskMeaning: axis(r.axes?.taskMeaning),
      targetWord: axis(r.axes?.targetWord),
      naturalness: axis(r.axes?.naturalness),
    },
    corrections: Array.isArray(r.corrections) ? r.corrections.filter((c: any) => c?.original && c?.corrected) : [],
    suggestions: Array.isArray(r.suggestions) ? r.suggestions.filter((s: any) => s?.original && s?.suggestion) : [],
    correctedSentence: typeof r.correctedSentence === 'string' ? r.correctedSentence : undefined,
    clarificationQuestion: typeof r.clarificationQuestion === 'string' ? r.clarificationQuestion : undefined,
    provider: typeof r.provider === 'string' ? r.provider : 'remote',
    at: now,
  }
}

/** Cihaz sonucunu sunucu sonucuyla birleştirir: cihazın kesin bulduğu "pass" korunur,
 *  sunucu yalnızca bekleyen/emin olunamayan eksenleri doldurur. Serbest cümlede görev anlamı dayatılmaz. */
export function mergeEvaluations(local: Evaluation, remote: Evaluation, mode: 'free' | 'constrained'): Evaluation {
  const pick = (l: AxisResult, r: AxisResult): AxisResult => (l.status === 'pending' || l.status === 'uncertain' ? r : l)
  return {
    ...remote,
    axes: {
      grammar: pick(local.axes.grammar, remote.axes.grammar),
      taskMeaning: mode === 'free' ? local.axes.taskMeaning : pick(local.axes.taskMeaning, remote.axes.taskMeaning),
      targetWord: pick(local.axes.targetWord, remote.axes.targetWord),
      naturalness: pick(local.axes.naturalness, remote.axes.naturalness),
    },
  }
}
