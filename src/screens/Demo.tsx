import { useMemo, useState } from 'react'
import { useApp } from '../app/context'
import { LANGUAGES } from '../content/languages'
import { Dialog } from '../ui/components'
import { BrandMark } from '../ui/icons'
import { Player } from './Player'
import { demoSteps } from './steps'

// Demo Modu: misafir için ayrı, geçici bir deneyim. Sahibin hiçbir verisine erişmez
// (sahibin veritabanı demo boyunca kapalıdır). Hesap, seviye testi veya profil gerekmez.

export function DemoApp() {
  const { repo, profile, endDemo, restartDemo, session } = useApp()
  const [lang, setLang] = useState<string | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const seed = session.mode === 'guest' ? String(session.startedAt) : 'demo'
  const steps = useMemo(() => (lang ? demoSteps(lang, `${seed}-${lang}`) : []), [lang, seed])

  if (lang) {
    return (
      <>
      <Player
        title="Deneme dersi"
        steps={steps}
        ctx={{ repo, profile, lang, context: 'demo', source: 'lesson' }}
        showNextDue={false}
        finishLabel="Telefonu sahibine ver"
        finishExtra={(results) => (
          <div className="stack">
            <p style={{ fontSize: '1.2em' }}>
              {results.filter((r) => r.correct).length}/{results.filter((r) => r.scored).length} doğru — tebrikler!
            </p>
            <p className="muted small">
              Uygulama gerçek kullanımda bu kelimeleri performansına göre aralıklı tekrar eder, kendi cümlelerini kurdurur ve sektör terimleri öğretir.
            </p>
            <button className="btn" onClick={() => void restartDemo().then(() => setLang(null))}>
              Başka biri için baştan başla
            </button>
          </div>
        )}
        onClose={() => setConfirmExit(true)}
      />
      <DemoExitDialog open={confirmExit} onCancel={() => setConfirmExit(false)} onConfirm={() => void endDemo()} />
      </>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <div className="spread">
        <div className="row">
          <BrandMark size={40} />
          <span className="pill accent">Demo Modu</span>
        </div>
        <button className="btn btn-ghost" onClick={() => setConfirmExit(true)}>Demo'dan çık</button>
      </div>
      <h1>Merhaba! Kısa bir deneme yapalım.</h1>
      <p className="muted">
        Yaklaşık 3–5 dakika: kelimeleri dinle, görsellerle eşleştir. Hesap gerekmez. Burada yaptıkların telefonun sahibinin kayıtlarını değiştirmez ve
        demo bitince silinir.
      </p>
      <h2>Bir dil seç</h2>
      <div className="lang-grid">
        {LANGUAGES.map((l) => (
          <button key={l.code} className="lang-btn" onClick={() => setLang(l.code)}>
            <span className="native">{l.nativeName}</span>
            <span className="small muted">{l.nameTr}</span>
          </button>
        ))}
      </div>
      <DemoExitDialog open={confirmExit} onCancel={() => setConfirmExit(false)} onConfirm={() => void endDemo()} />
    </div>
  )
}

function DemoExitDialog({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onClose={onCancel} title="Demo bitsin mi?">
      <p>Misafir verileri silinecek ve telefonun sahibinin kaldığı yere dönülecek.</p>
      <div className="row">
        <button className="btn" onClick={onCancel}>Devam et</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onConfirm}>Demo'yu bitir</button>
      </div>
    </Dialog>
  )
}
