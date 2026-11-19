import { useState } from 'react'
import { useApp, useAsync } from '../app/context'
import { go } from '../app/router'
import { getLanguage } from '../content/languages'
import { content } from '../content/registry'
import { formatDue } from '../domain/planner'
import type { StudySession } from '../domain/types'
import { Dialog, GlossLine, Headword, LangSwitcher, LinkRow } from '../ui/components'
import { Icon } from '../ui/icons'
import { dayInfo, daySummary, estimateMinutes, planSession } from './daily'
import { ContentGate } from './Tabs'

// Bugün: tek baskın düğmeyle başlayan günlük çalışma. Ayrıntılar (kariyer raporu, kaynak istatistikleri,
// değerlendirme kuyruğu) burada değil, Profil ve Keşfet'te.

export function TodayScreen({ recovered }: { recovered: boolean }) {
  const { profile } = useApp()
  return (
    <ContentGate lang={profile.activeLang}>
      <TodayInner recovered={recovered} />
    </ContentGate>
  )
}

function TodayInner({ recovered }: { recovered: boolean }) {
  const { repo, profile, updateProfile, dataVersion } = useApp()
  const lang = profile.activeLang
  const [moreOpen, setMoreOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const { data } = useAsync(async () => {
    const active = await repo.activeSession(lang)
    const states = await repo.lessonStates(lang)
    const lessonInProgress = states
      .filter((s) => s.status === 'in-progress' && content.lessons.has(s.lessonId))
      .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    const info = await dayInfo(repo, profile, lang)
    const plan = active ? null : await planSession(repo, profile, lang)
    const summary = await daySummary(repo, lang)
    const skills = await repo.skillsForLang(lang)
    const nextDue = skills.filter((s) => s.skill !== 'produce' && !s.deleted).map((s) => s.due).sort((a, b) => a - b)[0]
    const sounds = content.soundLessons(lang)
    const soundsLeft = sounds.filter((l) => !states.some((s) => s.lessonId === l.id && s.status !== 'in-progress')).length
    return { active, lessonInProgress, info, plan, summary, nextDue, soundsLeft }
  }, [lang, dataVersion, profile.newPerDay, profile.dailyMinutes])

  const start = async (s: StudySession) => {
    setBusy(true)
    await repo.saveSession(s)
    go(`#/session/${s.id}`)
  }
  const more = async () => {
    setBusy(true)
    const s = await planSession(repo, profile, lang, { extra: true })
    if (s) await start(s)
    else setBusy(false)
  }

  const wod = data?.info.wodSenseId ? content.senses.get(data.info.wodSenseId) : undefined
  const knowsLang = profile.knownLanguages.some((k) => k.lang === lang)
  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
  const lessonTitle = data?.lessonInProgress ? content.lessons.get(data.lessonInProgress.lessonId)?.title : undefined

  return (
    <div className="page today">
      <div className="page-head">
        <div>
          <h1>Bugün</h1>
          <p>{today}</p>
        </div>
        <LangSwitcher value={lang} options={profile.targetLanguages} onChange={(l) => updateProfile({ activeLang: l })} />
      </div>

      {recovered ? <div className="notice warn">Yarım kalmış bir demo oturumu vardı. Misafir verileri silindi; senin kayıtların değişmedi.</div> : null}

      <div className="today-grid">
        <section className="hero" aria-label="Bugünkü çalışma">
          {wod ? (
            <div className="wod">
              <p className="hero-label">Günün kelimesi</p>
              <Headword sense={wod} profile={profile} />
              <GlossLine sense={wod} profile={profile} />
            </div>
          ) : null}

          <div className="hero-plan">
            {!data ? (
              <p className="muted">Hazırlanıyor…</p>
            ) : data.active ? (
              <>
                <p className="plan-lead">
                  Yarım kalan çalışman var: {data.active.steps.length} adımın {Math.min(data.active.index, data.active.steps.length)} tanesi bitti.
                </p>
                <button className="btn btn-primary btn-hero" onClick={() => go(`#/session/${data.active!.id}`)}>
                  Kaldığım yerden devam et
                </button>
              </>
            ) : data.lessonInProgress && lessonTitle ? (
              <>
                <p className="plan-lead">Yarım kalan ders: {lessonTitle}</p>
                <button className="btn btn-primary btn-hero" onClick={() => go(`#/lesson/${data.lessonInProgress!.lessonId}?from=today`)}>
                  Kaldığım yerden devam et
                </button>
                {data.plan ? (
                  <button className="btn btn-ghost" disabled={busy} onClick={() => void start(data.plan!)}>
                    Bunun yerine bugünkü çalışmaya başla
                  </button>
                ) : null}
              </>
            ) : data.plan ? (
              <>
                <dl className="plan-facts">
                  <div>
                    <dt>Süre</dt>
                    <dd>yaklaşık {estimateMinutes(data.plan.steps)} dk</dd>
                  </div>
                  <div>
                    <dt>Tekrar</dt>
                    <dd>{data.plan.reviewCount ? `${data.plan.reviewCount} kelime` : 'yok'}</dd>
                  </div>
                  <div>
                    <dt>Yeni</dt>
                    <dd>{data.plan.newSenseIds.length ? `${data.plan.newSenseIds.length} kelime` : 'bugünkü hedef doldu'}</dd>
                  </div>
                </dl>
                <button className="btn btn-primary btn-hero" disabled={busy} onClick={() => void start(data.plan!)}>
                  {data.summary.sessionsDone ? 'Sıradaki kısa oturuma başla' : 'Bugünkü çalışmama başla'}
                </button>
                <p className="tiny muted">
                  Bugün {data.info.introducedToday} / {data.info.newTarget} yeni kelime. Süre bir tahmindir.
                </p>
              </>
            ) : (
              <>
                <h2 className="done-title">Bugünlük tamam</h2>
                <p>
                  {data.summary.newToday || data.summary.reviewedToday
                    ? `${data.summary.newToday} yeni kelime öğrendin, ${data.summary.reviewedToday} kelimeyi tekrar ettin.`
                    : 'Bugün için planlanmış tekrar ya da yeni kelime yok.'}
                </p>
                {data.nextDue ? <p className="small muted">Sıradaki tekrar {formatDue(data.nextDue)}.</p> : null}
                <button className="btn btn-soft" onClick={() => setMoreOpen(true)}>
                  Biraz daha çalış
                </button>
              </>
            )}
          </div>
        </section>

        <aside className="today-side" aria-label="Diğer seçenekler">
          <h2 className="section-title">İstersen</h2>
          <div className="rows">
            {data && data.soundsLeft > 0 && !knowsLang ? (
              <LinkRow href="#/sounds" icon={<Icon.pen />} title="Sesler ve Harfler" detail={`${getLanguage(lang).nameTr} alfabesi ve okunuşu, ${data.soundsLeft} ders kaldı`} />
            ) : null}
            <LinkRow href="#/learn" icon={<Icon.learn />} title="Ders kütüphanesi" detail="Dersleri sırayla ya da istediğin yerden çalış" />
            <LinkRow href="#/explore" icon={<Icon.explore />} title="Keşfet" detail="Kelime ara, koleksiyonun, sektör terimleri, ek pratik" />
          </div>
        </aside>
      </div>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Biraz daha çalış">
        <p>
          Bugünkü yeni kelime hedefin ({data?.info.newTarget ?? profile.newPerDay}) doldu. İstersen hedefin dışında devam edebilirsin; yeni kelimeler
          sonraki günlerin tekrar yükünü artırır.
        </p>
        <button className="btn btn-primary" disabled={busy} onClick={() => void more()}>
          Hedefin dışında birkaç yeni kelime öğren
        </button>
        <a className="btn" href="#/explore">
          Ek pratik seç
        </a>
      </Dialog>
    </div>
  )
}
