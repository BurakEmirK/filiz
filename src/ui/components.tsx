import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../app/context'
import { GLOSS_SOURCE_LABEL } from '../content/generated'
import { getLanguage } from '../content/languages'
import { content } from '../content/registry'
import type { Example, Sense } from '../content/types'
import type { AxisStatus, ContentReport, Profile } from '../domain/types'
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

export function AudioButton({ text, lang, recording, label = 'Dinle', big = false, showLabel = false }: { text: string; lang: string; recording?: string; label?: string; big?: boolean; showLabel?: boolean }) {
  const [state, setState] = useState<'idle' | 'playing' | 'ok' | 'fail' | 'synthetic' | 'hint'>('idle')
  // Kayıt verilmediyse kelimenin kaydı aranır; dokunma anında yeniden bakılır (paket sonradan yüklenmiş olabilir)
  const findRecording = () => recording ?? content.wordSense(lang, text)?.audio?.url
  useEffect(() => {
    void preloadRecording(findRecording())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, lang, text])
  const onClick = () => {
    setState('playing')
    play({ text, lang, recording: findRecording() }).then((o) => {
      // Cihaz sesi sessiz modda duyulmayabilir: oturumda ilk kez cihaz sesi çalınca bir kez hatırlat
      const hint = o === 'tts' && !ttsHintShown
      if (hint) ttsHintShown = true
      setState(o === 'failed' ? 'fail' : o === 'tts-no-voice' ? 'synthetic' : hint ? 'hint' : 'ok')
    })
  }
  const source = findRecording() ? 'insan sesi kaydı' : 'cihaz sesi'
  return (
    <span className="audio-wrap">
      <button
        type="button"
        className={big ? 'big-audio' : showLabel ? 'btn btn-soft audio-btn' : 'btn btn-soft btn-icon'}
        onClick={onClick}
        aria-label={`${label} (${source})`}
        data-state={state === 'playing' ? 'playing' : undefined}
      >
        <Icon.play />
        {showLabel && !big ? <span aria-hidden="true">{label}</span> : null}
      </button>
      <span className="audio-status" role="status">
        {state === 'fail' ? (
          <a className="tiny" href="#/sound-test">
            Ses çalınamadı. Ses testine bak
          </a>
        ) : null}
        {state === 'synthetic' ? <span className="tiny muted">Bu dilde cihaz sesi yok</span> : null}
        {state === 'hint' ? <span className="tiny muted">Duymuyorsan sessiz modu kapat.</span> : null}
      </span>
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

/** Hedef dildeki yazılış (telaffuz yardımı açıksa Rusça vurgu işaretiyle) */
export function displayForm(sense: Sense, profile: Profile): string {
  const lex = content.lexemes.get(sense.lexemeId)
  const aid = profile.pronunciationAid[sense.lang] ?? 'full'
  return aid !== 'none' && lex?.pronunciation?.stressed ? lex.pronunciation.stressed : (lex?.lemma ?? sense.forms[0])
}

/** Kelime başlığı: hedef dildeki yazılış (sözlük madde başı gibi, serif) ve belirgin "Dinle" düğmesi. */
export function Headword({ sense, profile, size = 'lg', audio = true }: { sense: Sense; profile: Profile; size?: 'lg' | 'md' | 'sm'; audio?: boolean }) {
  const lex = content.lexemes.get(sense.lexemeId)
  return (
    <div className={`headword ${size}`}>
      <span className="word" lang={sense.lang}>
        {displayForm(sense, profile)}
      </span>
      {audio ? <AudioButton text={lex?.lemma ?? sense.forms[0]} lang={sense.lang} recording={sense.audio?.url} showLabel={size !== 'sm'} /> : null}
    </div>
  )
}

/** Tek anlam (seçilen açıklama dilinde) ve kelime türü */
export function GlossLine({ sense, profile }: { sense: Sense; profile: Profile }) {
  return (
    <p className="meaning">
      <span>{content.gloss(sense, profile.explanationLang)}</span>
      {sense.posLabel ? <span className="pos">{sense.posLabel}</span> : null}
    </p>
  )
}

/** Kelimeyi anlamak ve kullanmak için gerekli dilbilgisi (ör. Rusçada cinsiyet) varsayılan kartta görünür. */
export function essentialGrammar(sense: Sense): string | undefined {
  const g = content.lexemes.get(sense.lexemeId)?.grammar
  if (!g) return undefined
  const keep = ['cinsiyet', 'artikel', 'çoğul']
  const parts = Object.entries(g).filter(([k]) => keep.includes(k))
  return parts.length ? parts.map(([k, v]) => `${k}: ${v}`).join(', ') : undefined
}

const TR_SOURCE_NOTE: Record<NonNullable<Example['trSource']>, string> = { human: '', mt: ' (makine çevirisi)', 'en-only': ' (İngilizce çeviri)' }

export function ExampleBox({ text, tr, lang, trSource }: { text: string; tr?: string; lang: string; trSource?: Example['trSource'] }) {
  return (
    <div className="example">
      <div className="example-row">
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

/** "Okunuş ve ayrıntılar": telaffuz yardımları, İngilizce anlam, diğer anlamlar, yakın anlamlılar, dilbilgisi,
 *  kaynak ve lisans. Varsayılan kartı sade tutmak için kapalı başlar. */
export function WordDetails({ sense, profile, onLearnSense, learnedIds, open = false, report = true }: { sense: Sense; profile: Profile; onLearnSense?: (s: Sense) => void; learnedIds?: Set<string>; open?: boolean; report?: boolean }) {
  const lex = content.lexemes.get(sense.lexemeId)
  const pron = lex?.pronunciation
  const others = content.otherSenses(sense)
  const visual = content.visual(sense)
  const info = getLanguage(sense.lang)
  const grammar = lex?.grammar ? Object.entries(lex.grammar).map(([k, v]) => `${k}: ${v}`).join(', ') : ''
  return (
    <details className="details" open={open}>
      <summary>Okunuş ve ayrıntılar</summary>
      <div className="details-body">
        {pron && (pron.translit || pron.approx || pron.ipa) ? (
          <dl className="facts">
            {pron.translit ? (<><dt>Harf çevirisi</dt><dd>{pron.translit}</dd></>) : null}
            {pron.approx ? (<><dt>Yaklaşık söyleyiş</dt><dd>{pron.approx}</dd></>) : null}
            {pron.ipa ? (<><dt>IPA</dt><dd>{pron.ipa}</dd></>) : null}
          </dl>
        ) : null}
        {pron?.note ? <p className="small">{pron.note}</p> : null}
        {info.script === 'Cyrillic' && pron?.stressed ? <p className="small muted">´ işareti vurgulu heceyi gösterir; normal metinlerde yazılmaz.</p> : null}
        {!sense.generated && sense.explanation ? <p className="small">{sense.explanation}</p> : null}
        {sense.generated && sense.glossEn ? (
          <p className="small">
            İngilizce: {sense.glossEn}
            {sense.glossSource && sense.glossSource !== 'en-only' ? <span className="muted"> (Türkçe anlamın kaynağı: {GLOSS_SOURCE_LABEL[sense.glossSource]})</span> : null}
          </p>
        ) : null}
        {grammar ? <p className="small">Dilbilgisi: {grammar}</p> : null}
        {sense.usageNote ? <p className="small">{sense.usageNote}</p> : null}
        {sense.morphology ? <p className="small">Kelime yapısı: {sense.morphology}</p> : null}
        {sense.collocations?.length ? (
          <div className="small">
            <b>Sık birlikte kullanılanlar</b>
            <ul>{sense.collocations.map((c) => <li key={c} lang={sense.lang}>{c}</li>)}</ul>
          </div>
        ) : null}
        {sense.synonyms?.length ? (
          <div className="small">
            <b>Yakın anlamlılar ve farkları</b>
            <ul>
              {sense.synonyms.map((x) => (
                <li key={x.text}>
                  <span lang={sense.lang}>{x.text}</span>: {x.note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {others.length ? (
          <div className="small stack" style={{ gap: 6 }}>
            <b>Bu kelimenin başka anlamları</b>
            <span className="muted">Her anlam ayrı öğrenilir; önce en yaygın anlam öğretilir.</span>
            {others.map((o) => (
              <div className="spread" key={o.id}>
                <span>
                  {o.posLabel ? `(${o.posLabel}) ` : ''}
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
        ) : null}
        <p className="tiny muted">
          {sense.rank ? `Sıklık sırası: ${sense.rank}. ` : ''}
          Kaynak: {sense.source}. Doğrulama: {VALIDATION_LABEL[sense.validation]}.
          {visual?.kind === 'illustration' ? ` Görsel: ${visual.asset.author}.` : visual?.kind === 'emoji' ? ' Görsel: emoji (otomatik eşleşme).' : ''}
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
        {report ? <ReportButton lang={sense.lang} senseId={sense.id} word={content.lemma(sense)} context="kelime kartı" /> : null}
      </div>
    </details>
  )
}

/** Sözlük görünümü (Keşfet › Kelimeler): sade kart + ayrıntılar */
export function SenseDetail({ sense, profile, onLearnSense, learnedIds }: { sense: Sense; profile: Profile; onLearnSense?: (s: Sense) => void; learnedIds?: Set<string> }) {
  const ex = sense.examples
  const grammar = essentialGrammar(sense)
  return (
    <div className="stack">
      <div className="sense-hero">
        <SenseImage sense={sense} />
        <div className="stack" style={{ gap: 6 }}>
          <Headword sense={sense} profile={profile} />
          <GlossLine sense={sense} profile={profile} />
          {grammar ? <p className="small muted">{grammar}</p> : null}
        </div>
      </div>
      {ex.map((e) => (
        <ExampleBox key={e.id} text={e.text} tr={e.tr} lang={sense.lang} trSource={e.trSource} />
      ))}
      <WordDetails sense={sense} profile={profile} onLearnSense={onLearnSense} learnedIds={learnedIds} />
    </div>
  )
}

const ISSUES: { value: ContentReport['issue']; label: string }[] = [
  { value: 'meaning', label: 'Anlam yanlış' },
  { value: 'translation', label: 'Çeviri yanlış' },
  { value: 'example', label: 'Örnek uygun değil' },
  { value: 'audio', label: 'Ses yanlış' },
  { value: 'other', label: 'Başka' },
]

/** Şüpheli içeriği bildir. Bildirim yalnızca bu cihazda saklanır; hiçbir yere gönderilmez. */
export function ReportButton({ lang, senseId, word, context }: { lang: string; senseId?: string; word: string; context: string }) {
  const { repo, session } = useApp()
  const [open, setOpen] = useState(false)
  const [issue, setIssue] = useState<ContentReport['issue']>('meaning')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const guest = session.mode === 'guest'
  const save = async () => {
    await repo.addReport({ lang, senseId, word, issue, note: note.trim(), context })
    setSaved(true)
  }
  const close = () => {
    setOpen(false)
    setSaved(false)
    setNote('')
  }
  return (
    <>
      <button type="button" className="btn btn-ghost btn-small" onClick={() => setOpen(true)}>
        <Icon.flag /> Bu içerikte sorun var
      </button>
      <Dialog open={open} onClose={close} title="İçerik sorunu bildir">
        {saved ? (
          <>
            <p>Bildirimin kaydedildi.</p>
            <p className="small muted">
              {guest ? 'Demo bitince misafir verileriyle birlikte silinir.' : 'Profil › Yardım › İçerik bildirimlerim bölümünde görebilir ve kopyalayabilirsin.'}
            </p>
            <button className="btn btn-primary" onClick={close}>Tamam</button>
          </>
        ) : (
          <>
            <p>
              <b lang={lang}>{word}</b> <span className="muted small">({context})</span>
            </p>
            <div className="field">
              <span className="label">Sorun ne?</span>
              <Chips label="Sorun türü" values={[issue]} options={ISSUES} onToggle={(v) => setIssue(v as ContentReport['issue'])} />
            </div>
            <div className="field">
              <label htmlFor="report-note">Not (isteğe bağlı)</label>
              <textarea id="report-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. doğru çeviri: Bu asla bitmeyecek." />
            </div>
            <p className="small muted">
              Bildirim yalnızca bu cihazda saklanır, hiçbir yere gönderilmez. Düzeltilmesi için listeyi kopyalayıp geliştiriciye iletebilirsin.
            </p>
            <button className="btn btn-primary" onClick={() => void save()}>Bildirimi kaydet</button>
          </>
        )}
      </Dialog>
    </>
  )
}

/** Gezinme satırı: başlık, kısa açıklama, sağda ok */
export function LinkRow({ href, title, detail, icon, onClick }: { href?: string; title: ReactNode; detail?: ReactNode; icon?: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      {icon ? <span className="row-icon" aria-hidden="true">{icon}</span> : null}
      <span className="grow">
        <span className="row-title">{title}</span>
        {detail ? <span className="row-detail">{detail}</span> : null}
      </span>
      <span className="chev" aria-hidden="true"><Icon.chevron /></span>
    </>
  )
  return href ? (
    <a className="link-row" href={href}>{inner}</a>
  ) : (
    <button type="button" className="link-row" onClick={onClick}>{inner}</button>
  )
}

/** Alt sayfalarda üst bölüme dönüş */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="back-link" href={href}>
      <Icon.back /> {label}
    </a>
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
