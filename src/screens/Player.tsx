import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { content } from '../content/registry'
import { soundItem } from '../content/sounds'
import type { Sense, TaskSpec } from '../content/types'
import type { Repository } from '../data/repo'
import type { ClosedCheck } from '../domain/evaluation'
import { formatDue } from '../domain/planner'
import { GRADE_LABEL } from '../domain/scheduler'
import { submitChoice, submitClosed, submitProduction, submitSelfRating, type PreparedAnswer } from '../domain/services'
import type { Attempt, Grade, Profile, Skill } from '../domain/types'
import { AnswerInput } from '../ui/AnswerInput'
import { play, preloadRecording } from '../ui/audio'
import { AudioButton, ExampleBox, GlossLine, Progress, SenseImage, WordHeader } from '../ui/components'
import { EvaluationView } from '../ui/EvaluationView'
import { Icon } from '../ui/icons'
import { TraceCanvas } from '../ui/TraceCanvas'
import { acceptedForWord, findCloze, stepSenseIds, type Step } from './steps'

export interface PlayerCtx {
  repo: Repository
  profile: Profile
  lang: string
  context: Attempt['context']
  industryId?: string
  source: 'lesson' | 'review' | 'error-practice' | 'collection'
  /** Seviye kontrolü / "biliyorum" kontrolünde yalnızca tanınan kelimeler tekrar planına alınır */
  recordOnlyCorrect?: boolean
}

export interface StepResult {
  scored: boolean
  correct?: boolean
  senseIds: string[]
}

interface StepProps<S extends Step> {
  step: S
  ctx: PlayerCtx
  onDone: (r: StepResult) => void
}

function Continue({ onClick, label = 'Devam' }: { onClick: () => void; label?: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => ref.current?.focus({ preventScroll: true }), [])
  return (
    <button ref={ref} className="btn btn-primary btn-block" onClick={onClick}>
      {label}
    </button>
  )
}

function IntroStep({ step, ctx, onDone }: StepProps<Extract<Step, { kind: 'intro' }>>) {
  const s = step.sense
  const ex = s.examples[0]
  return (
    <>
      <p className="muted small">Yeni kelime{s.rank ? ` · sıklık sırası #${s.rank}` : ''}</p>
      <div className="sense-hero">
        <SenseImage sense={s} />
        <WordHeader sense={s} profile={ctx.profile} />
      </div>
      {!s.generated && s.explanation ? <p>{s.explanation}</p> : null}
      {ex ? <ExampleBox text={ex.text} tr={ex.tr} lang={s.lang} trSource={ex.trSource} /> : null}
      {s.usageNote ? <div className="notice">{s.usageNote}</div> : null}
      {content.otherSenses(s).length && s.senseIndex === 1 ? (
        <p className="tiny muted">Bu kelimenin başka anlamları da var; şimdi en yaygın anlamı öğreniyorsun.</p>
      ) : null}
      <Continue onClick={() => onDone({ scored: false, senseIds: [s.id] })} />
    </>
  )
}

/** Dinleme modunda: büyük dinle düğmesi (kendiliğinden çalmaz). Ses çalmazsa okuyarak devam edilebilir. */
function useListenMode(sense: Sense, mode: 'audio' | 'text') {
  const [audioOk, setAudioOk] = useState(true)
  const [readInstead, setReadInstead] = useState(false)
  useEffect(() => {
    void preloadRecording(sense.audio?.url)
  }, [sense.audio?.url])
  const listening = mode === 'audio' && !readInstead
  const listen = () => {
    play({ text: content.lemma(sense), lang: sense.lang, recording: sense.audio?.url }).then((o) => setAudioOk(o !== 'failed'))
  }
  const skill: Skill = listening ? 'recognizeAudio' : 'recognizeText'
  const header = listening ? (
    <>
      <button className="big-audio" onClick={listen} aria-label={`Kelimeyi dinle (${sense.audio ? 'insan sesi kaydı' : 'cihaz sesi'})`}>
        <Icon.play />
      </button>
      <p className="tiny muted" style={{ textAlign: 'center' }}>
        {sense.audio ? 'İnsan sesi kaydı' : 'Cihaz sesi (sentetik)'} · Dinlemek için dokun
      </p>
      {!audioOk ? (
        <div className="notice warn">
          <span>
            Ses çalınamadı.{' '}
            <button className="btn btn-ghost" onClick={() => setReadInstead(true)}>
              Okuyarak devam et
            </button>
          </span>
        </div>
      ) : (
        <button className="btn btn-ghost" style={{ justifySelf: 'center' }} onClick={() => setReadInstead(true)}>
          Ses çalmıyor mu? Okuyarak devam et
        </button>
      )}
    </>
  ) : (
    <div className="word" lang={sense.lang} style={{ textAlign: 'center' }}>
      {content.lexemes.get(sense.lexemeId)?.pronunciation?.stressed ?? content.lemma(sense)}
    </div>
  )
  return { listening, skill, header }
}

function ChooseStep({ step, ctx, onDone }: StepProps<Extract<Step, { kind: 'choose' }>>) {
  const s = step.sense
  const { listening, skill, header } = useListenMode(s, step.mode)
  const [picked, setPicked] = useState<string | null>(null)
  const t0 = useRef(Date.now())
  const pick = async (o: Sense) => {
    if (picked) return
    setPicked(o.id)
    if (ctx.recordOnlyCorrect && o.id !== s.id) return
    await submitChoice(ctx.repo, {
      lang: s.lang, sense: s, skill, exerciseType: listening ? 'listen-choose' : 'choose-image', prompt: content.lemma(s), correct: o.id === s.id,
      elapsedMs: Date.now() - t0.current, context: ctx.context, industryId: ctx.industryId, source: ctx.source === 'review' ? 'review' : 'lesson',
      desiredRetention: ctx.profile.desiredRetention,
    })
  }
  const correct = picked === s.id
  return (
    <>
      <p className="muted small">{listening ? 'Dinle ve doğru görseli seç' : 'Kelimenin anlamına uyan görseli seç'}</p>
      {header}
      <div className="choices four">
        {step.options.map((o) => {
          const state = picked ? (o.id === s.id ? 'correct' : o.id === picked ? 'wrong' : undefined) : undefined
          const img = content.imageFor(o)
          return (
            <button key={o.id} className="choice" data-state={state} disabled={Boolean(picked)} onClick={() => pick(o)} aria-label={img?.alt ?? content.gloss(o)}>
              <SenseImage sense={o} />
            </button>
          )
        })}
      </div>
      {picked ? (
        <>
          <div className={`notice ${correct ? 'good' : 'bad'}`} aria-live="polite">
            <span>
              {correct ? 'Doğru! ' : 'Bu sefer olmadı. '}
              <b lang={s.lang}>{content.lemma(s)}</b> = {content.gloss(s, ctx.profile.explanationLang)}
            </span>
          </div>
          <Continue onClick={() => onDone({ scored: true, correct, senseIds: [s.id] })} />
        </>
      ) : null}
    </>
  )
}

/** Görseli olmayan kelimeler ve harfler için: kelimeyi gör/dinle → doğru anlamı seç */
function ChooseGlossStep({ step, ctx, onDone }: StepProps<Extract<Step, { kind: 'choose-gloss' }>>) {
  const s = step.sense
  const isLetter = s.id.startsWith('snd:')
  const { listening, skill, header } = useListenMode(s, isLetter ? 'text' : step.mode)
  const [picked, setPicked] = useState<string | null>(null)
  const t0 = useRef(Date.now())
  const pick = async (o: Sense) => {
    if (picked) return
    setPicked(o.id)
    if (ctx.recordOnlyCorrect && o.id !== s.id) return
    await submitChoice(ctx.repo, {
      lang: s.lang, sense: s, skill, exerciseType: listening ? 'listen-choose' : 'choose-image', prompt: content.lemma(s), correct: o.id === s.id,
      elapsedMs: Date.now() - t0.current, context: ctx.context, industryId: ctx.industryId, source: ctx.source === 'review' ? 'review' : 'lesson',
      desiredRetention: ctx.profile.desiredRetention,
    })
  }
  const correct = picked === s.id
  return (
    <>
      <p className="muted small">{isLetter ? 'Bu harf / kural nasıl okunur?' : listening ? 'Dinle ve doğru anlamı seç' : 'Bu kelimenin anlamı hangisi?'}</p>
      {isLetter ? <div className="big-letter" lang={s.lang}>{content.lemma(s)}</div> : header}
      <div className="gloss-choices">
        {step.options.map((o) => {
          const state = picked ? (o.id === s.id ? 'correct' : o.id === picked ? 'wrong' : undefined) : undefined
          return (
            <button key={o.id} className="btn gloss-choice" data-state={state} disabled={Boolean(picked)} onClick={() => pick(o)}>
              {content.gloss(o, ctx.profile.explanationLang)}
            </button>
          )
        })}
      </div>
      {picked ? (
        <>
          <div className={`notice ${correct ? 'good' : 'bad'}`} aria-live="polite">
            <span>
              {correct ? 'Doğru! ' : 'Bu sefer olmadı. '}
              <b lang={s.lang}>{content.lemma(s)}</b> = {content.gloss(s, ctx.profile.explanationLang)}
            </span>
          </div>
          <Continue onClick={() => onDone({ scored: true, correct, senseIds: [s.id] })} />
        </>
      ) : null}
    </>
  )
}

/** Sesler ve Harfler: harfi/kuralı tanıt, örnek kelimeleri dinlet; Kiril harflerinde kalemle yazma alanı */
function LetterStep({ step, onDone }: StepProps<Extract<Step, { kind: 'letter' }>>) {
  const s = step.sense
  const info = soundItem(s.id)
  const [trace, setTrace] = useState(false)
  return (
    <>
      <p className="muted small">{info?.group.title ?? 'Sesler ve Harfler'}</p>
      <div className="big-letter" lang={s.lang}>{content.lemma(s)}</div>
      <p style={{ fontSize: '1.2em', textAlign: 'center', fontWeight: 650 }}>{s.customGloss}</p>
      {s.explanation ? <div className="notice">{s.explanation}</div> : null}
      <div className="stack">
        <span className="small muted">Örnek kelimeler</span>
        {s.examples.map((e) => {
          const known = [...content.senses.values()].find((x) => x.lang === s.lang && x.generated && x.senseIndex === 1 && content.lemma(x).toLocaleLowerCase(s.lang) === e.text.replace(/[´́¿?¡!]/g, '').toLocaleLowerCase(s.lang))
          return (
            <div className="row" key={e.id}>
              <AudioButton text={e.text} lang={s.lang} recording={known?.audio?.url} />
              <span lang={s.lang} style={{ fontWeight: 650 }}>{e.text}</span>
              {known ? <span className="muted small">— {content.gloss(known)}</span> : null}
            </div>
          )
        })}
      </div>
      {info?.item.trace ? (
        trace ? (
          <TraceCanvas guide={content.lemma(s).split(' ')[0]} lang={s.lang} />
        ) : (
          <button className="btn btn-soft" onClick={() => setTrace(true)}>
            <Icon.pen /> Bu harfi yazmayı dene (Apple Pencil veya parmak)
          </button>
        )
      ) : null}
      <Continue onClick={() => onDone({ scored: false, senseIds: [s.id] })} />
    </>
  )
}

function FlashStep({ step, ctx, onDone }: StepProps<Extract<Step, { kind: 'flash' }>>) {
  const s = step.sense
  const [shown, setShown] = useState(false)
  const t0 = useRef(Date.now())
  const ex = s.examples[0]
  const rate = async (g: Grade) => {
    await submitSelfRating(ctx.repo, {
      lang: s.lang, sense: s, skill: 'recognizeText', grade: g, prompt: content.lemma(s), elapsedMs: Date.now() - t0.current,
      context: ctx.context, source: ctx.source === 'review' ? 'review' : ctx.source === 'collection' ? 'collection' : 'lesson', desiredRetention: ctx.profile.desiredRetention,
    })
    onDone({ scored: true, correct: g > 1, senseIds: [s.id] })
  }
  return (
    <>
      <p className="muted small">Anlamını hatırla — önce düşün, sonra çevir</p>
      <WordHeader sense={s} profile={ctx.profile} showGloss={false} />
      {ex ? <ExampleBox text={ex.text} lang={s.lang} /> : null}
      {!shown ? (
        <button className="btn btn-soft btn-block" onClick={() => setShown(true)}>
          Anlamı göster
        </button>
      ) : (
        <>
          <div className="sense-hero">
            <SenseImage sense={s} />
            <div className="stack">
              <GlossLine sense={s} profile={ctx.profile} />
              {ex?.tr ? <p className="muted">{ex.tr}</p> : null}
            </div>
          </div>
          <p className="small muted">Ne kadar kolay hatırladın? (Tekrar zamanı buna göre belirlenir.)</p>
          <div className="rating">
            {([1, 2, 3, 4] as Grade[]).map((g) => (
              <button key={g} className={`btn ${g === 1 ? 'btn-danger' : g === 3 ? 'btn-primary' : ''}`} onClick={() => rate(g)}>
                {GRADE_LABEL[g]}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function TypeStep({ step, ctx, onDone }: StepProps<Extract<Step, { kind: 'type' }>>) {
  const s = step.sense
  const cloze = step.mode === 'cloze' ? findCloze(s, step.exampleIndex ?? 0) : undefined
  const accepted = cloze ? [cloze.answer] : acceptedForWord(s)
  const [hints, setHints] = useState(0)
  const [result, setResult] = useState<ClosedCheck | null>(null)
  const t0 = useRef(Date.now())
  const submit = async (a: PreparedAnswer) => {
    const r = await submitClosed(ctx.repo, {
      lang: s.lang, sense: s, skill: 'write', exerciseType: cloze ? 'cloze' : 'type-word', prompt: cloze ? `${cloze.before}___${cloze.after}` : content.gloss(s),
      answer: a, accepted, hintsUsed: hints, elapsedMs: Date.now() - t0.current, context: ctx.context, industryId: ctx.industryId,
      source: ctx.source, desiredRetention: ctx.profile.desiredRetention, exampleId: cloze ? s.examples[step.exampleIndex ?? 0]?.id : undefined,
    })
    setResult(r.check)
  }
  const expected = cloze ? cloze.answer : content.lemma(s)
  const hintText = cloze ? `Sözlük biçimi: ${content.lemma(s)}` : `İlk harf: ${expected.slice(0, 1)}…`
  const alt = result?.correct && result.matched && result.matched !== expected
  return (
    <>
      <p className="muted small">{cloze ? 'Boşluğa uygun biçimi yaz' : 'Bu anlamın karşılığını yaz'}</p>
      {cloze ? (
        <div className="example">
          <span className="t" lang={s.lang} style={{ fontSize: '1.2em' }}>
            {cloze.before}
            <span style={{ borderBottom: '2px solid var(--accent)', padding: '0 24px' }} aria-label="boşluk" />
            {cloze.after}
          </span>
          <span className="muted small">{cloze.tr}</span>
        </div>
      ) : (
        <div className="sense-hero">
          <SenseImage sense={s} />
          <GlossLine sense={s} profile={ctx.profile} />
        </div>
      )}
      {!result ? (
        <>
          {hints > 0 ? (
            <div className="notice">{hintText}</div>
          ) : (
            <button className="btn btn-ghost" onClick={() => setHints(1)}>
              <Icon.hint /> İpucu
            </button>
          )}
          <AnswerInput lang={s.lang} onSubmit={submit} placeholder="Cevabını yaz" />
        </>
      ) : (
        <>
          <div className={`notice ${result.correct ? 'good' : result.nearMiss ? 'warn' : 'bad'}`} aria-live="polite">
            <div className="stack" style={{ gap: 6 }}>
              <span>{result.correct ? (alt ? `Bu da doğru. Bu derste öğrettiğimiz kelime: ${expected}` : 'Doğru!') : result.explanation}</span>
              {!result.correct && result.diff ? (
                <span className="diff" aria-label="Senin yazdığınla doğrusu arasındaki fark">
                  {result.diff.map((d, i) => (
                    <span key={i} className={d.type}>
                      {d.text}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          </div>
          <div className="row">
            <AudioButton text={expected} lang={s.lang} recording={cloze ? undefined : s.audio?.url} />
            <span lang={s.lang} style={{ fontWeight: 700 }}>{expected}</span>
          </div>
          {!result.correct ? <p className="tiny muted">Bu hata, hata defterine eklendi; ileride farklı bir örnekle tekrar çalışacaksın.</p> : null}
          <Continue onClick={() => onDone({ scored: true, correct: result.correct, senseIds: [s.id] })} />
        </>
      )}
    </>
  )
}

function ProductionStep({ ctx, onDone, senses, task, prompt }: { ctx: PlayerCtx; onDone: (r: StepResult) => void; senses: Sense[]; task?: TaskSpec; prompt: string }) {
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [round, setRound] = useState(0)
  const [showSamples, setShowSamples] = useState(false)
  const t0 = useRef(Date.now())
  const lang = senses[0]?.lang ?? ctx.lang
  const submit = async (a: PreparedAnswer) => {
    const at = await submitProduction(ctx.repo, {
      lang, senses, task, mode: task ? task.mode : 'free', prompt, answer: a, hintsUsed: 0, elapsedMs: Date.now() - t0.current,
      context: ctx.context, industryId: ctx.industryId,
    })
    setAttempt(at)
  }
  return (
    <>
      <p className="muted small">{task ? `Görev: ${task.title}` : 'Kendi cümleni kur'}</p>
      <p style={{ fontSize: '1.15em', fontWeight: 600 }}>{prompt}</p>
      <div className="row">
        {senses.map((s) => (
          <span key={s.id} className="pill accent" lang={s.lang}>
            {content.lemma(s)} · {content.gloss(s)}
          </span>
        ))}
      </div>
      {!task ? <p className="tiny muted">Serbest cümle: istediğin anlamı kurabilirsin; tek bir "doğru cümle" beklenmiyor.</p> : null}
      {!attempt ? (
        <AnswerInput key={round} lang={lang} multiline onSubmit={submit} submitLabel="Gönder" placeholder="Cümleni yaz" autoFocus={false} />
      ) : (
        <>
          <div className="example">
            <span className="t" lang={lang}>{attempt.finalText}</span>
            {attempt.recognitionEdited ? <span className="tiny muted">El yazısı tanıması düzeltildi (dil hatası sayılmadı).</span> : null}
          </div>
          <EvaluationView attempt={attempt} />
          {task?.sampleAnswers?.length ? (
            showSamples ? (
              <div className="stack">
                <h3>Örnek cevaplar (birden fazla doğru ifade olabilir)</h3>
                {task.sampleAnswers.map((x) => <ExampleBox key={x} text={x} lang={lang} />)}
              </div>
            ) : (
              <button className="btn btn-ghost" onClick={() => setShowSamples(true)}>Örnek cevapları göster</button>
            )
          ) : null}
          <div className="row">
            <button className="btn" onClick={() => { setAttempt(null); setRound((r) => r + 1) }}>
              <Icon.refresh /> Yeniden yaz
            </button>
            <div style={{ flex: 1 }}>
              <Continue onClick={() => onDone({ scored: false, senseIds: senses.map((s) => s.id) })} />
            </div>
          </div>
        </>
      )}
    </>
  )
}

export interface PlayerProps {
  title: string
  steps: Step[]
  ctx: PlayerCtx
  startAt?: number
  onStep?: (nextIndex: number) => void
  onFinish?: (results: StepResult[]) => void
  onClose: () => void
  /** Bitiş ekranında gösterilecek ek içerik */
  finishExtra?: (results: StepResult[]) => ReactNode
  finishLabel?: string
  showNextDue?: boolean
}

export function Player({ title, steps, ctx, startAt = 0, onStep, onFinish, onClose, finishExtra, finishLabel = 'Bitir', showNextDue = true }: PlayerProps) {
  const [index, setIndex] = useState(Math.min(startAt, steps.length))
  const [results, setResults] = useState<StepResult[]>([])
  const [due, setDue] = useState<{ sense: Sense; due: number }[]>([])
  const finished = index >= steps.length
  const step = steps[index]

  const done = (r: StepResult) => {
    const next = index + 1
    const all = [...results, r]
    setResults(all)
    onStep?.(next)
    setIndex(next)
    if (next >= steps.length) onFinish?.(all)
  }

  const senseIds = useMemo(() => [...new Set(steps.flatMap(stepSenseIds))], [steps])
  useEffect(() => {
    if (!finished || !showNextDue) return
    ;(async () => {
      const out: { sense: Sense; due: number }[] = []
      for (const id of senseIds) {
        const sense = content.senses.get(id)
        if (!sense) continue
        const skills = await Promise.all((['recognizeText', 'recognizeAudio', 'write'] as const).map((k) => ctx.repo.getSkill(id, k)))
        const dues = skills.filter(Boolean).map((x) => x!.due)
        if (dues.length) out.push({ sense, due: Math.min(...dues) })
      }
      setDue(out)
    })()
  }, [finished, senseIds, ctx.repo, showNextDue])

  const scored = results.filter((r) => r.scored)
  const correct = scored.filter((r) => r.correct).length

  return (
    <div className="player" role="dialog" aria-modal="true" aria-label={title}>
      <div className="player-top">
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Kapat (ilerleme kaydedildi)">
          <Icon.close />
        </button>
        <Progress value={steps.length ? index / steps.length : 1} label={`${title} ilerlemesi`} />
        <span className="small muted" aria-hidden="true">
          {Math.min(index + 1, steps.length)}/{steps.length}
        </span>
      </div>
      <div className="player-body">
        {!finished && step ? (
          <div className="player-inner" key={index}>
            {step.kind === 'intro' ? <IntroStep step={step} ctx={ctx} onDone={done} /> : null}
            {step.kind === 'choose' ? <ChooseStep step={step} ctx={ctx} onDone={done} /> : null}
            {step.kind === 'choose-gloss' ? <ChooseGlossStep step={step} ctx={ctx} onDone={done} /> : null}
            {step.kind === 'letter' ? <LetterStep step={step} ctx={ctx} onDone={done} /> : null}
            {step.kind === 'flash' ? <FlashStep step={step} ctx={ctx} onDone={done} /> : null}
            {step.kind === 'type' ? <TypeStep step={step} ctx={ctx} onDone={done} /> : null}
            {step.kind === 'produce' ? <ProductionStep ctx={ctx} onDone={done} senses={[step.sense]} prompt={step.sense.productionPrompt} /> : null}
            {step.kind === 'task' ? (
              <ProductionStep ctx={ctx} onDone={done} task={step.task} prompt={step.task.prompt} senses={step.task.targetSenseIds.map((id) => content.sense(id))} />
            ) : null}
          </div>
        ) : (
          <div className="player-inner">
            <h1>{title}: tamamlandı</h1>
            {scored.length ? (
              <p className="muted">
                Puanlanan {scored.length} alıştırmanın {correct} tanesi doğru. Bu bir sınav notu değil; tekrar zamanlarını belirlemek için kullanılır.
              </p>
            ) : null}
            {finishExtra?.(results)}
            {showNextDue && due.length ? (
              <div className="card flat">
                <h3>Sonraki tekrarlar</h3>
                <div className="list">
                  {due.map((d) => (
                    <div className="list-item" key={d.sense.id}>
                      <span className="grow" lang={d.sense.lang}>
                        <b>{content.lemma(d.sense)}</b> <span className="muted small">· {content.gloss(d.sense)}</span>
                      </span>
                      <span className="pill">{formatDue(d.due)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <Continue onClick={onClose} label={finishLabel} />
          </div>
        )}
      </div>
    </div>
  )
}
