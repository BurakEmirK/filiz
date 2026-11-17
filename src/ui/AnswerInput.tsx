import { useEffect, useRef, useState } from 'react'
import { getLanguage } from '../content/languages'
import { prepareAnswer, type PreparedAnswer } from '../domain/services'
import { Icon } from './icons'

// Cevap girişi: klavye veya el yazısı (iPad + Apple Pencil, Scribble).
// El yazısı modunda iPadOS yazıyı metne çevirir; kullanıcı tanınan metni kontrol edip düzeltmeden değerlendirme yapılmaz.
// Tanıma düzeltmeleri dil hatası sayılmaz.

const MODE_KEY = 'filiz.inputMode'

function readMode(): 'keyboard' | 'handwriting' {
  try {
    return localStorage.getItem(MODE_KEY) === 'handwriting' ? 'handwriting' : 'keyboard'
  } catch {
    return 'keyboard'
  }
}

export function AnswerInput({
  lang,
  multiline = false,
  placeholder,
  submitLabel = 'Kontrol et',
  onSubmit,
  disabled,
  autoFocus = true,
}: {
  lang: string
  multiline?: boolean
  placeholder?: string
  submitLabel?: string
  onSubmit: (a: PreparedAnswer) => void
  disabled?: boolean
  autoFocus?: boolean
}) {
  const info = getLanguage(lang)
  const [mode, setMode] = useState<'keyboard' | 'handwriting'>(readMode)
  const [text, setText] = useState('')
  const [stage, setStage] = useState<'write' | 'confirm'>('write')
  const [confirmed, setConfirmed] = useState('')
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus && mode === 'keyboard') inputRef.current?.focus({ preventScroll: true })
  }, [autoFocus, mode])

  const switchMode = (m: 'keyboard' | 'handwriting') => {
    setMode(m)
    setStage('write')
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      /* yok say */
    }
  }

  // Öğrencinin cevabını otomatik düzeltme/büyük harf değiştirmesin
  const common = {
    lang,
    autoCorrect: 'off',
    autoCapitalize: 'none',
    spellCheck: false,
    autoComplete: 'off',
    disabled,
    'aria-label': placeholder ?? 'Cevabın',
  } as const

  if (mode === 'handwriting' && stage === 'confirm') {
    return (
      <div className="stack">
        <div className="notice">
          <span>
            iPad yazını şöyle tanıdı. Yanlış tanınan harfleri düzelt — <b>tanıma hataları dil hatası sayılmaz</b>. Sonra değerlendirmeye gönder.
          </span>
        </div>
        <div className="field">
          <label htmlFor="confirm-text">Tanınan metin</label>
          {multiline ? (
            <textarea id="confirm-text" className="input" value={confirmed} onChange={(e) => setConfirmed(e.target.value)} {...common} />
          ) : (
            <input id="confirm-text" className="input" value={confirmed} onChange={(e) => setConfirmed(e.target.value)} {...common} />
          )}
        </div>
        <div className="row">
          <button className="btn" onClick={() => setStage('write')}>
            Geri
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={!confirmed.trim() || disabled}
            onClick={() => onSubmit(prepareAnswer({ inputMode: 'handwriting', recognized: text, confirmed }))}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    )
  }

  const submit = () => {
    if (!text.trim()) return
    if (mode === 'handwriting') {
      setConfirmed(text)
      setStage('confirm')
    } else onSubmit(prepareAnswer({ inputMode: 'keyboard', text }))
  }

  return (
    <div className="stack">
      <div className="spread">
        <div className="seg" role="group" aria-label="Giriş yöntemi">
          <button type="button" aria-pressed={mode === 'keyboard'} onClick={() => switchMode('keyboard')}>
            <span className="row" style={{ gap: 6 }}>
              <Icon.keyboard /> Klavye
            </span>
          </button>
          <button type="button" aria-pressed={mode === 'handwriting'} onClick={() => switchMode('handwriting')}>
            <span className="row" style={{ gap: 6 }}>
              <Icon.pen /> El yazısı
            </span>
          </button>
        </div>
      </div>
      {mode === 'handwriting' ? (
        info.scribble ? (
          <p className="tiny muted">
            iPad'de Apple Pencil ile doğrudan kutunun içine yaz; iPadOS yazını metne çevirir (Scribble). {info.nameTr} için iPad klavye ayarlarında {info.nameTr} klavyesi ekli olmalı. iPhone'da bu mod klavyeyle aynı çalışır.
          </p>
        ) : (
          <div className="notice warn">
            <span>
              Apple'ın Scribble özelliği {info.nameTr} dilini desteklemiyor; yazın yanlış tanınabilir. Klavye kullanman önerilir. Tanınan metni bir sonraki adımda düzeltebilirsin.
            </span>
          </div>
        )
      ) : null}
      {multiline || mode === 'handwriting' ? (
        <textarea
          ref={inputRef}
          className={`input ${mode === 'handwriting' ? 'handwriting' : ''}`}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          {...common}
        />
      ) : (
        <input
          ref={inputRef}
          className="input"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          {...common}
        />
      )}
      <button className="btn btn-primary btn-block" disabled={!text.trim() || disabled} onClick={submit}>
        {mode === 'handwriting' ? 'Tanınan metni kontrol et' : submitLabel}
      </button>
    </div>
  )
}
