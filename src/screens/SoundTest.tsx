import { useEffect, useState } from 'react'
import { useApp } from '../app/context'
import { go } from '../app/router'
import { LANGUAGES } from '../content/languages'
import { content } from '../content/registry'
import { audioLog, play, preloadRecording, speakTTS, voiceReport, voiceFor, type PlayOutcome } from '../ui/audio'
import { Card } from '../ui/components'
import { Icon } from '../ui/icons'

// Ses testi: telefonda hangi dillerde cihaz sesi ve insan kaydı çalıştığını gösterir.
// "Raporu kopyala" ile sonuç bana gönderilebilir; tahmin yerine gerçek cihaz bilgisiyle çalışırız.

const SAMPLE: Record<string, string> = { ru: 'вода', hu: 'víz', fr: 'eau', es: 'agua', en: 'water', tr: 'su' }
const OUTCOME_TR: Record<PlayOutcome, string> = {
  recording: 'insan kaydı çaldı',
  tts: 'cihaz sesi çaldı',
  'tts-no-voice': 'ses çaldı ama bu dile uygun ses yok',
  failed: 'çalmadı',
}

function standalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function SoundTestScreen() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(null)
  const [supported, setSupported] = useState(true)
  const [results, setResults] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    voiceReport().then((r) => {
      setSupported(r.supported)
      setVoices(r.voices)
    })
  }, [])

  /** Örnek kelime: tercihen SAMPLE'daki kelime, kaydı yoksa kaydı olan en sık kelime */
  const sampleFor = (lang: string): { text: string; recording?: string } => {
    const withAudio = [...content.senses.values()].filter((s) => s.lang === lang && s.senseIndex === 1 && s.audio)
    const pick = withAudio.find((s) => content.lemma(s) === SAMPLE[lang]) ?? withAudio.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))[0]
    return pick ? { text: content.lemma(pick), recording: pick.audio!.url } : { text: SAMPLE[lang] }
  }
  const recordingFor = (lang: string) => sampleFor(lang).recording
  const { profile } = useApp()
  const [, setLoadedTick] = useState(0)
  useEffect(() => {
    // Yalnızca öğrendiğin dillerin kelime paketi yüklenir (gereksiz veri indirmemek için)
    for (const code of profile.targetLanguages)
      void content
        .ensureLanguage(code)
        .then(() => preloadRecording(recordingFor(code)))
        .then(() => setLoadedTick((t) => t + 1))
        .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.targetLanguages])

  const run = (key: string, p: Promise<PlayOutcome>) => {
    setResults((r) => ({ ...r, [key]: 'deneniyor…' }))
    p.then((o) => setResults((r) => ({ ...r, [key]: OUTCOME_TR[o] })))
  }

  const report = [
    `Filiz ses testi · ${new Date().toISOString()}`,
    `Tarayıcı: ${navigator.userAgent}`,
    `Ana ekran uygulaması: ${standalone() ? 'evet' : 'hayır (Safari sekmesi)'}`,
    `Konuşma sentezi: ${supported ? 'var' : 'yok'} · ses sayısı: ${voices?.length ?? '?'}`,
    ...LANGUAGES.map((l) => {
      const v = voiceFor(l.code)
      return `${l.code}: cihaz sesi ${v ? `${v.name} (${v.lang})` : 'yok'} · insan kaydı ${recordingFor(l.code) ? 'var' : 'yok'} · test: ${results[`tts-${l.code}`] ?? '-'} / ${results[`rec-${l.code}`] ?? '-'}`
    }),
    'Son çalma denemeleri:',
    ...audioLog.slice(0, 10).map((e) => `  ${new Date(e.at).toLocaleTimeString()} ${e.lang} "${e.text}" → ${e.outcome}${e.detail ? ` (${e.detail})` : ''}`),
  ].join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="btn btn-ghost" onClick={() => go('#/me')}>
            <Icon.back /> Ben
          </button>
          <h1>Ses testi</h1>
          <p>Her dil için iki düğme var: cihazın sentetik sesi ve (varsa) insan sesi kaydı.</p>
        </div>
      </div>
      <Card>
        <p className="small">
          Ana ekran uygulaması: <b>{standalone() ? 'evet' : 'hayır (Safari sekmesinde açılmış)'}</b> · Konuşma sentezi: <b>{supported ? 'var' : 'yok'}</b> · Bulunan ses:{' '}
          <b>{voices === null ? 'yükleniyor…' : voices.length}</b>
        </p>
        <div className="list">
          {LANGUAGES.map((l) => {
            const v = voices ? voiceFor(l.code) : undefined
            const rec = recordingFor(l.code)
            return (
              <div className="list-item" key={l.code} style={{ flexWrap: 'wrap' }}>
                <span className="grow">
                  <b>{l.nameTr}</b> <span className="muted small">· cihaz sesi: {v ? `${v.name}` : voices ? 'bulunamadı' : '…'}</span>
                  <div className="tiny muted">
                    {results[`tts-${l.code}`] ? `Cihaz sesi: ${results[`tts-${l.code}`]}` : ''} {results[`rec-${l.code}`] ? ` · Kayıt: ${results[`rec-${l.code}`]}` : ''}
                  </div>
                </span>
                <button className="btn btn-soft" onClick={() => run(`tts-${l.code}`, speakTTS(SAMPLE[l.code], l.code))}>
                  Cihaz sesi
                </button>
                <button className="btn btn-soft" disabled={!rec} onClick={() => run(`rec-${l.code}`, play({ text: sampleFor(l.code).text, lang: l.code, recording: rec }))}>
                  İnsan kaydı
                </button>
              </div>
            )
          })}
        </div>
      </Card>
      <Card title="Ses çıkmıyorsa">
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Telefonun sessiz modda olmadığından ve ses seviyesinin açık olduğundan emin ol.</li>
          <li>Bir dilin cihaz sesi yoksa: Ayarlar → Erişilebilirlik → Seslendirilen İçerik → Sesler → dili seçip bir ses indir.</li>
          <li>İnsan kayıtları ilk çalmada internetten (Wikimedia) iner, sonra cihazda saklanır.</li>
        </ul>
      </Card>
      <Card title="Rapor">
        <textarea className="input report" readOnly value={report} aria-label="Ses testi raporu" />
        <button className="btn btn-primary" onClick={copy}>
          {copied ? 'Kopyalandı' : 'Raporu kopyala'}
        </button>
        <p className="tiny muted">Raporu kopyalayıp bana yapıştırırsan sorunu gerçek cihaz bilgisiyle çözebilirim. Raporda kişisel veri yok.</p>
      </Card>
    </div>
  )
}
