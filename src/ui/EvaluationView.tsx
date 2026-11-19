import type { Attempt, Evaluation } from '../domain/types'
import { StatusPill } from './components'

const AXES: { key: keyof Evaluation['axes']; label: string }[] = [
  { key: 'grammar', label: 'Dilbilgisi ve yazım' },
  { key: 'taskMeaning', label: 'Görevin istediği anlam' },
  { key: 'targetWord', label: 'Hedef kelime ve doğru anlam' },
  { key: 'naturalness', label: 'Doğallık ve bağlama uygunluk' },
]

/** Dört ekseni ayrı gösterir. Yapılmamış bir değerlendirmeyi asla "doğru" diye göstermez. */
export function EvaluationView({ attempt }: { attempt: Attempt }) {
  const e = attempt.evaluation
  if (!e) return null
  const pending = attempt.evalStatus === 'pending'
  return (
    <div className="stack" aria-live="polite">
      {pending ? (
        <div className="notice">
          <span>
            <b>Değerlendirme bekliyor.</b> Cevabın kaydedildi. Dilbilgisi ve doğallık kontrolü için çevrimiçi değerlendirme gerekiyor; bu
            henüz bağlı değil (sonraki aşama). O yüzden şimdilik "doğru" ya da "yanlış" demiyorum.
          </span>
        </div>
      ) : null}
      <div className="axes">
        {AXES.map(({ key, label }) => {
          const a = e.axes[key]
          return (
            <div className="axis" key={key}>
              <span>{label}</span>
              <StatusPill status={a.status} />
              {a.note ? <span className="note">{a.note}</span> : null}
            </div>
          )
        })}
      </div>
      {e.clarificationQuestion ? (
        <div className="notice warn">
          <span>
            <b>Netleştirme:</b> {e.clarificationQuestion}
          </span>
        </div>
      ) : null}
      {e.corrections.length ? (
        <div className="stack">
          <h3>Düzeltilmesi gerekenler</h3>
          {e.corrections.map((c, i) => (
            <div key={i} className="example">
              <span>
                <s>{c.original}</s> → <b>{c.corrected}</b>
              </span>
              <span className="small muted">{c.explanation}</span>
            </div>
          ))}
          {e.correctedSentence ? <p className="small">Düzeltilmiş hâli: <b>{e.correctedSentence}</b></p> : null}
        </div>
      ) : null}
      {e.suggestions.length ? (
        <div className="stack">
          <h3>İsteğe bağlı öneriler (hata değil)</h3>
          {e.suggestions.map((s, i) => (
            <div key={i} className="example">
              <span>
                {s.original} → <b>{s.suggestion}</b>
              </span>
              <span className="small muted">{s.explanation}</span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="tiny muted">Kontrol eden: {e.provider === 'device-local-v1' ? 'cihaz (yalnızca basit kontroller)' : e.provider}</p>
    </div>
  )
}
