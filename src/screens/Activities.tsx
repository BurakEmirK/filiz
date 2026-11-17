import { useEffect, useMemo } from 'react'
import { go, rememberLearningRoute } from '../app/router'
import { useApp, useAsync } from '../app/context'
import { content } from '../content/registry'
import type { Sense } from '../content/types'
import { formatDue } from '../domain/planner'
import { getTodayPlan, personalSenseMap } from '../domain/services'
import { Player, type PlayerCtx } from './Player'
import { errorPracticeSteps, lessonSteps, reviewSteps, skipCheckSteps, wordOfDaySteps } from './steps'

// Tam ekran öğrenme etkinlikleri. Her biri adım adım kaydeder; kapatılırsa kaldığı yer korunur.

function useCtx(lang: string, extra: Partial<PlayerCtx> = {}): PlayerCtx {
  const { repo, profile } = useApp()
  return { repo, profile, lang, context: 'core', source: 'lesson', ...extra }
}

function Loading() {
  return (
    <div className="player">
      <div className="player-body">
        <p className="muted" style={{ padding: 24 }}>Yükleniyor…</p>
      </div>
    </div>
  )
}

export function LessonScreen({ lessonId }: { lessonId: string }) {
  const { repo, bump } = useApp()
  const lesson = content.lessons.get(lessonId)
  const steps = useMemo(() => (lesson ? lessonSteps(lesson) : []), [lesson])
  const ctx = useCtx(lesson?.lang ?? 'ru', lesson?.track === 'industry' ? { context: 'industry', industryId: lesson.industry } : {})
  const state = useAsync(async () => {
    if (!lesson) return null
    if (lesson.track === 'industry' && lesson.industry) await repo.ensureIndustryTrack(lesson.lang, lesson.industry)
    await repo.ensureTrack(lesson.lang)
    return (await repo.getLessonState(lesson.lang, lesson.id)) ?? null
  }, [lessonId])
  useEffect(() => rememberLearningRoute(`#/lesson/${lessonId}`), [lessonId])
  if (!lesson) return <p className="page">Ders bulunamadı.</p>
  if (state.loading) return <Loading />
  const startAt = state.data?.status === 'in-progress' ? state.data.step : 0
  const save = (step: number, status: 'in-progress' | 'completed') =>
    repo.saveLessonState({ lang: lesson.lang, lessonId: lesson.id, track: lesson.track, industryId: lesson.industry, status, step, completedAt: status === 'completed' ? Date.now() : undefined })
  return (
    <Player
      title={lesson.title}
      steps={steps}
      ctx={ctx}
      startAt={startAt}
      onStep={(next) => void save(next, next >= steps.length ? 'completed' : 'in-progress')}
      onFinish={() => rememberLearningRoute(null)}
      onClose={() => {
        bump()
        go(lesson.track === 'industry' ? `#/industries/${lesson.industry}?lang=${lesson.lang}` : '#/learn')
      }}
    />
  )
}

export function ReviewScreen() {
  const { repo, profile, bump } = useApp()
  const lang = profile.activeLang
  const ctx = useCtx(lang, { context: 'review', source: 'review' })
  const data = useAsync(async () => {
    const due = await repo.dueSkills(lang)
    const map = await personalSenseMap(repo, lang)
    const all = await repo.skillsForLang(lang)
    const next = all.filter((s) => s.skill !== 'produce' && !s.deleted).map((s) => s.due).sort((a, b) => a - b)[0]
    return { steps: reviewSteps(due, (id) => content.resolve(id, map)), next }
  }, [lang])
  if (data.loading || !data.data) return <Loading />
  const close = () => {
    bump()
    go('#/today')
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
    const plan = await getTodayPlan(repo, profile, lang)
    if (!plan.wordOfDay) return null
    const sense = content.sense(plan.wordOfDay.senseId)
    const related = plan.wordOfDay.relatedSenseIds.map((id) => content.senses.get(id)).filter((s): s is Sense => Boolean(s))
    const introduced = (await repo.introducedSenseIds(lang)).has(sense.id)
    return wordOfDaySteps(sense, related, introduced)
  }, [lang])
  if (data.loading) return <Loading />
  const close = () => {
    bump()
    go('#/today')
  }
  if (!data.data) return <p className="page">Bu dil için içerik yok.</p>
  return <Player title="Günün Kelimesi" steps={data.data} ctx={ctx} onClose={close} />
}

export function ErrorPracticeScreen({ errorId }: { errorId: string }) {
  const { repo, profile, bump } = useApp()
  const data = useAsync(async () => {
    const err = await repo.db.errors.get(errorId)
    if (!err) return null
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
  const { repo, bump } = useApp()
  const lesson = content.lessons.get(lessonId)
  const steps = useMemo(() => (lesson ? skipCheckSteps(lesson) : []), [lesson])
  const ctx = useCtx(lesson?.lang ?? 'ru', { context: lesson?.track === 'industry' ? 'industry' : 'core', industryId: lesson?.industry, recordOnlyCorrect: true })
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
          <div className="notice good">Hepsini tanıdın. Ders "biliyorum" olarak işaretlendi; kelimeler yine de aralıklı tekrara alındı.</div>
        ) : (
          <div className="notice warn">Bazılarını tanımadın. Bu dersi yapman önerilir.</div>
        )
      }
      onClose={() => {
        bump()
        go(lesson.track === 'industry' ? `#/industries/${lesson.industry}?lang=${lesson.lang}` : '#/learn')
      }}
    />
  )
}
