import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, useAsync } from '../app/context'
import { go, rememberLearningRoute } from '../app/router'
import { content } from '../content/registry'
import type { Sense } from '../content/types'
import { personalSenseMap } from '../domain/services'
import type { StudySession } from '../domain/types'
import { appendRetry, finishSession } from './daily'
import { NextDue, Player, ProductionStep, type PlayerCtx } from './Player'
import { fromDesc, toDesc, type Step } from './steps'

// Günlük oturum: kayıtlı adım tanımlarından kurulur, her adımdan sonra kaydedilir; kapatılırsa kaldığı yerden sürer.

export function SessionScreen({ id }: { id: string }) {
  const { repo } = useApp()
  const data = useAsync(async () => {
    const s = await repo.getSession(id)
    if (!s) return null
    await content.ensureLanguage(s.lang).catch(() => undefined)
    return { s, personal: await personalSenseMap(repo, s.lang) }
  }, [id])
  if (data.loading) {
    return (
      <div className="player">
        <div className="player-body">
          <p className="muted" style={{ padding: 24 }}>Hazırlanıyor…</p>
        </div>
      </div>
    )
  }
  if (!data.data) {
    return (
      <div className="page">
        <p>Bu çalışma bulunamadı.</p>
        <a className="btn btn-primary" href="#/today">Bugün'e dön</a>
      </div>
    )
  }
  return <SessionPlayer key={id} session={data.data.s} personal={data.data.personal} />
}

function SessionPlayer({ session, personal }: { session: StudySession; personal: Map<string, Sense> }) {
  const { repo, profile, bump } = useApp()
  const resolve = (x: string) => content.resolve(x, personal)
  // İçeriği artık bulunamayan adım atlanır; kaldığı yer buna göre kaydırılır
  const hydrated = useMemo(() => {
    const steps: Step[] = []
    let startAt = 0
    session.steps.forEach((d, i) => {
      const st = fromDesc(d, resolve)
      if (!st) return
      if (i < session.index) startAt++
      steps.push(st)
    })
    return { steps, startAt }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])
  const ref = useRef<StudySession>({ ...session, steps: hydrated.steps.map(toDesc), index: hydrated.startAt })
  const [done, setDone] = useState(session.status === 'completed')
  useEffect(() => {
    rememberLearningRoute(`#/session/${session.id}`)
  }, [session.id])

  const ctx: PlayerCtx = { repo, profile, lang: session.lang, context: 'core', source: 'lesson' }
  const close = () => {
    bump()
    go('#/today')
  }

  return (
    <Player
      title={session.kind === 'extra' ? 'Ek çalışma' : 'Bugünkü çalışma'}
      steps={hydrated.steps}
      ctx={ctx}
      startAt={done ? hydrated.steps.length : hydrated.startAt}
      extend={(i, r) => {
        const d = ref.current.steps[i]
        if (!d) return []
        const next = appendRetry(ref.current, d, r.scored ? r.correct : undefined)
        if (next === ref.current) return []
        ref.current = next
        const st = fromDesc(next.steps[next.steps.length - 1], resolve)
        return st ? [st] : []
      }}
      onStep={(next, steps, r) => {
        ref.current = {
          ...ref.current,
          index: next,
          scored: ref.current.scored + (r.scored ? 1 : 0),
          correct: ref.current.correct + (r.scored && r.correct ? 1 : 0),
        }
        if (next >= steps.length) {
          void finishSession(repo, ref.current).then((s) => {
            ref.current = s
            setDone(true)
            rememberLearningRoute(null)
          })
        } else void repo.saveSession(ref.current)
      }}
      onClose={close}
      renderFinish={() => <SessionSummary session={ref.current} ctx={ctx} onClose={close} />}
    />
  )
}

function SessionSummary({ session, ctx, onClose }: { session: StudySession; ctx: PlayerCtx; onClose: () => void }) {
  const [writing, setWriting] = useState(false)
  const [wrote, setWrote] = useState(false)
  const { data: due } = useAsync(async () => {
    const ids = [...new Set(session.steps.map((d) => d.senseId))]
    const out: { sense: Sense; due: number }[] = []
    for (const id of ids) {
      const sense = content.senses.get(id)
      if (!sense) continue
      const skills = await Promise.all((['recognizeText', 'recognizeAudio', 'write'] as const).map((k) => ctx.repo.getSkill(id, k)))
      const dues = skills.filter(Boolean).map((x) => x!.due)
      if (dues.length) out.push({ sense, due: Math.min(...dues) })
    }
    return out.sort((a, b) => a.due - b.due)
  }, [session.id])
  const firstNew = session.newSenseIds.map((id) => content.senses.get(id)).find(Boolean)
  const parts = [
    session.newSenseIds.length ? `${session.newSenseIds.length} yeni kelime` : '',
    session.reviewCount ? `${session.reviewCount} tekrar` : '',
  ].filter(Boolean)

  if (writing && firstNew) {
    return (
      <ProductionStep
        ctx={ctx}
        senses={[firstNew]}
        prompt={firstNew.productionPrompt}
        onDone={() => {
          setWriting(false)
          setWrote(true)
        }}
      />
    )
  }
  return (
    <>
      <h1>{session.kind === 'extra' ? 'Ek çalışma tamamlandı' : 'Bugünkü çalışma tamamlandı'}</h1>
      {parts.length ? <p className="lead">{parts.join(', ')}.</p> : null}
      {session.scored ? (
        <p>
          {session.scored} sorudan {session.correct} tanesi doğru.
          {session.retries ? ' Zorlandığın kelimeler oturum sonunda bir kez daha soruldu.' : ''}
        </p>
      ) : null}
      {firstNew && !wrote ? (
        <div className="optional">
          <p className="small">İstersen öğrendiğin bir kelimeyle kendi cümleni yaz. Bu isteğe bağlıdır.</p>
          <button className="btn btn-soft" onClick={() => setWriting(true)}>
            Bir cümle yaz
          </button>
        </div>
      ) : null}
      {wrote ? <p className="small muted">Cümlen kaydedildi.</p> : null}
      {due?.length ? <NextDue due={due} /> : null}
      <div className="action-bar">
        <button className="btn btn-primary btn-block" onClick={onClose} autoFocus>
          Bitir
        </button>
      </div>
    </>
  )
}
