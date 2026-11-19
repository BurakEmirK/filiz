import { useEffect, useRef, useState, type ReactNode } from 'react'
import { GLOSS_SOURCE_LABEL } from '../content/generated'
import { getLanguage } from '../content/languages'
import { content } from '../content/registry'
import type { Example, Sense } from '../content/types'
import type { AxisStatus, Profile } from '../domain/types'
import { play, preloadRecording } from './audio'
import { Icon } from './icons'
import { Illustration } from './illustrations'

export function Card({ children, className = '', title, icon, action }: { children?: ReactNode; className?: string; title?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <div className="spread">
          <div className="card-title">
            {icon ? <span className="icon-badge">{icon}</span> : null}
            <h2>{title}</h2>
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chips({ values, options, onToggle, label }: { values: string[]; options: { value: string; label: string }[]; onToggle: (v: string) => void; label: string }) {
  return (
    <div className="row" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="chip" aria-pressed={values.includes(o.value)} onClick={() => onToggle(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

const STATUS_TEXT: Record<AxisStatus, string> = { pass: 'Uygun', fail: 'Sorun var', uncertain: 'Emin değilim', notApplicable: 'Uygulanmaz', pending: 'Bekliyor' }
const STATUS_CLASS: Record<AxisStatus, string> = { pass: 'good', fail: 'bad', uncertain: 'warn', notApplicable: '', pending: 'info' }
export function StatusPill({ status }: { status: AxisStatus }) {
  return <span className={`pill ${STATUS_CLASS[status]}`}>{STATUS_TEXT[status]}</span>
}

/** Ses düğmesi: her zaman görünür. Önce insan kaydı, yoksa cihaz sesi. Çalmazsa bunu açıkça söyler. */
let ttsHintShown = false

export function AudioButton({ text, lang, recording, label = 'Dinle', big = false }: { text: string; lang: string; recording?: string; label?: string; big?: boolean }) {
  const [state, setState] = useState<'idle' | 'fail' | 'synthetic' | 'hint'>('idle')
  // Kayıt verilmediyse kelimenin kaydı aranır; dokunma anında yeniden bakılır (paket sonradan yüklenmiş olabilir)
  const findRecording = () => recording ?? content.wordSense(lang, text)?.audio?.url
  useEffect(() => {
    void preloadRecording(findRecording())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, lang, text])
  const onClick = () => {
    play({ text, lang, recording: findRecording() }).then((o) => {
      // Cihaz sesi sessiz modda duyulmayabilir: oturumda ilk kez cihaz sesi çalınca bir kez hatırlat
      const hint = o === 'tts' && !ttsHintShown
      if (hint) ttsHintShown = true
      setState(o === 'failed' ? 'fail' : o === 'tts-no-voice' ? 'synthetic' : hint ? 'hint' : 'idle')
    })
  }
  return (
    <span className="audio-wrap">
      <button type="button" className={big ? 'big-audio' : 'btn btn-soft btn-icon'} onClick={onClick} aria-label={`${label} (${findRecording() ? 'insan sesi kaydı' : 'cihaz sesi'})`}>
        <Icon.play />
      </button>
      {state === 'fail' ? (
        <a className="tiny" href="#/sound-test">
          Ses çalınamadı · Ses testi
        </a>
      ) : null}
      {state === 'synthetic' ? <span className="tiny muted">Bu dilde cihaz sesi bulunamadı</span> : null}
      {state === 'hint' ? <span className="tiny muted">Duymuyorsan sessiz modu kapatmayı dene.</span> : null}
    </span>
  )
}

/** Anlamın görseli: elle çizilmiş illüstrasyon veya (açık veride) anlamla eşleşen emoji */
export function SenseImage({ sense, size }: { sense: Sense; size?: number }) {
  const v = content.visual(sense)
  if (!v) return null
  if (v.kind === 'illustration') return <Illustration name={v.asset.render} alt={v.asset.alt} size={size} />
  return (
    <div className="plate emoji" style={size ? { width: size, height: size } : { aspectRatio: '1' }} role="img" aria-label={`${content.gloss(sense)} (emoji)`}>
      <span aria-hidden="true">{v.char}</span>
    </div>
  )
}

/** Kelime başlığı: hedef dildeki yazılış her zaman görünür; telaffuz yardımları ayara göre azalır. */
export function WordHeader({ sense, profile, showGloss = true, small = false }: { sense: Sense; profile: Profile; showGloss?: boolean; small?: boolean }) {
  const lex = content.lexemes.get(sense.lexemeId)
  const lang = getLanguage(sense.lang)
  const aid = profile.pronunciationAid[sense.lang] ?? 'full'
  const pron = lex?.pronunciation
  const display = aid !== 'none' && pron?.stressed ? pron.stressed : (lex?.lemma ?? sense.forms[0])
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row">
        <span className={small ? 'word-sm' : 'word'} lang={sense.lang}>
          {display}
        </span>
        <AudioButton text={lex?.lemma ?? sense.forms[0]} lang={sense.lang} recording={sense.audio?.url} />
      </div>
      {aid === 'full' && pron && (pron.translit || pron.approx || pron.ipa) ? (
        <div className="pron">
          {pron.translit ? (
            <span>
              Harf çevirisi: <b>{pron.translit}</b>
            </span>
          ) : null}
          {pron.approx ? (
            <span>
              Yaklaşık söyleyiş: <b>{pron.approx}</b>
            </span>
          ) : null}
          {pron.ipa && !small ? (
            <span>
              IPA: <b>{pron.ipa}</b>
            </span>
          ) : null}
        </div>
      ) : null}
      {aid === 'full' && pron?.note && !small ? <p className="tiny muted">{pron.note}</p> : null}
      {lang.script === 'Cyrillic' && aid !== 'none' && pron?.stressed && !small ? <p className="tiny muted">´ işareti vurgulu heceyi gösterir; normal metinlerde yazılmaz.</p> : null}
      {showGloss ? <GlossLine sense={sense} profile={profile} /> : null}
    </div>
  )
}

/** Türkçe anlam + (açık veride) İngilizce anlam ve Türkçenin kaynağı */
export function GlossLine({ sense, profile }: { sense: Sense; profile: Profile }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <p style={{ fontSize: '1.1em' }}>
        {sense.posLabel ? <span className="pill" style={{ marginRight: 6 }}>{sense.posLabel}</span> : null}
        {content.gloss(sense, profile.explanationLang)}
      </p>
      {sense.generated && profile.explanationLang === 'tr' && sense.glossEn ? (
        <p className="tiny muted">
          İngilizce: {sense.glossEn}
          {sense.glossSource && sense.glossSource !== 'en-only' ? ` · Türkçe: ${GLOSS_SOURCE_LABEL[sense.glossSource]}` : ''}
        </p>
      ) : null}
    </div>
  )
}

const TR_SOURCE_NOTE: Record<NonNullable<Example['trSource']>, string> = { human: '', mt: ' (makine çevirisi)', 'en-only': ' (İngilizce çeviri)' }

export function ExampleBox({ text, tr, lang, trSource }: { text: string; tr?: string; lang: string; trSource?: Example['trSource'] }) {
  return (
    <div className="example">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <span className="t" lang={lang}>
          {text}
        </span>
        <AudioButton text={text} lang={lang} label="Cümleyi dinle" />
      </div>
      {tr ? (
        <span className="muted small">
          {tr}
          {trSource ? TR_SOURCE_NOTE[trSource] : ''}
        </span>
      ) : null}
    </div>
  )
}

const VALIDATION_LABEL: Record<Sense['validation'], string> = {
  'ai-draft': 'yapay zekâ taslağı (uzman doğrulaması yok)',
  'open-data': 'açık veriden otomatik işlendi (uzman doğrulaması yok)',
  'self-checked': 'kendin kontrol ettin',
  'expert-reviewed': 'uzman onaylı',
}

/** Bir anlamın tam kartı: görsel, açıklama, örnekler, eşdizimler, eşanlamlılar, diğer anlamlar, kaynak. */
export function SenseDetail({ sense, profile, onLearnSense, learnedIds }: { sense: Sense; profile: Profile; onLearnSense?: (s: Sense) => void; learnedIds?: Set<string> }) {
  const visual = content.visual(sense)
  const others = content.otherSenses(sense)
  const lex = content.lexemes.get(sense.lexemeId)
  return (
    <div className="stack">
      <div className="sense-hero">
        {visual ? <SenseImage sense={sense} /> : <div />}
        <WordHeader sense={sense} profile={profile} />
      </div>
      {!sense.generated && sense.explanation ? <p>{sense.explanation}</p> : null}
      {lex?.grammar ? (
        <p className="small muted">
          {Object.entries(lex.grammar)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' · ')}
        </p>
      ) : null}
      {sense.examples.map((e) => (
        <ExampleBox key={e.id} text={e.text} tr={e.tr} lang={sense.lang} trSource={e.trSource} />
      ))}
      {sense.collocations?.length ? (
        <div>
          <h3>Sık birlikte kullanılanlar</h3>
          <ul className="small">{sense.collocations.map((c) => <li key={c} lang={sense.lang}>{c}</li>)}</ul>
        </div>
      ) : null}
      {sense.synonyms?.length ? (
        <div>
          <h3>Yakın anlamlılar ve farkları</h3>
          <ul className="small">
            {sense.synonyms.map((s) => (
              <li key={s.text}>
                <b lang={sense.lang}>{s.text}</b> — {s.note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {sense.usageNote ? <div className="notice">{sense.usageNote}</div> : null}
      {sense.morphology ? <p className="small"><b>Kelime yapısı:</b> {sense.morphology}</p> : null}
      {others.length ? (
        <div className="notice warn">
          <div className="stack" style={{ gap: 6 }}>
            <span>Bu kelimenin başka anlamları da var. Her anlam ayrı izlenir; önce yaygın anlam öğretilir.</span>
            {others.map((o) => (
              <div className="spread" key={o.id}>
                <span>
                  {o.senseIndex}. {o.posLabel ? `(${o.posLabel}) ` : ''}
                  {content.gloss(o)}
                </span>
                {onLearnSense && !learnedIds?.has(o.id) ? (
                  <button className="btn btn-soft" onClick={() => onLearnSense(o)}>
                    Bu anlamı da öğren
                  </button>
                ) : learnedIds?.has(o.id) ? (
                  <span className="pill good">Tekrarda</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <p className="tiny muted">
        {sense.rank ? `Sıklık sırası #${sense.rank} · ` : sense.level ? `Seviye ${sense.level} · ` : ''}
        Kaynak: {sense.source} · Doğrulama: {VALIDATION_LABEL[sense.validation]}
        {visual?.kind === 'illustration' ? ` · Görsel: ${visual.asset.author}` : visual?.kind === 'emoji' ? ' · Görsel: emoji (otomatik eşleşme)' : ''}
      </p>
      {sense.audio ? (
        <p className="tiny muted">
          Ses kaydı:{' '}
          <a href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(sense.audio.file)}`} target="_blank" rel="noreferrer">
            {sense.audio.file}
          </a>{' '}
          (Wikimedia Commons; lisans dosya sayfasında)
        </p>
      ) : null}
    </div>
  )
}

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Kapat">
            <Icon.close />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function LangSwitcher({ value, options, onChange }: { value: string; options: string[]; onChange: (lang: string) => void }) {
  return (
    <label className="row small" style={{ gap: 8 }}>
      <span className="sr-only">Hedef dil</span>
      <select className="input" style={{ minHeight: 40, width: 'auto', fontWeight: 650 }} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((l) => (
          <option key={l} value={l}>
            {getLanguage(l).nameTr}
          </option>
        ))}
      </select>
    </label>
  )
}
