import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { content } from '../content/registry'
import { soundItem } from '../content/sounds'
import type { Sense, TaskSpec } from '../content/types'
import type { Repository } from '../data/repo'
import { evaluatorState, type ClosedCheck, type EvaluatorState } from '../domain/evaluation'
import { formatDue } from '../domain/planner'
import { GRADE_LABEL } from '../domain/scheduler'
import { submitChoice, submitClosed, submitProduction, submitSelfRating, type PreparedAnswer } from '../domain/services'
import type { Attempt, Grade, Profile, Skill } from '../domain/types'
import { AnswerInput } from '../ui/AnswerInput'
import { play, preloadRecording, type PlayOutcome } from '../ui/audio'
import { AudioButton, essentialGrammar, ExampleBox, GlossLine, Headword, Progress, ReportButton, SenseImage, WordDetails } from '../ui/components'
import { EvaluationView } from '../ui/EvaluationView'
import { Icon } from '../ui/icons'
import { TraceCanvas } from '../ui/TraceCanvas'
import { acceptedForWord, findCloze, relatedForWord, stepSenseIds, type Step } from './steps'

export interface PlayerCtx {
  repo: Repository
  profile: Profile
  lang: string
  context: Attempt['context']
  industryId?: string
  source: 'lesson' | 'review' | 'error-practice' | 'collection' | 'placement'
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

const choiceSource = (ctx: PlayerCtx) => (ctx.source === 'review' ? 'review' : ctx.source === 'placement' ? 'placement' : 'lesson')

/** Adımın birincil eylemi: ekranın altında sabit durur, klavyeyle de erişilir. */
function Continue({ onClick, label = 'Devam' }: { onClick: () => void; label?: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => ref.current?.focus({ preventScroll: true }), [])
  return (
    <div className="action-bar">
      <button ref={ref} className="btn btn-primary btn-block" onClick={onClick}>
        {label}
      </button>
    </div>
  )
}

/** Kısa yönerge (her alıştırmanın ilk satırı) */
function Instruction({ children }: { children: ReactNode }) {
  return <p className="instruction">{children}</p>
}

/** Kısa geri bildirim; ek açıklama isteyene açılır. */
function Feedback({ tone, title, children, more }: { tone: 'good' | 'bad' | 'warn'; title: string; children?: ReactNode; more?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  // Geri bildirim görünür alana kaydırılır (alttaki sabit "Devam" düğmesinin arkasında kalmasın)
  useEffect(() => {
    const reduce = document.documentElement.dataset.motion === 'reduce'
    ref.current?.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [])
  return (
    <div ref={ref} className={`feedback ${tone}`} role="status" aria-live="polite">
      <p className="feedback-title">{title}</p>
      {children}
      {more ? (
        <details className="why">
          <summary>Neden?</summary>
          <div className="small">{more}</div>
        </details>
      ) : null}
    </div>
  )
}

/** Tanıtımda gösterilecek tek, kısa örnek */
function shortExample(s: Sense) {
  return [...s.examples].sort((a, b) => a.text.length - b.text.length)[0]
}

function IntroStep({ step, ctx, onDone }: StepProps<Extract<Step, { kind: 'intro' }>>) {
  const s = step.sense
  const ex = shortExample(s)
  const grammar = essentialGrammar(s)
  const visual = content.visual(s)
  return (
    <>
      <p className="step-label">{step.tag === 'wod' ? 'Günün kelimesi' : 'Yeni kelime'}</p>
      <div className={`word-card${visual ? ' has-visual' : ''}`}>
        {visual ? <SenseImage sense={s} /> : null}
        <div className="stack" style={{ gap: 8 }}>
          <Headword sense={s} profile={ctx.profile} />
          <GlossLine sense={s} profile={ctx.profile} />
          {grammar ? <p className="small muted">{grammar}</p> : null}
        </div>
      </div>
      {ex ? <ExampleBox text={ex.text} tr={ex.tr} lang={s.lang} trSource={ex.trSource} /> : null}
      <WordDetails sense={s} profile={ctx.profile} report={ctx.context !== 'demo'} />
      <Continue onClick={() => onDone({ scored: false, senseIds: [s.id] })} />
    </>
  )
}

/** Dinleme modu: büyük dinle düğmesi (kendiliğinden çalmaz). Ses çalmazsa açıkça söylenir ve okuyarak devam edilir. */
function useListenMode(sense: Sense, mode: 'audio' | 'text') {
  const [outcome, setOutcome] = useState<PlayOutcome | 'playing' | null>(null)
  const [readInstead, setReadInstead] = useState(false)
  useEffect(() => {
    void preloadRecording(sense.audio?.url)
  }, [sense.audio?.url])
  const listening = mode === 'audio' && !readInstead
  const listen = () => {
    setOutcome('playing')
    play({ text: content.lemma(sense), lang: sense.lang, recording: sense.audio?.url }).then(setOutcome)
  }
  const skill: Skill = listening ? 'recognizeAudio' : 'recognizeText'
  const failed = outcome === 'failed' || outcome === 'tts-no-voice'
  const status =
    outcome === 'playing' ? 'Çalıyor…'
    : outcome === 'recording' ? 'Yeniden dinlemek için dokun.'
    : outcome === 'tts' ? 'Cihaz sesi çaldı. Duymadıysan sessiz modu kapat.'
    : `Dinlemek için dokun (${sense.audio ? 'insan sesi' : 'cihaz sesi'}).`
  const header = listening ? (
    <div className="listen">
      <button className="big-audio" onClick={listen} aria-label={`Kelimeyi dinle (${sense.audio ? 'insan sesi kaydı' : 'cihaz sesi'})`}>
        <Icon.play />
      </button>
      {failed ? (
        <div className="feedback warn" role="status">
          <p className="feedback-title">Ses çalınamadı.</p>
          <p className="small">Bu soruyu kelimeyi okuyarak cevaplayabilirsin.</p>
          <button className="btn btn-soft" onClick={() => setReadInstead(true)}>
            Okuyarak devam et
          </button>
        </div>
      ) : (
        <>
          <p className="tiny muted" role="status">{status}</p>
          <button className="btn btn-ghost btn-small" onClick={() => setReadInstead(true)}>
            Ses yok mu? Okuyarak devam et
          </button>
        </>
      )}
    </div>
  ) : (
    <div className="prompt-word" lang={sense.lang}>
      {content.lexemes.get(sense.lexemeId)?.pronunciation?.stressed ?? content.lemma(sense)}
    </div>
  )
  return { listening, skill, header }
}

function useChoice(s: Sense, ctx: PlayerCtx, skill: Skill, exerciseType: 'listen-choose' | 'choose-image') {
  const [picked, setPicked] = useState<string | null>(null)
  const t0 = useRef(Date.now())
  const pick = async (o: Sense) => {
    if (picked) return
    setPicked(o.id)
    if (ctx.recordOnlyCorrect && o.id !== s.id) return
    await submitChoice(ctx.repo, {
      lang: s.lang, sense: s, skill, exerciseType, prompt: content.lemma(s), correct: o.id === s.id,
      elapsedMs: Date.now() - t0.current, context: ctx.context, industryId: ctx.industryId, source: choiceSource(ctx),
      desiredRetention: ctx.profile.desiredRetention,
    })
  }
  return { picked, pick, correct: picked === s.id }
}

function ChoiceFeedback({ s, ctx, correct }: { s: Sense; ctx: PlayerCtx; correct: boolean }) {
  return (
    <Feedback tone={correct ? 'good' : 'bad'} title={correct ? 'Doğru.' : 'Doğrusu:'}>
      <p>
        <b lang={s.lang} className="t-serif">{content.lemma(s)}</b>: {content.gloss(s, ctx.profile.explanationLang)}
      </p>
      {!correct && ctx.context !== 'demo' ? <ReportButton lang={s.lang} senseId={s.id} word={content.lemma(s)} context="alıştırma" /> : null}
    </Feedback>
  )
}

function ChooseStep({ step, ctx, onDone }: StepProps<Extract<Step, { kind: 'choose' }>>) {
  const s = step.sense
  const { listening, skill, header } = useListenMode(s, step.mode)
  const { picked, pick, correct } = useChoice(s, ctx, skill, listening ? 'listen-choose' : 'choose-image')
  return (
    <>
      <Instruction>{listening ? 'Dinle ve doğru resmi seç.' : 'Bu kelimenin resmini seç.'}</Instruction>
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
          <ChoiceFeedback s={s} ctx={ctx} correct={correct} />
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
  const { picked, pick, correct } = useChoice(s, ctx, skill, listening ? 'listen-choose' : 'choose-image')
  return (
    <>
      <Instruction>{isLetter ? 'Bu harf nasıl okunur?' : listening ? 'Dinle ve anlamını seç.' : 'Anlamı hangisi?'}</Instruction>
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
          <ChoiceFeedback s={s} ctx={ctx} correct={correct} />
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
      <p className="step-label">{info?.group.title ?? 'Sesler ve Harfler'}</p>
      <div className="big-letter" lang={s.lang}>{content.lemma(s)}</div>
      <p className="letter-sound">{s.customGloss}</p>
      {s.explanation ? <p className="small">{s.explanation}</p> : null}
      <div className="stack" style={{ gap: 8 }}>
        <span className="small muted">Örnek kelimeler</span>
        {s.examples.map((e) => {
          const known = content.wordSense(s.lang, e.text)
          return (
            <div className="row" key={e.id}>
              <AudioButton text={e.text} lang={s.lang} />
              <span lang={s.lang} className="t-serif" style={{ fontWeight: 650 }}>{e.text}</span>
              {known ? <span className="muted small">{content.gloss(known)}</span> : null}
            </div>
          )
        })}
      </div>
      {info?.item.trace ? (
        trace ? (
          <TraceCanvas guide={content.lemma(s).split(' ')[0]} lang={s.lang} />
        ) : (
          <button className="btn btn-soft" onClick={() => setTrace(true)}>
            <Icon.pen /> Bu harfi yazmayı dene
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
  const ex = shortExample(s)
  const rate = async (g: Grade) => {
    await submitSelfRating(ctx.repo, {
      lang: s.lang, sense: s, skill: 'recognizeText', grade: g, prompt: content.lemma(s), elapsedMs: Date.now() - t0.current,
      context: ctx.context, source: ctx.source === 'review' ? 'review' : ctx.source === 'collection' ? 'collection' : 'lesson', desiredRetention: ctx.profile.desiredRetention,
    })
    onDone({ scored: true, correct: g > 1, senseIds: [s.id] })
  }
  return (
    <>
      <Instruction>Anlamını hatırlıyor musun?</Instruction>
      <Headword sense={s} profile={ctx.profile} />
      {ex ? <ExampleBox text={ex.text} lang={s.lang} /> : null}
      {!shown ? (
        <div className="action-bar">
          <button className="btn btn-primary btn-block" onClick={() => setShown(true)}>
            Anlamı göster
          </button>
        </div>
      ) : (
        <>
          <div className={`word-card${content.visual(s) ? ' has-visual' : ''}`}>
            <SenseImage sense={s} />
            <div className="stack" style={{ gap: 4 }}>
              <GlossLine sense={s} profile={ctx.profile} />
              {ex?.tr ? <p className="muted small">{ex.tr}</p> : null}
            </div>
          </div>
          <p className="small muted">Ne kadar kolay hatırladın?</p>
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
      answer: a, accepted, related: cloze ? [] : relatedForWord(s), hintsUsed: hints, elapsedMs: Date.now() - t0.current, context: ctx.context, industryId: ctx.industryId,
      source: ctx.source === 'placement' ? 'lesson' : ctx.source, desiredRetention: ctx.profile.desiredRetention, exampleId: cloze ? s.examples[step.exampleIndex ?? 0]?.id : undefined,
    })
    setResult(r.check)
  }
  const expected = cloze ? cloze.answer : content.lemma(s)
  const hintText = cloze ? `Sözlük biçimi: ${content.lemma(s)}` : `İlk harf: ${expected.slice(0, 1)}…`
  const alt = result?.correct && result.matched && result.matched !== expected
  return (
    <>
      <Instruction>{cloze ? 'Boşluğu doldur.' : 'Bu anlamın karşılığını yaz.'}</Instruction>
      {cloze ? (
        <div className="example">
          <span className="t" lang={s.lang} style={{ fontSize: '1.2em' }}>
            {cloze.before}
            <span className="blank" aria-label="boşluk" />
            {cloze.after}
          </span>
          <span className="muted small">{cloze.tr}</span>
        </div>
      ) : (
        <div className={`word-card${content.visual(s) ? ' has-visual' : ''}`}>
          <SenseImage sense={s} />
          <GlossLine sense={s} profile={ctx.profile} />
        </div>
      )}
      {!result ? (
        <>
          <AnswerInput lang={s.lang} onSubmit={submit} placeholder="Cevabın" />
          {hints > 0 ? (
            <p className="small hint">{hintText}</p>
          ) : (
            <button className="btn btn-ghost btn-small" onClick={() => setHints(1)}>
              <Icon.hint /> İpucu
            </button>
          )}
        </>
      ) : (
        <>
          {result.correct ? (
            <Feedback tone="good" title="Doğru.">{alt ? <p className="small">Öğrettiğimiz biçim: <span lang={s.lang}>{expected}</span></p> : null}</Feedback>
          ) : result.related ? (
            <Feedback tone="warn" title={`Burada istenen: ${expected}`} more={<p>{result.explanation}</p>} />
          ) : (
            <Feedback
              tone={result.nearMiss ? 'warn' : 'bad'}
              title={result.nearMiss ? 'Neredeyse.' : 'Doğrusu:'}
              more={
                <>
                  <p>{result.explanation}</p>
                  <p className="muted">Bu kelime hata defterine eklendi; ileride farklı bir örnekle yeniden karşına çıkacak.</p>
                </>
              }
            >
              {result.diff ? (
                <span className="diff" aria-label="Senin yazdığınla doğrusu arasındaki fark">
                  {result.diff.map((d, i) => (
                    <span key={i} className={d.type}>
                      {d.text}
                    </span>
                  ))}
                </span>
              ) : null}
            </Feedback>
          )}
          <div className="row">
            <AudioButton text={expected} lang={s.lang} recording={cloze ? undefined : s.audio?.url} />
            <span lang={s.lang} className="t-serif" style={{ fontWeight: 700, fontSize: '1.15em' }}>{expected}</span>
          </div>
          <Continue onClick={() => onDone({ scored: true, correct: result.correct, senseIds: [s.id] })} />
        </>
      )}
    </>
  )
}

const CAPABILITY: Record<EvaluatorState, string> = {
  unconfigured:
    'Şu an cümleleri değerlendiren bir hizmet bağlı değil. Cümlen pratik olarak kaydedilir; uygulama yalnızca hedef kelimenin geçip geçmediğine bakar.',
  offline: 'Cümle değerlendirme ayarlı ama şu an internet yok. Cümlen kaydedilir ve bağlantı gelince değerlendirilir.',
  ready: 'Cümlen değerlendirme için gönderilecek. Yalnızca cümle ve görev bilgisi gider.',
}

/** Kendi cümleni kur / görev. İsteğe bağlıdır; değerlendirme yoksa bunu baştan söyler ve sahte başarı göstermez. */
export function ProductionStep({ ctx, onDone, senses, task, prompt }: { ctx: PlayerCtx; onDone: (r: StepResult) => void; senses: Sense[]; task?: TaskSpec; prompt: string }) {
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [round, setRound] = useState(0)
  const [state] = useState<EvaluatorState>(() => evaluatorState(ctx.profile.evaluationEndpoint, typeof navigator === 'undefined' ? true : navigator.onLine))
  const t0 = useRef(Date.now())
  const lang = senses[0]?.lang ?? ctx.lang
  const submit = async (a: PreparedAnswer) => {
    const at = await submitProduction(ctx.repo, {
      lang, senses, task, mode: task ? task.mode : 'free', prompt, answer: a, hintsUsed: 0, elapsedMs: Date.now() - t0.current,
      context: ctx.context, industryId: ctx.industryId, evaluator: state,
    })
    setAttempt(at)
  }
  const finish = () => onDone({ scored: false, senseIds: senses.map((s) => s.id) })
  const target = attempt?.evaluation?.axes.targetWord
  return (
    <>
      <p className="step-label">{task ? `Görev: ${task.title}` : 'Cümle kur (isteğe bağlı)'}</p>
      <p className="prompt">{prompt}</p>
      <div className="row">
        {senses.map((s) => (
          <span key={s.id} className="pill accent" lang={s.lang}>
            {content.lemma(s)}: {content.gloss(s)}
          </span>
        ))}
      </div>
      {!attempt ? (
        <>
          <p className="small muted capability">{CAPABILITY[state]}</p>
          <AnswerInput
            key={round}
            lang={lang}
            multiline
            onSubmit={submit}
            submitLabel={state === 'unconfigured' ? 'Pratik cümlesini kaydet' : 'Gönder'}
            placeholder="Cümleni yaz"
            autoFocus={false}
          />
          <button className="btn btn-ghost" onClick={finish}>Bu adımı atla</button>
        </>
      ) : (
        <>
          <Feedback tone="good" title="Cümlen kaydedildi.">
            <p className="t" lang={lang}>{attempt.finalText}</p>
            {attempt.recognitionEdited ? <p className="tiny muted">El yazısı tanıması düzeltildi (dil hatası sayılmadı).</p> : null}
          </Feedback>
          {state === 'unconfigured' ? (
            target?.note ? <p className="small muted">{target.status === 'pass' ? 'Hedef kelime cümlende geçiyor.' : target.note}</p> : null
          ) : (
            <>
              <p className="small muted">{attempt.evalStatus === 'pending' ? 'Değerlendirme bekliyor: bağlantı gelince yapılacak.' : ''}</p>
              <EvaluationView attempt={attempt} />
            </>
          )}
          {task?.sampleAnswers?.length ? (
            <details className="why">
              <summary>Örnek cevaplar</summary>
              <div className="stack">
                <p className="small muted">Birden fazla doğru ifade olabilir. Örnekler uzman onaylı değildir.</p>
                {task.sampleAnswers.map((x) => <ExampleBox key={x} text={x} lang={lang} />)}
              </div>
            </details>
          ) : null}
          <button className="btn" onClick={() => { setAttempt(null); setRound((r) => r + 1) }}>
            <Icon.refresh /> Yeniden yaz
          </button>
          <Continue onClick={finish} />
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
  /** Her adım bittiğinde: sıradaki adımın sırası, (eklenmiş adımlarla) güncel adım listesi ve sonuç */
  onStep?: (nextIndex: number, steps: Step[], result: StepResult) => void
  /** Sonuca göre sona eklenecek adımlar (ör. yanlış cevaplanan yeni kelime için bir soru daha) */
  extend?: (index: number, result: StepResult) => Step[]
  onFinish?: (results: StepResult[]) => void
  onClose: () => void
  /** Bitiş ekranında gösterilecek ek içerik */
  finishExtra?: (results: StepResult[]) => ReactNode
  /** Bitiş ekranının tamamı (verilirse varsayılanın yerine) */
  renderFinish?: (results: StepResult[]) => ReactNode
  finishLabel?: string
  showNextDue?: boolean
  /** Üst bilgi (ör. eski düzende devam eden ders notu) */
  notice?: ReactNode
}

export function Player({ title, steps: initial, ctx, startAt = 0, onStep, extend, onFinish, onClose, finishExtra, renderFinish, finishLabel = 'Bitir', showNextDue = true, notice }: PlayerProps) {
  const [steps, setSteps] = useState(initial)
  const [index, setIndex] = useState(Math.min(startAt, initial.length))
  const [results, setResults] = useState<StepResult[]>([])
  const [due, setDue] = useState<{ sense: Sense; due: number }[]>([])
  const finished = index >= steps.length
  const step = steps[index]

  const done = (r: StepResult) => {
    const next = index + 1
    const all = [...results, r]
    const added = extend?.(index, r) ?? []
    const list = added.length ? [...steps, ...added] : steps
    if (added.length) setSteps(list)
    setResults(all)
    onStep?.(next, list, r)
    setIndex(next)
    if (next >= list.length) onFinish?.(all)
  }

  const senseIds = useMemo(() => [...new Set(steps.flatMap(stepSenseIds))], [steps])
  // Dersteki kelimelerin insan kayıtları baştan indirilir: dokununca beklemeden çalar
  useEffect(() => {
    for (const id of senseIds.slice(0, 30)) void preloadRecording(content.senses.get(id)?.audio?.url)
  }, [senseIds])
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
        <span className="small muted step-count" aria-hidden="true">
          {Math.min(index + 1, steps.length)}/{steps.length}
        </span>
      </div>
      <div className="player-body">
        {notice && !finished ? <div className="player-notice small">{notice}</div> : null}
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
        ) : renderFinish ? (
          <div className="player-inner">{renderFinish(results)}</div>
        ) : (
          <div className="player-inner">
            <h1>{title} tamamlandı</h1>
            {scored.length ? (
              <p>
                {scored.length} sorudan {correct} tanesi doğru.
              </p>
            ) : null}
            {finishExtra?.(results)}
            {showNextDue && due.length ? <NextDue due={due} /> : null}
            <Continue onClick={onClose} label={finishLabel} />
          </div>
        )}
      </div>
    </div>
  )
}

/** Sonraki tekrar zamanları (bitiş ekranında, açılır) */
export function NextDue({ due }: { due: { sense: Sense; due: number }[] }) {
  return (
    <details className="details">
      <summary>Sonraki tekrarlar</summary>
      <div className="list">
        {due.map((d) => (
          <div className="list-item" key={d.sense.id}>
            <span className="grow" lang={d.sense.lang}>
              <b className="t-serif">{content.lemma(d.sense)}</b> <span className="muted small">{content.gloss(d.sense)}</span>
            </span>
            <span className="pill">{formatDue(d.due)}</span>
          </div>
        ))}
      </div>
    </details>
  )
}
