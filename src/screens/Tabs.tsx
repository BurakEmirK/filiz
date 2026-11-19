import { useState, type ReactNode } from 'react'
import { useApp, useAsync, useLangContent } from '../app/context'
import { go } from '../app/router'
import { INDUSTRIES, getIndustry } from '../content/industries'
import { getLanguage, LANGUAGES } from '../content/languages'
import { content } from '../content/registry'
import { soundModule } from '../content/sounds'
import type { Lesson } from '../content/types'
import { computeCareer, WORD_STEPS } from '../domain/career'
import { getTodayPlan } from '../domain/services'
import type { CareerGoal, LessonState } from '../domain/types'
import { Card, LangSwitcher, Progress, SenseImage, WordHeader } from '../ui/components'
import { Icon } from '../ui/icons'

export function ContentGate({ lang, children }: { lang: string; children: ReactNode }) {
  const st = useLangContent(lang)
  if (!st.ready) return <div className="page muted">{getLanguage(lang).nameTr} kelimeleri yükleniyor… (ilk açılışta internet gerekir, sonra cihazda saklanır)</div>
  return (
    <>
      {st.error ? <div className="page"><div className="notice warn">Sık kelime paketi yüklenemedi: {st.error}. Başlangıç dersleri çalışır.</div></div> : null}
      {children}
    </>
  )
}

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
  const { data: plan } = useAsync(() => getTodayPlan(repo, profile, lang), [lang, dataVersion, profile.dailyMinutes, profile.newPerDay])
  const states = useAsync(() => repo.lessonStates(lang), [lang, dataVersion])
  const career = useAsync(async () => (profile.career ? computeCareer(repo, profile.career) : null), [dataVersion, profile.career])
  const inProgress = states.data?.find((s) => s.status === 'in-progress')
  const nextLesson = content.coreLessons(lang).find((l) => !states.data?.some((s) => s.lessonId === l.id && s.status !== 'in-progress'))
  const wod = plan?.wordOfDay ? content.senses.get(plan.wordOfDay.senseId) : undefined
  const info = getLanguage(lang)
  const knowsLang = profile.knownLanguages.some((k) => k.lang === lang)
  const soundLessons = content.soundLessons(lang)
  const soundsDone = soundLessons.filter((l) => states.data?.some((s) => s.lessonId === l.id && s.status !== 'in-progress')).length
  const suggestSounds = !knowsLang && soundLessons.length > 0 && soundsDone < soundLessons.length

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

      {suggestSounds ? (
        <Card title="Sıfırdan başlıyorsan: Sesler ve Harfler" icon={<Icon.learn />} className="accent">
          <p className="small">{soundModule(lang)?.intro}</p>
          <Progress value={soundsDone / soundLessons.length} label="Sesler ve Harfler ilerlemesi" />
          <button className="btn btn-primary" onClick={() => go(`#/lesson/${(soundLessons.find((l) => !states.data?.some((s) => s.lessonId === l.id && s.status !== 'in-progress')) ?? soundLessons[0]).id}`)}>
            {soundsDone ? 'Devam et' : 'Başla'}
          </button>
        </Card>
      ) : null}

      <div className="grid-2">
        {wod ? (
          <Card title="Günün Kelimesi" icon={<Icon.sparkle />} className={suggestSounds ? '' : 'accent'}>
            <div className="sense-hero compact">
              <SenseImage sense={wod} />
              <WordHeader sense={wod} profile={profile} small />
            </div>
            {plan?.wordOfDay?.relatedSenseIds.length ? (
              <p className="small muted">
                Bağlantılı tekrar: {plan.wordOfDay.relatedSenseIds.map((id) => content.senses.get(id)).filter(Boolean).map((s) => content.lemma(s!)).join(', ')}
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
          {inProgress && content.lessons.get(inProgress.lessonId) ? (
            <button className="btn btn-primary" onClick={() => go(`#/lesson/${inProgress.lessonId}`)}>
              Devam et: {content.lessons.get(inProgress.lessonId)?.title}
            </button>
          ) : nextLesson ? (
            <button className="btn btn-primary" onClick={() => go(`#/lesson/${nextLesson.id}`)}>
              Sıradaki ders: {nextLesson.title}
            </button>
          ) : (
            <p className="muted">Bu dildeki derslerin hepsi bitti.</p>
          )}
        </Card>

        {career.data ? (
          <Card title="Kariyer hedefin" icon={<Icon.flame />}>
            <p className="small">{career.data.goal.title}</p>
            <Progress value={career.data.overall} label="Kariyer hedefi ilerlemesi" />
            <p className="tiny muted">
              %{Math.round(career.data.overall * 100)} · {career.data.wordsIntroduced}/{career.data.goal.targetWords} kelime
              {career.data.projectedDate ? ` · bu hızla tahmini bitiş ${career.data.projectedDate}` : ''}
            </p>
            <button className="btn" onClick={() => go('#/career')}>Yol haritasını gör</button>
          </Card>
        ) : null}

        <Card title="Değerlendirme bekleyenler" icon={<Icon.clock />}>
          <p>
            <b>{plan?.pendingCount ?? 0}</b> <span className="muted">cümle çevrimiçi değerlendirmeyi bekliyor.</span>
          </p>
          <p className="tiny muted">Çevrimiçi değerlendirme sonraki aşamada bağlanacak. Cevapların kaybolmaz.</p>
        </Card>
      </div>
    </div>
  )
}

const isDone = (states: LessonState[] | undefined, id: string) => states?.some((s) => s.lessonId === id && s.status !== 'in-progress')

export function LearnScreen() {
  const { profile } = useApp()
  return (
    <ContentGate lang={profile.activeLang}>
      <LearnInner />
    </ContentGate>
  )
}

function LearnInner() {
  const { repo, profile, updateProfile, dataVersion } = useApp()
  const lang = profile.activeLang
  const { data: states } = useAsync(() => repo.lessonStates(lang), [lang, dataVersion])
  const all = content.coreLessons(lang)
  const starter = all.filter((l) => !l.id.startsWith('g-'))
  const freq = all.filter((l) => l.id.startsWith('g-'))
  const units = new Map<number, Lesson[]>()
  for (const l of freq) units.set(l.unit ?? 1, [...(units.get(l.unit ?? 1) ?? []), l])
  const soundLessons = content.soundLessons(lang)
  const soundsDone = soundLessons.filter((l) => isDone(states, l.id)).length
  const statusOf = (id: string) => states?.find((s) => s.lessonId === id)
  const firstOpenUnit = [...units.entries()].find(([, ls]) => ls.some((l) => !isDone(states, l.id)))?.[0]
  const idx = content.indexes.get(lang)

  const lessonRow = (l: Lesson) => {
    const st = statusOf(l.id)
    return (
      <div className="spread" key={l.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
        <span className="small">
          <b>{l.title}</b>
          <span className="muted" lang={lang}> · {l.senseIds.map((id) => content.senses.get(id)).filter(Boolean).map((s) => content.lemma(s!)).join(', ')}</span>
        </span>
        <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          {st?.status === 'completed' ? <span className="pill good">✓</span> : st?.status === 'skipped-known' ? <span className="pill info">Biliyorum</span> : null}
          <button className="btn btn-soft" onClick={() => go(`#/lesson/${l.id}`)}>
            {st?.status === 'in-progress' ? 'Devam' : st ? 'Tekrar' : 'Başla'}
          </button>
        </span>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Öğren</h1>
          <p>Kısa dersler: tanı, dinle, yaz, kendi cümleni kur.</p>
        </div>
        <LangSwitcher value={lang} options={profile.targetLanguages} onChange={(l) => updateProfile({ activeLang: l })} />
      </div>

      {soundLessons.length ? (
        <Card title="Sesler ve Harfler" icon={<Icon.pen />}>
          <p className="small muted">{soundModule(lang)?.intro}</p>
          <Progress value={soundLessons.length ? soundsDone / soundLessons.length : 0} label="Sesler ve Harfler ilerlemesi" />
          <div>{soundLessons.map(lessonRow)}</div>
        </Card>
      ) : null}

      <Card title="Başlangıç dersleri" icon={<Icon.learn />}>
        <p className="tiny muted">Elle hazırlanmış, resimli kısa dersler.</p>
        <div>{starter.map(lessonRow)}</div>
      </Card>

      {freq.length ? (
        <>
          <div className="spread">
            <h2>En sık {idx?.count ?? freq.length * 5} kelime</h2>
            <span className="pill">{freq.filter((l) => isDone(states, l.id)).length}/{freq.length} ders</span>
          </div>
          <p className="tiny muted">
            Sıra, kelimelerin gerçek kullanım sıklığına göredir (wordfreq). Sıklık sırası CEFR seviyesi değildir. Bildiğin birimleri kısa bir kontrolle
            atlayabilirsin.
          </p>
          <div className="stack">
            {[...units.entries()].map(([u, ls]) => {
              const done = ls.filter((l) => isDone(states, l.id)).length
              const from = (u - 1) * 50 + 1
              return (
                <details className="unit" key={u} open={u === firstOpenUnit}>
                  <summary>
                    <span>
                      <b>Birim {u}</b> <span className="muted small">· kelime {from}–{from + ls.reduce((a, l) => a + l.senseIds.length, 0) - 1}</span>
                    </span>
                    <span className={`pill ${done === ls.length ? 'good' : ''}`}>{done}/{ls.length}</span>
                  </summary>
                  <div className="unit-body">
                    {done < ls.length ? (
                      <div className="row" style={{ paddingBottom: 6 }}>
                        <button className="btn btn-primary" onClick={() => go(`#/lesson/${(ls.find((l) => !isDone(states, l.id)) ?? ls[0]).id}`)}>
                          Sıradaki ders
                        </button>
                        <button className="btn btn-ghost" onClick={() => go(`#/skipunit/${lang}/${u}`)}>
                          Bu birimi biliyorum (kontrol)
                        </button>
                      </div>
                    ) : null}
                    {u === firstOpenUnit || done < ls.length ? ls.map(lessonRow) : null}
                  </div>
                </details>
              )
            })}
          </div>
        </>
      ) : null}

      <Card title="Gerçek hayat görevleri" icon={<Icon.users />}>
        <p className="muted">Alışveriş, ev kiralama ve üniversitede soru sorma görevleri sonraki aşamada eklenecek. İş görevleri şimdilik Kariyer → Tekstil içinde.</p>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- Kariyer
export function CareerScreen({ langParam }: { langParam?: string | null }) {
  const { profile } = useApp()
  const lang = profile.career?.lang ?? profile.activeLang
  return (
    <ContentGate lang={lang}>
      <CareerInner langParam={langParam} />
    </ContentGate>
  )
}

function GoalForm({ initial, onSave, onCancel }: { initial?: CareerGoal; onSave: (g: CareerGoal) => void; onCancel?: () => void }) {
  const { profile } = useApp()
  const inYear = new Date(Date.now() + 365 * 24 * 3600_000).toISOString().slice(0, 10)
  const [g, setG] = useState<CareerGoal>(
    initial ?? { title: '', lang: profile.activeLang, industryId: profile.interests.includes('textile') ? 'textile' : undefined, targetWords: 3000, targetDate: inYear, createdAt: Date.now() },
  )
  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="cg-title">Hedefin (kendi cümlelerinle)</label>
        <input id="cg-title" className="input" placeholder="ör. Rusça ile tekstil ihracatında çalışmak" value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="cg-lang">Dil</label>
          <select id="cg-lang" className="input" value={g.lang} onChange={(e) => setG({ ...g, lang: e.target.value })}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.nameTr}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cg-ind">Sektör (isteğe bağlı)</label>
          <select id="cg-ind" className="input" value={g.industryId ?? ''} onChange={(e) => setG({ ...g, industryId: e.target.value || undefined })}>
            <option value="">—</option>
            {INDUSTRIES.map((i) => <option key={i.id} value={i.id}>{i.nameTr}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cg-words">Hedef kelime sayısı</label>
          <select id="cg-words" className="input" value={g.targetWords} onChange={(e) => setG({ ...g, targetWords: Number(e.target.value) })}>
            {WORD_STEPS.map((n) => <option key={n} value={n}>En sık {n} kelime</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cg-date">Hedef tarih</label>
          <input id="cg-date" type="date" className="input" value={g.targetDate} onChange={(e) => setG({ ...g, targetDate: e.target.value })} />
        </div>
      </div>
      <p className="tiny muted">Kelime sayısı bir seviye belgesi değildir; ilerlemeyi ölçmek için kullanılan bir göstergedir.</p>
      <div className="row">
        {onCancel ? <button className="btn" onClick={onCancel}>Vazgeç</button> : null}
        <button className="btn btn-primary" disabled={!g.title.trim() || !g.targetDate} onClick={() => onSave({ ...g, title: g.title.trim() })}>Kaydet</button>
      </div>
    </div>
  )
}

function CareerInner({ langParam }: { langParam?: string | null }) {
  const { repo, profile, updateProfile, dataVersion } = useApp()
  const [editing, setEditing] = useState(false)
  const goal = profile.career
  const { data: rep } = useAsync(async () => (goal ? computeCareer(repo, goal) : null), [dataVersion, goal])
  const indLang = langParam ?? goal?.lang ?? profile.activeLang
  const { data: tracks } = useAsync(() => repo.industryTracks(indLang), [indLang, dataVersion])
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Kariyer</h1>
          <p>Hedefin, gelişim yolun ve sektör terimleri.</p>
        </div>
      </div>

      {!goal || editing ? (
        <Card title={goal ? 'Hedefi düzenle' : 'Kariyer hedefi belirle'} icon={<Icon.flame />} className="accent">
          {!goal ? <p className="small">Bir hedef koyarsan uygulama sana adım adım bir yol haritası çıkarır ve gerçek çalışma hızına göre ne zaman ulaşabileceğini tahmin eder.</p> : null}
          <GoalForm
            initial={goal}
            onCancel={goal ? () => setEditing(false) : undefined}
            onSave={async (g) => {
              await updateProfile({ career: g, targetLanguages: profile.targetLanguages.includes(g.lang) ? profile.targetLanguages : [...profile.targetLanguages, g.lang] })
              setEditing(false)
            }}
          />
        </Card>
      ) : rep ? (
        <Card title={goal.title} icon={<Icon.flame />} className="accent" action={<button className="btn btn-ghost" onClick={() => setEditing(true)}>Düzenle</button>}>
          <p className="small muted">
            {getLanguage(goal.lang).nameTr}
            {goal.industryId ? ` · ${getIndustry(goal.industryId).nameTr}` : ''} · hedef tarih {goal.targetDate}
          </p>
          <Progress value={rep.overall} label="Genel ilerleme" />
          <div>
            {rep.milestones.map((m) => {
              const active = !m.completed && rep.milestones.find((x) => !x.completed)?.id === m.id
              return (
                <div className="milestone" key={m.id}>
                  <span className={`dot ${m.completed ? 'done' : active ? 'active' : ''}`} aria-hidden="true">{m.completed ? '✓' : ''}</span>
                  <span>
                    <b>{m.title}</b>
                    {m.total ? <Progress value={m.done / m.total} label={m.title} /> : null}
                  </span>
                  <span className="pill">{m.done}/{m.total}</span>
                </div>
              )
            })}
          </div>
          <div className="notice">
            <span className="small">
              Son 14 günde günde ortalama <b>{rep.pacePerDay}</b> yeni kelimeye başladın.{' '}
              {rep.projectedDate ? <>Bu hızla {goal.targetWords} kelimeye tahmini <b>{rep.projectedDate}</b> tarihinde ulaşırsın. </> : 'Tahmin için birkaç gün çalışma verisi gerekiyor. '}
              {rep.daysLeft > 0 ? <>Hedef tarihe yetişmek için günde yaklaşık <b>{rep.neededPerDay}</b> yeni kelime gerekiyor.</> : 'Hedef tarih geçti; yeni bir tarih belirleyebilirsin.'}
            </span>
          </div>
          <p className="tiny muted">Bu bir tahmindir, garanti değildir. Kelime sayısı resmî bir seviye göstermez.</p>
          {rep.pacePerDay > 0 && rep.neededPerDay > profile.newPerDay ? (
            <button className="btn btn-soft" onClick={() => updateProfile({ newPerDay: Math.min(20, Math.ceil(rep.neededPerDay)) })}>
              Günlük yeni öğe sayısını {Math.min(20, Math.ceil(rep.neededPerDay))} yap
            </button>
          ) : null}
        </Card>
      ) : (
        <p className="muted">Yükleniyor…</p>
      )}

      <h2>Sektör terimleri</h2>
      <p className="small muted">Önce dili, sonra sektörü seç. Sektör ilerlemen genel seviyenden ayrı tutulur.</p>
      <div className="lang-grid">
        {profile.targetLanguages.map((l) => (
          <button key={l} className="lang-btn" aria-pressed={l === indLang} onClick={() => go(`#/career?lang=${l}`)}>
            <span className="native">{getLanguage(l).nativeName}</span>
            <span className="small muted">{getLanguage(l).nameTr}</span>
          </button>
        ))}
      </div>
      <div className="grid-2">
        {INDUSTRIES.map((ind) => {
          const lessons = content.industryLessons(indLang, ind.id)
          const started = tracks?.some((t) => t.industryId === ind.id)
          return (
            <button key={ind.id} className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => go(`#/industries/${ind.id}?lang=${indLang}`)}>
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

/** Bir sektörün dersleri (Kariyer → sektör) */
export function IndustryScreen({ industryId, langParam }: { industryId: string; langParam?: string | null }) {
  const { repo, profile, dataVersion } = useApp()
  const lang = langParam ?? profile.activeLang
  const { data: states } = useAsync(() => repo.lessonStates(lang), [lang, dataVersion])
  const { data: skills } = useAsync(() => repo.skillsForLang(lang), [lang, dataVersion])
  const setLang = (l: string) => go(`#/industries/${industryId}?lang=${l}`)
  const ind = getIndustry(industryId)
  const lessons = content.industryLessons(lang, ind.id)
  const introduced = new Set((skills ?? []).map((s) => s.senseId))
  const allIds = lessons.flatMap((l) => l.senseIds)
  const done = allIds.filter((id) => introduced.has(id)).length
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="btn btn-ghost" onClick={() => go(`#/career?lang=${lang}`)}>
            <Icon.back /> Kariyer
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
                      {l.taskIds?.length ? <p className="small">Pratik görev: {l.taskIds.map((t) => content.tasks.get(t)?.title).join(', ')}</p> : null}
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
