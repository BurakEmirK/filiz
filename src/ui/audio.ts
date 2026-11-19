import { getLanguage } from '../content/languages'
import { stripStress } from '../domain/text'

// Ses sistemi
// 1) İnsan sesi kaydı varsa (Vikisözlük / Wikimedia Commons, çoğu Lingua Libre) o çalınır.
//    Kayıt ekrana gelince önceden indirilir, cihazda saklanır ve çözülür (Web Audio). Dokununca
//    "kısa efekt sesi" gibi anında çalar: iPhone bunu medya saymaz (Dynamic Island'da görünmez).
//    Çözülmüş kayıt yoksa <audio> oynatıcısıyla çalınır (yedek yol).
// 2) Kayıt yoksa veya çalınamazsa cihazın konuşma sentezi (sentetik ses) denenir.
// iOS kuralları: ses yalnızca bir dokunuşun içinde başlatılabilir; bu yüzden hiçbir ses kendiliğinden çalmaz.
// Önceki sürümde ses listesi geç geldiği için "Ses yok" deniyor ve düğme gizleniyordu; artık karar
// gerçek denemenin sonucuna göre verilir.

export type PlayOutcome = 'recording' | 'tts' | 'tts-no-voice' | 'failed'

export interface AudioTarget {
  text: string
  lang: string
  recording?: string
}

const CACHE = 'filiz-audio-v1'
/** Bellekte çözülmüş tutulan en fazla kayıt (her biri birkaç yüz KB) */
export const MAX_DECODED = 40
const IDLE_MS = 5000
const ready = new Map<string, string>() // kayıt adresi → yerel nesne adresi (blob)
const pending = new Map<string, Promise<void>>()
const decoded = new Map<string, AudioBuffer>() // en son kullanılan sonda (LRU)
let sharedAudio: HTMLAudioElement | null = null
let actx: AudioContext | null = null
let instantOff = false
let currentSource: AudioBufferSourceNode | null = null
let idleTimer: ReturnType<typeof setTimeout> | undefined
/** Son konuşma nesnesi: bazı tarayıcılarda referans tutulmazsa konuşma yarıda kesiliyor */
export let currentUtterance: SpeechSynthesisUtterance | null = null
let sessionPrepared = false

export const audioLog: { at: number; text: string; lang: string; outcome: PlayOutcome; detail?: string }[] = []
function note(t: AudioTarget, outcome: PlayOutcome, detail?: string) {
  audioLog.unshift({ at: Date.now(), text: t.text, lang: t.lang, outcome, detail })
  audioLog.length = Math.min(audioLog.length, 30)
}

function synth(): SpeechSynthesis | undefined {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined
}

/** Safari 17+: sessiz moddayken de uygulama sesi çalınsın (destek yoksa etkisiz). */
function prepareSession() {
  if (sessionPrepared) return
  sessionPrepared = true
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'
  } catch {
    /* desteklenmiyor */
  }
}

/** Tek ses bağlamı (Web Audio). Desteklenmiyorsa null: o zaman <audio> oynatıcısı kullanılır. */
function audioCtx(): AudioContext | null {
  if (actx || instantOff || typeof window === 'undefined') return actx
  const w = window as Window & { webkitAudioContext?: typeof AudioContext }
  const C = w.AudioContext ?? w.webkitAudioContext
  if (!C) return null
  prepareSession()
  try {
    actx = new C()
  } catch {
    instantOff = true
  }
  return actx
}

/** Çözülmüş kaydı en son kullanılan olarak saklar; sınır aşılınca en eskisini bırakır. */
function remember(url: string, buf: AudioBuffer) {
  decoded.delete(url)
  decoded.set(url, buf)
  while (decoded.size > MAX_DECODED) {
    const oldest = decoded.keys().next().value as string
    decoded.delete(oldest)
    pending.delete(oldest) // sonra yeniden istenirse cihaz önbelleğinden tekrar çözülür
  }
}

/** Boşta kalınca ses bağlamını askıya al (pil); sonraki dokunuşta yeniden açılır. */
function scheduleIdle() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (actx?.state === 'running') void actx.suspend().catch(() => undefined)
  }, IDLE_MS)
}

export function audioStats() {
  return { decoded: decoded.size }
}

/** Kaydı arka planda indirir, cihazda saklar ve anında çalmak için çözer (ekrana gelince çağrılır).
 *  Hata olursa sessizce geçer: çalarken oynatıcı yolu denenir. */
export function preloadRecording(url?: string): Promise<void> {
  if (!url || decoded.has(url) || typeof window === 'undefined') return Promise.resolve()
  let p = pending.get(url)
  if (!p) {
    p = (async () => {
      try {
        let res: Response | undefined
        const cache = 'caches' in window ? await caches.open(CACHE) : undefined
        res = await cache?.match(url)
        if (!res) {
          const fresh = await fetch(url, { mode: 'cors' })
          if (!fresh.ok) throw new Error(String(fresh.status))
          await cache?.put(url, fresh.clone())
          res = fresh
        }
        const blob = await res.blob()
        if (!ready.has(url)) ready.set(url, URL.createObjectURL(blob))
        const ctx = audioCtx()
        if (ctx) remember(url, await ctx.decodeAudioData(await blob.arrayBuffer()))
      } catch {
        /* CORS, ağ veya çözme hatası: çalarken oynatıcı yolu denenecek */
      }
    })()
    pending.set(url, p)
  }
  return p
}

/** Çözülmüş kaydı anında çalar. Dokunuşun içinde, beklemeden çağrılmalı (iOS ses bağlamını ancak böyle açar). */
function playInstant(target: AudioTarget & { recording: string }, buf: AudioBuffer, ctx: AudioContext): Promise<PlayOutcome> {
  try {
    const resumed = ctx.state === 'running' ? Promise.resolve() : ctx.resume()
    currentSource?.stop()
    sharedAudio?.pause()
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.onended = scheduleIdle
    clearTimeout(idleTimer)
    src.start()
    currentSource = src
    remember(target.recording, buf)
    return resumed.then(
      () => {
        note(target, 'recording', 'anında')
        return 'recording' as PlayOutcome
      },
      () => {
        instantOff = true // bu cihazda ses bağlamı açılamıyor: bundan sonra oynatıcı
        return playMedia(target)
      },
    )
  } catch {
    instantOff = true
    return playMedia(target)
  }
}

/** Yedek yol: <audio> oynatıcısı (iOS bunu medya sayar). Sonraki dokunuş için kaydı hazırlar. */
function playMedia(target: AudioTarget & { recording: string }): Promise<PlayOutcome> {
  if (!sharedAudio) sharedAudio = new Audio()
  const el = sharedAudio
  el.src = ready.get(target.recording) ?? target.recording
  void preloadRecording(target.recording)
  return el.play().then(
    () => {
      note(target, 'recording', 'oynatıcı')
      return 'recording' as PlayOutcome
    },
    async (e: unknown) => {
      const o = await speakTTS(target.text, target.lang)
      note(target, o, `kayıt çalınamadı: ${String((e as Error)?.name ?? e)}`)
      return o
    },
  )
}

export function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  const s = synth()
  if (!s) return undefined
  const code = getLanguage(lang).ttsLang
  const voices = s.getVoices()
  return voices.find((v) => v.lang === code) ?? voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang))
}

/** Sentetik ses: dokunuşun içinde çağrılmalı. Sonuç: başladı / ses yok / hata (2,5 sn içinde başlamazsa). */
export function speakTTS(text: string, lang: string, rate = 0.9): Promise<PlayOutcome> {
  const s = synth()
  if (!s) return Promise.resolve('failed')
  const u = new SpeechSynthesisUtterance(stripStress(text))
  u.lang = getLanguage(lang).ttsLang
  const v = voiceFor(lang)
  if (v) u.voice = v
  u.rate = rate
  currentUtterance = u
  return new Promise((resolve) => {
    let done = false
    const finish = (o: PlayOutcome) => {
      if (!done) {
        done = true
        resolve(o)
      }
    }
    u.onstart = () => finish(v ? 'tts' : 'tts-no-voice')
    u.onerror = () => finish('failed')
    setTimeout(() => finish(s.speaking ? (v ? 'tts' : 'tts-no-voice') : 'failed'), 2500)
    // Yalnızca gerçekten konuşma varsa durdur (iOS'ta "durdur, hemen konuş" sonraki sesi düşürebiliyor)
    if (s.speaking || s.pending) s.cancel()
    s.speak(u)
  })
}

/** Dokunuşla çağrılır. Önce insan kaydı, olmazsa sentetik ses. */
export function play(target: AudioTarget): Promise<PlayOutcome> {
  prepareSession()
  if (target.recording) {
    const t = { ...target, recording: target.recording }
    const buf = decoded.get(t.recording)
    if (buf && actx && !instantOff) return playInstant(t, buf, actx)
    return playMedia(t)
  }
  return speakTTS(target.text, target.lang).then((o) => {
    note(target, o)
    return o
  })
}

/** Ses testi ekranı için cihaz bilgisi */
export async function voiceReport(waitMs = 2500): Promise<{ supported: boolean; voices: SpeechSynthesisVoice[] }> {
  const s = synth()
  if (!s) return { supported: false, voices: [] }
  let voices = s.getVoices()
  if (voices.length === 0) {
    await new Promise<void>((r) => {
      const t = setTimeout(r, waitMs)
      s.addEventListener?.('voiceschanged', () => {
        clearTimeout(t)
        r()
      })
    })
    voices = s.getVoices()
  }
  return { supported: true, voices }
}
