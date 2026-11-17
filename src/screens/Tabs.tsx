import { useApp, useAsync } from '../app/context'
import { go } from '../app/router'
import { INDUSTRIES, getIndustry } from '../content/industries'
import { getLanguage } from '../content/languages'
import { content } from '../content/registry'
import { getTodayPlan } from '../domain/services'
import { Card, LangSwitcher, Progress, SenseImage, WordHeader } from '../ui/components'
import { Icon } from '../ui/icons'

export function TodayScreen({ recovered }: { recovered: boolean }) {
  const { repo, profile, updateProfile, dataVersion } = useApp()
  const lang = profile.activeLang
  const { data: plan } = useAsync(() => getTodayPlan(repo, profile, lang), [lang, dataVersion, profile.dailyMinutes, profile.newPerDay])
  const states = useAsync(() => repo.lessonStates(lang), [lang, dataVersion])
  const inProgress = states.data?.find((s) => s.status === 'in-progress')
  const nextLesson = content.coreLessons(lang).find((l) => !states.data?.some((s) => s.lessonId === l.id && s.status !== 'in-progress'))
  const wod = plan?.wordOfDay ? content.senses.get(plan.wordOfDay.senseId) : undefined
  const info = getLanguage(lang)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Bugün</h1>
          <p>{info.nameTr} · günlük hedef {profile.dailyMinutes} dk</p>
        </div>
        <LangSwitcher value={lang} options={profile.targetLanguages} onChange={(l) => updateProfile({ activeLang: l })} />
      </div>

      {recovered ? <div className="notice warn">Yarım kalmış bir demo oturumu vardı. Misafir verileri silindi; senin kayıtların değişmedi.</div> : null}

      <div className="grid-2">
        {wod ? (
          <Card title="Günün Kelimesi" icon={<Icon.sparkle />} className="accent">
            <div className="sense-hero compact">
              <SenseImage sense={wod} />
              <WordHeader sense={wod} profile={profile} small />
            </div>
            {plan?.wordOfDay?.relatedSenseIds.length ? (
              <p className="small muted">
                Bağlantılı tekrar: {plan.wordOfDay.relatedSenseIds.map((id) => content.lemma(content.sense(id))).join(', ')}
              </p>
            ) : null}
            <button className="btn btn-primary" onClick={() => go('#/wod')}>
              Günün kelimesini çalış
            </button>
          </Card>
        ) : null}

        <Card title="Tekrar" icon={<Icon.refresh />}>
          {plan ? (
            <>
              <p>
                <b style={{ fontSize: '1.6em' }}>{plan.due.length}</b> <span className="muted">tekrar zamanı gelen öğe · ≈{plan.budget.reviewMinutes} dk</span>
              </p>
              <button className="btn btn-primary" disabled={plan.due.length === 0} onClick={() => go('#/review')}>
                {plan.due.length ? 'Tekrara başla' : 'Şu an tekrar yok'}
              </button>
            </>
          ) : (
            <p className="muted">Yükleniyor…</p>
          )}
        </Card>

        <Card title="Yeni öğrenme" icon={<Icon.learn />}>
          {plan ? <p className="small muted">{plan.budget.reason}</p> : null}
          {inProgress ? (
            <button className="btn btn-primary" onClick={() => go(`#/lesson/${inProgress.lessonId}`)}>
              Devam et: {content.lessons.get(inProgress.lessonId)?.title}
            </button>
          ) : nextLesson ? (
            <button className="btn btn-primary" onClick={() => go(`#/lesson/${nextLesson.id}`)}>
              Sıradaki ders: {nextLesson.title}
            </button>
          ) : (
            <p className="muted">Bu dildeki örnek derslerin hepsi bitti. Tam müfredat henüz yok.</p>
          )}
        </Card>

        <Card title="Değerlendirme bekleyenler" icon={<Icon.clock />}>
          <p>
            <b>{plan?.pendingCount ?? 0}</b> <span className="muted">cümle çevrimiçi değerlendirmeyi bekliyor.</span>
          </p>
          <p className="tiny muted">Çevrimiçi değerlendirme Aşama 2'de bağlanacak. Cevapların kaybolmaz.</p>
        </Card>
      </div>
    </div>
  )
}

export function LearnScreen() {
  const { repo, profile, updateProfile, dataVersion } = useApp()
  const lang = profile.activeLang
  const { data: states } = useAsync(() => repo.lessonStates(lang), [lang, dataVersion])
  const lessons = content.coreLessons(lang)
  const statusOf = (id: string) => states?.find((s) => s.lessonId === id)
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Öğren</h1>
          <p>Kısa dersler: tanı, hatırla, yaz, kendi cümleni kur.</p>
        </div>
        <LangSwitcher value={lang} options={profile.targetLanguages} onChange={(l) => updateProfile({ activeLang: l })} />
      </div>
      <div className="notice">Bunlar örnek derslerdir; {getLanguage(lang).nameTr} için tam bir müfredat değildir.</div>
      <div className="grid-2">
        {lessons.map((l) => {
          const st = statusOf(l.id)
          return (
            <Card key={l.id}>
              <div className="spread">
                <h2>{l.title}</h2>
                {st?.status === 'completed' ? <span className="pill good">Tamamlandı</span> : st?.status === 'skipped-known' ? <span className="pill info">Biliyorum</span> : st?.status === 'in-progress' ? <span className="pill accent">Devam ediyor</span> : <span className="pill">Yeni</span>}
              </div>
              <p className="small muted" lang={lang}>
                {l.senseIds.map((id) => content.lemma(content.sense(id))).join(' · ')}
              </p>
              <div className="row">
                <button className="btn btn-primary" onClick={() => go(`#/lesson/${l.id}`)}>
                  {st?.status === 'in-progress' ? 'Devam et' : st?.status === 'completed' ? 'Tekrar çalış' : 'Başla'}
                </button>
                {!st ? (
                  <button className="btn btn-ghost" onClick={() => go(`#/skipcheck/${l.id}`)}>
                    Biliyorum, atla
                  </button>
                ) : null}
              </div>
            </Card>
          )
        })}
      </div>
      <Card title="Gerçek hayat görevleri" icon={<Icon.users />}>
        <p className="muted">Alışveriş, ev kiralama ve üniversitede soru sorma görevleri Aşama 2'de eklenecek. İş görüşmesi görevleri şimdilik Sektörler → Tekstil içinde.</p>
      </Card>
    </div>
  )
}

export function IndustriesScreen({ industryId, langParam }: { industryId?: string; langParam?: string | null }) {
  const { repo, profile, dataVersion } = useApp()
  const lang = langParam ?? profile.activeLang
  const { data: states } = useAsync(() => repo.lessonStates(lang), [lang, dataVersion])
  const { data: tracks } = useAsync(() => repo.industryTracks(lang), [lang, dataVersion])
  const { data: skills } = useAsync(() => repo.skillsForLang(lang), [lang, dataVersion])
  const setLang = (l: string) => go(industryId ? `#/industries/${industryId}?lang=${l}` : `#/industries?lang=${l}`)

  if (!industryId) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1>Sektörler</h1>
            <p>Önce dili, sonra sektörü seç. Sektör ilerlemen genel seviyenden ayrı tutulur.</p>
          </div>
        </div>
        <div className="stack">
          <span className="label small">1. Dil</span>
          <div className="lang-grid">
            {profile.targetLanguages.map((l) => (
              <button key={l} className="lang-btn" aria-pressed={l === lang} onClick={() => setLang(l)}>
                <span className="native">{getLanguage(l).nativeName}</span>
                <span className="small muted">{getLanguage(l).nameTr}</span>
              </button>
            ))}
          </div>
        </div>
        <span className="label small">2. Sektör</span>
        <div className="grid-2">
          {INDUSTRIES.map((ind) => {
            const lessons = content.industryLessons(lang, ind.id)
            const started = tracks?.some((t) => t.industryId === ind.id)
            return (
              <button key={ind.id} className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => go(`#/industries/${ind.id}?lang=${lang}`)}>
                <div className="spread">
                  <h2>{ind.nameTr}</h2>
                  {lessons.length ? <span className="pill accent">Örnek içerik</span> : <span className="pill">İçerik yok</span>}
                </div>
                <p className="small muted">{ind.subtopics.map((s) => s.nameTr).join(' · ')}</p>
                {started ? <span className="pill good">Başladın</span> : null}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const ind = getIndustry(industryId)
  const lessons = content.industryLessons(lang, ind.id)
  const introduced = new Set((skills ?? []).map((s) => s.senseId))
  const allIds = lessons.flatMap((l) => l.senseIds)
  const done = allIds.filter((id) => introduced.has(id)).length
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="btn btn-ghost" onClick={() => go(`#/industries?lang=${lang}`)}>
            <Icon.back /> Sektörler
          </button>
          <h1>
            {ind.nameTr} · {getLanguage(lang).nameTr}
          </h1>
          <p>Genel {getLanguage(lang).nameTr} seviyen ne olursa olsun, bu bölüm baştan başlar.</p>
        </div>
        <LangSwitcher value={lang} options={profile.targetLanguages} onChange={setLang} />
      </div>
      {lessons.length ? (
        <>
          <Card>
            <div className="spread">
              <span>Sektör ilerlemesi (genelden ayrı)</span>
              <span className="pill">
                {done}/{allIds.length} terim
              </span>
            </div>
            <Progress value={allIds.length ? done / allIds.length : 0} label="Sektör ilerlemesi" />
          </Card>
          {ind.subtopics.map((sub) => {
            const subLessons = lessons.filter((l) => l.subtopic === sub.id)
            return (
              <Card key={sub.id} title={sub.nameTr}>
                {subLessons.length === 0 ? <p className="muted small">Bu alt konu için {getLanguage(lang).nameTr} içerik henüz yok.</p> : null}
                {subLessons.map((l) => {
                  const st = states?.find((s) => s.lessonId === l.id)
                  return (
                    <div key={l.id} className="stack" style={{ gap: 8 }}>
                      <div className="spread">
                        <h3>{l.title}</h3>
                        {st?.status === 'completed' ? <span className="pill good">Tamamlandı</span> : st?.status === 'in-progress' ? <span className="pill accent">Devam ediyor</span> : null}
                      </div>
                      <p className="small muted" lang={lang}>{l.senseIds.map((id) => content.lemma(content.sense(id))).join(' · ')}</p>
                      {l.taskIds?.length ? (
                        <p className="small">Pratik görev: {l.taskIds.map((t) => content.tasks.get(t)?.title).join(', ')}</p>
                      ) : null}
                      <div className="row">
                        <button className="btn btn-primary" onClick={() => go(`#/lesson/${l.id}`)}>
                          {st?.status === 'in-progress' ? 'Devam et' : st?.status === 'completed' ? 'Tekrar çalış' : 'Başla'}
                        </button>
                        {!st ? <button className="btn btn-ghost" onClick={() => go(`#/skipcheck/${l.id}`)}>Biliyorum, atla</button> : null}
                      </div>
                    </div>
                  )
                })}
              </Card>
            )
          })}
        </>
      ) : (
        <Card>
          <p>
            {ind.nameTr} için {getLanguage(lang).nameTr} içerik henüz yok. Yapı hazır: yeni terimler bir içerik paketi olarak eklendiğinde burada görünür.
          </p>
          {lang !== 'en' && ind.id === 'textile' ? <button className="btn" onClick={() => setLang('en')}>İngilizce tekstil içeriğine bak</button> : null}
        </Card>
      )}
    </div>
  )
}
