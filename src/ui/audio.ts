import { useEffect, useState } from 'react'
import { getLanguage } from '../content/languages'
import { stripStress } from '../domain/text'

// Model ses: Aşama 1'de cihazın konuşma sentezi (TTS) kullanılır. Bu SENTETİK bir sestir;
// kalitesi ve dil desteği cihaza göre değişir. İnsan kaydı veya bulut TTS sonraki aşamalarda değerlendirilecek.

function synth(): SpeechSynthesis | undefined {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined
}

export function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  const s = synth()
  if (!s) return undefined
  const code = getLanguage(lang).ttsLang
  const voices = s.getVoices()
  return voices.find((v) => v.lang === code) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang))
}

/** Metni seslendirir. Ses yoksa false döner (arayüz bunu açıkça gösterir). */
export function speak(text: string, lang: string, rate = 0.9): boolean {
  const s = synth()
  if (!s) return false
  const u = new SpeechSynthesisUtterance(stripStress(text))
  u.lang = getLanguage(lang).ttsLang
  const v = voiceFor(lang)
  if (v) u.voice = v
  u.rate = rate
  s.cancel()
  s.speak(u)
  return Boolean(v)
}

/** Cihazda bu dil için ses olup olmadığını izler (ses listesi gecikmeli yüklenir). */
export function useVoice(lang: string): { available: boolean; checked: boolean } {
  const [state, setState] = useState(() => ({ available: Boolean(voiceFor(lang)), checked: Boolean(synth()?.getVoices().length) }))
  useEffect(() => {
    const s = synth()
    if (!s) {
      setState({ available: false, checked: true })
      return
    }
    const update = () => setState({ available: Boolean(voiceFor(lang)), checked: s.getVoices().length > 0 })
    update()
    s.addEventListener?.('voiceschanged', update)
    const t = setTimeout(() => setState((p) => ({ ...p, checked: true })), 1500)
    return () => {
      s.removeEventListener?.('voiceschanged', update)
      clearTimeout(t)
    }
  }, [lang])
  return state
}
