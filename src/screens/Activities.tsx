import { useEffect, useMemo } from 'react'
import { go, rememberLearningRoute } from '../app/router'
import { useApp, useAsync, useLangContent } from '../app/context'
import { content } from '../content/registry'
import type { Lesson, Sense } from '../content/types'
import { formatDue } from '../domain/planner'
import { getTodayPlan, personalSenseMap } from '../domain/services'
import { Player, type PlayerCtx } from './Player'
import { errorPracticeSteps, LESSON_SEQ, lessonStepsFor, reviewSteps, skipCheckSteps, unitCheckSteps, wordOfDaySteps } from './steps'

// Tam ekran öğrenme etkinlikleri. Her biri adım adım kaydeder; kapatılırsa kaldığı yer korunur.

function useCtx(lang: string, extra: Partial<PlayerCtx> = {}): PlayerCtx {
  const { repo, profile } = useApp()
  return { repo, profile, lang, context: 'core', source: 'lesson', ...extra }
}

function Loading({ text = 'Yükleniyor…' }: { text?: string }) {
  return (
    <div className="player">
      <div className="player-body">
        <p className="muted" style={{ padding: 24 }}>{text}</p>
      </div>
    </div>
  )
}

/** Ders kimliğinden dili çıkarır (sık kelime dersleri: g-<dil>-<n>, ses dersleri: snd-<dil>-...) */
function lessonLang(lessonId: string): string | undefined {
  const m = /^(?:g|snd)-([a-z]{2})-/.exec(lessonId)
  return m?.[1] ?? content.lessons.get(lessonId)?.lang
}

function backRoute(lesson: Lesson, from?: string | null) {
  if (from === 'today') return '#/today'
  return lesson.track === 'industry' ? `#/industries/${lesson.industry}?lang=${lesson.lang}` : lesson.track === 'sounds' ? '#/sounds' : '#/learn'
}

export function LessonScreen({ lessonId, from }: { lessonId: string; from?: string | null }) {
  const lang = lessonLang(lessonId)
  const loaded = useLangContent(lang)
  if (!loaded.ready) return <Loading text="Kelimeler yükleniyor…" />
  return <LessonInner lessonId={lessonId} from={from} key={lessonId} />
}

function LessonInner({ lessonId, from }: { lessonId: string; from?: string | null }) {
  const { repo, bump } = useApp()
  const lesson = content.lessons.get(lessonId)
  const ctx = useCtx(lesson?.lang ?? 'ru', lesson?.track === 'industry' ? { context: 'industry', industryId: lesson.industry } : {})
  const state = useAsync(async () => {
    if (!lesson) return null
    if (lesson.track === 'industry' && lesson.industry) await repo.ensureIndustryTrack(lesson.lang, lesson.industry)
    await repo.ensureTrack(lesson.lang)
    return (await repo.getLessonState(lesson.lang, lesson.id)) ?? null
  }, [lessonId])
  // Eski (uzun) düzende yarım kalmış ders eski sırayla, kaldığı adımdan sürer; diğerleri kısa düzen
  const plan = useMemo(() => (lesson && !state.loading ? lessonStepsFor(lesson, state.data ?? undefined) : null), [lesson, state.loading, state.data])
  useEffect(() => rememberLearningRoute(`#/lesson/${lessonId}`), [lessonId])
  if (!lesson) return <p className="page">Ders bulunamadı.</p>
  if (state.loading || !plan) return <Loading />
  const save = (step: number, status: 'in-progress' | 'completed') =>
    repo.saveLessonState({
      lang: lesson.lang, lessonId: lesson.id, track: lesson.track, industryId: lesson.industry, status, step,
      seq: plan.legacy && status === 'in-progress' ? undefined : LESSON_SEQ, completedAt: status === 'completed' ? Date.now() : undefined,
    })
  return (
    <Player
      title={lesson.title}
      steps={plan.steps}
      ctx={ctx}
      startAt={plan.startAt}
      showNextDue={lesson.track !== 'sounds'}
      notice={plan.legacy ? 'Bu ders eski (uzun) düzende yarım kalmıştı; kaldığın yerden aynı sırayla devam ediyor. Sonraki dersler kısa düzende.' : undefined}
      onStep={(next, steps) => void save(next, next >= steps.length ? 'completed' : 'in-progress')}
      onFinish={() => rememberLearningRoute(null)}
      onClose={() => {
        bump()
        go(backRoute(lesson, from))
      }}
    />
  )
}

export function ReviewScreen() {
  const { repo, profile, bump } = useApp()
  const lang = profile.activeLang
  const ctx = useCtx(lang, { context: 'review', source: 'review' })
  const data = useAsync(async () => {
    await content.ensureLanguage(lang).catch(() => undefined)
    const due = await repo.dueSkills(lang)
    const map = await personalSenseMap(repo, lang)
    const all = await repo.skillsForLang(lang)
    const next = all.filter((s) => s.skill !== 'produce' && !s.deleted).map((s) => s.due).sort((a, b) => a - b)[0]
    return { steps: reviewSteps(due, (id) => content.resolve(id, map)), next }
  }, [lang])
  if (data.loading || !data.data) return <Loading />
  const close = () => {
    bump()
    go('#/explore')
  }
  if (data.data.steps.length === 0) {
    return (
      <div className="player">
        <div className="player-body">
          <div className="player-inner">
            <h1>Şu an tekrar yok</h1>
            <p className="muted">
              {data.data.next ? `Sıradaki tekrar ${formatDue(data.data.next)}.` : 'Henüz hiç kelime öğrenilmedi; bir dersle başlayabilirsin.'}
            </p>
            <button className="btn btn-primary btn-block" onClick={close}>Tamam</button>
          </div>
        </div>
      </div>
    )
  }
  return <Player title="Tekrar" steps={data.data.steps} ctx={ctx} onClose={close} />
}

export function WordOfDayScreen() {
  const { repo, profile, bump } = useApp()
  const lang = profile.activeLang
  const ctx = useCtx(lang)
  const data = useAsync(async () => {
    await content.ensureLanguage(lang).catch(() => undefined)
    const plan = await getTodayPlan(repo, profile, lang)
    if (!plan.wordOfDay) return null
    const sense = content.senses.get(plan.wordOfDay.senseId)
    if (!sense) return null
    const related = plan.wordOfDay.relatedSenseIds.map((id) => content.senses.get(id)).filter((s): s is Sense => Boolean(s))
    const introduced = (await repo.introducedSenseIds(lang)).has(sense.id)
    return wordOfDaySteps(sense, related, introduced)
  }, [lang])
  if (data.loading) return <Loading />
  const close = () => {
    bump()
    go('#/explore')
  }
  if (!data.data) return <p className="page">Bu dil için içerik yok.</p>
  return <Player title="Günün Kelimesi" steps={data.data} ctx={ctx} onClose={close} />
}

export function ErrorPracticeScreen({ errorId }: { errorId: string }) {
  const { repo, profile, bump } = useApp()
  const data = useAsync(async () => {
    const err = await repo.db.errors.get(errorId)
    if (!err) return null
    await content.ensureLanguage(err.lang).catch(() => undefined)
    const map = await personalSenseMap(repo, err.lang)
    const sense = content.resolve(err.senseId, map)
    return sense ? { err, sense, steps: errorPracticeSteps(err, sense) } : null
  }, [errorId])
  const ctx = useCtx(data.data?.err.lang ?? profile.activeLang, { context: 'error-practice', source: 'error-practice' })
  if (data.loading) return <Loading />
  if (!data.data) return <p className="page">Kayıt bulunamadı.</p>
  const { err, steps } = data.data
  return (
    <Player
      title="Hata pratiği"
      steps={steps}
      ctx={ctx}
      onFinish={async (results) => {
        const ok = results.filter((r) => r.scored).every((r) => r.correct)
        await repo.updateError(err.id, { practicedCount: err.practicedCount + 1, lastPracticedAt: Date.now(), resolved: ok })
      }}
      onClose={() => {
        bump()
        go('#/words?tab=errors')
      }}
    />
  )
}

export function SkipCheckScreen({ lessonId }: { lessonId: string }) {
  const lang = lessonLang(lessonId)
  const loaded = useLangContent(lang)
  if (!loaded.ready) return <Loading text="Kelimeler yükleniyor…" />
  return <SkipCheckInner lessonId={lessonId} />
}

function SkipCheckInner({ lessonId }: { lessonId: string }) {
  const { repo, bump } = useApp()
  const lesson = content.lessons.get(lessonId)
  const steps = useMemo(() => (lesson ? skipCheckSteps(lesson) : []), [lesson])
  const ctx = useCtx(lesson?.lang ?? 'ru', { context: lesson?.track === 'industry' ? 'industry' : 'core', industryId: lesson?.industry, recordOnlyCorrect: true, source: 'placement' })
  if (!lesson) return <p className="page">Ders bulunamadı.</p>
  return (
    <Player
      title={`Kısa kontrol: ${lesson.title}`}
      steps={steps}
      ctx={ctx}
      showNextDue={false}
      onFinish={async (results) => {
        if (results.every((r) => !r.scored || r.correct)) {
          await repo.saveLessonState({ lang: lesson.lang, lessonId: lesson.id, track: lesson.track, industryId: lesson.industry, status: 'skipped-known', step: 0 })
        }
      }}
      finishExtra={(results) =>
        results.every((r) => !r.scored || r.correct) ? (
          <div className="notice good">Hepsini tanıdın. Ders "biliyorum" olarak işaretlendi; tanıdığın kelimeler yine de aralıklı tekrara alındı.</div>
        ) : (
          <div className="notice warn">Bazılarını tanımadın. Bu dersi yapman önerilir.</div>
        )
      }
      onClose={() => {
        bump()
        go(backRoute(lesson))
      }}
    />
  )
}

/** Birim kontrolü: 50 kelimelik bir birimden 10 kelime sorulur; en az 9 doğruysa birim "biliyorum" olarak işaretlenir. */
export function SkipUnitScreen({ lang, unit }: { lang: string; unit: number }) {
  const loaded = useLangContent(lang)
  if (!loaded.ready) return <Loading text="Kelimeler yükleniyor…" />
  return <SkipUnitInner lang={lang} unit={unit} />
}

function SkipUnitInner({ lang, unit }: { lang: string; unit: number }) {
  const { repo, bump } = useApp()
  const lessons = content.coreLessons(lang).filter((l) => l.unit === unit)
  const steps = useMemo(() => unitCheckSteps(lessons, `unit-${lang}-${unit}`), [lessons, lang, unit])
  const ctx = useCtx(lang, { recordOnlyCorrect: true, source: 'placement' })
  if (!lessons.length) return <p className="page">Birim bulunamadı.</p>
  const passed = (results: { scored: boolean; correct?: boolean }[]) => results.filter((r) => r.scored && r.correct).length >= Math.min(9, results.length)
  return (
    <Player
      title={`Birim ${unit} kontrolü`}
      steps={steps}
      ctx={ctx}
      showNextDue={false}
      onFinish={async (results) => {
        if (!passed(results)) return
        const states = await repo.lessonStates(lang)
        for (const l of lessons) {
          if (states.some((s) => s.lessonId === l.id)) continue
          await repo.saveLessonState({ lang, lessonId: l.id, track: 'core', status: 'skipped-known', step: 0 })
        }
      }}
      finishExtra={(results) =>
        passed(results) ? (
          <div className="notice good">Bu birimi büyük ölçüde biliyorsun; dersleri "biliyorum" olarak işaretlendi. Doğru bildiğin kelimeler aralıklı tekrara alındı, diğerleri ileride karşına çıkabilir.</div>
        ) : (
          <div className="notice warn">10 kelimeden en az 9'unu bilmen gerekiyordu. Bu birimin derslerini yapman önerilir.</div>
        )
      }
      onClose={() => {
        bump()
        go('#/learn')
      }}
    />
  )
}
