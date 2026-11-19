import { getLanguage } from '../content/languages'
import { stripStress } from '../domain/text'

// Ses sistemi
// 1) İnsan sesi kaydı varsa (Vikisözlük / Wikimedia Commons, çoğu Lingua Libre) o çalınır.
//    Kayıt alıştırma açılırken önceden indirilir ve cihazda saklanır; sonra internetsiz de çalar.
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
const ready = new Map<string, string>() // kayıt adresi → yerel nesne adresi (blob)
const pending = new Map<string, Promise<void>>()
let sharedAudio: HTMLAudioElement | null = null
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

/** Kaydı arka planda indirip saklar (alıştırma açılınca çağrılır). Hata olursa sessizce akışa (stream) düşer. */
export function preloadRecording(url?: string): Promise<void> {
  if (!url || ready.has(url) || typeof window === 'undefined') return Promise.resolve()
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
        ready.set(url, URL.createObjectURL(await res.blob()))
      } catch {
        /* CORS veya ağ hatası: çalarken doğrudan adresten denenecek */
      }
    })()
    pending.set(url, p)
  }
  return p
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
    if (!sharedAudio) sharedAudio = new Audio()
    const el = sharedAudio
    el.src = ready.get(target.recording) ?? target.recording
    const p = el.play()
    return p.then(
      () => {
        note(target, 'recording')
        return 'recording' as PlayOutcome
      },
      async (e: unknown) => {
        const o = await speakTTS(target.text, target.lang)
        note(target, o, `kayıt çalınamadı: ${String((e as Error)?.name ?? e)}`)
        return o
      },
    )
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
