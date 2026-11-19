import { useState, type ReactNode } from 'react'
import { useApp, useAsync, useLangContent } from '../app/context'
import { go } from '../app/router'
import { INDUSTRIES, getIndustry } from '../content/industries'
import { getLanguage, LANGUAGES } from '../content/languages'
import { content } from '../content/registry'
import { soundModule } from '../content/sounds'
import type { Lesson } from '../content/types'
import { computeCareer, WORD_STEPS } from '../domain/career'
import type { CareerGoal, LessonState } from '../domain/types'
import { BackLink, Card, LangSwitcher, Progress } from '../ui/components'
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
  const statusOf = (id: string) => states?.find((s) => s.lessonId === id)
  const firstOpenUnit = [...units.entries()].find(([, ls]) => ls.some((l) => !isDone(states, l.id)))?.[0]
  const idx = content.indexes.get(lang)

  const lessonRow = (l: Lesson) => <LessonRow key={l.id} lesson={l} state={statusOf(l.id)} />

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <BackLink href="#/explore" label="Keşfet" />
          <h1>Ders kütüphanesi</h1>
          <p>Her ders 5 kelime: önce tanış, sonra tanı. Yazma ve cümle kurma sonraki tekrarlarda gelir.</p>
        </div>
        <LangSwitcher value={lang} options={profile.targetLanguages} onChange={(l) => updateProfile({ activeLang: l })} />
      </div>

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

    </div>
  )
}

/** Ders kütüphanesi satırı */
export function LessonRow({ lesson: l, state: st }: { lesson: Lesson; state?: LessonState }) {
  return (
    <div className="lesson-row">
      <span className="grow">
        <span className="row-title">{l.title}</span>
        <span className="row-detail" lang={l.lang}>
          {l.senseIds.map((id) => content.senses.get(id)).filter(Boolean).map((s) => content.lemma(s!)).join(', ')}
        </span>
      </span>
      {st?.status === 'completed' ? <span className="pill good">Tamam</span> : st?.status === 'skipped-known' ? <span className="pill info">Biliyorum</span> : null}
      <button className="btn btn-soft" onClick={() => go(`#/lesson/${l.id}`)}>
        {st?.status === 'in-progress' ? 'Devam' : st ? 'Tekrar' : 'Başla'}
      </button>
    </div>
  )
}

/** Sesler ve Harfler (Keşfet › Öğrenme yolu) */
export function SoundsScreen() {
  const { profile } = useApp()
  return (
    <ContentGate lang={profile.activeLang}>
      <SoundsInner />
    </ContentGate>
  )
}

function SoundsInner() {
  const { repo, profile, updateProfile, dataVersion } = useApp()
  const lang = profile.activeLang
  const { data: states } = useAsync(() => repo.lessonStates(lang), [lang, dataVersion])
  const lessons = content.soundLessons(lang)
  const done = lessons.filter((l) => isDone(states, l.id)).length
  const next = lessons.find((l) => !isDone(states, l.id))
  const notes = lang === 'hu' ? getLanguage('hu').letterNotes ?? [] : []
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <BackLink href="#/explore" label="Keşfet" />
          <h1>Sesler ve Harfler</h1>
          <p>{soundModule(lang)?.intro}</p>
        </div>
        <LangSwitcher value={lang} options={profile.targetLanguages} onChange={(l) => updateProfile({ activeLang: l })} />
      </div>
      {lessons.length ? (
        <>
          <div className="stack" style={{ gap: 6 }}>
            <p className="small muted">{lessons.length} dersin {done} tanesi tamam.</p>
            <Progress value={done / lessons.length} label="Sesler ve Harfler ilerlemesi" />
          </div>
          {next ? (
            <button className="btn btn-primary" onClick={() => go(`#/lesson/${next.id}`)}>
              {done ? 'Sıradaki derse devam et' : 'İlk dersle başla'}
            </button>
          ) : null}
          <div className="rows">{lessons.map((l) => <LessonRow key={l.id} lesson={l} state={states?.find((s) => s.lessonId === l.id)} />)}</div>
        </>
      ) : (
        <p className="muted">Bu dil için Sesler ve Harfler bölümü yok.</p>
      )}
      {notes.length ? (
        <details className="details">
          <summary>Macarca harf notları (Türkçe konuşanlar için)</summary>
          <div className="list small">
            {notes.map((n) => (
              <div className="list-item" key={n.letters}>
                <b style={{ minWidth: 90 }} lang="hu">{n.letters}</b>
                <span>{n.note}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------- Hedef (Profil › Hedef) ve sektörler (Keşfet › Sektör)
export function GoalScreen() {
  const { profile } = useApp()
  const lang = profile.career?.lang ?? profile.activeLang
  return (
    <ContentGate lang={lang}>
      <GoalInner />
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

function GoalInner() {
  const { repo, profile, updateProfile, dataVersion } = useApp()
  const [editing, setEditing] = useState(false)
  const goal = profile.career
  const { data: rep } = useAsync(async () => (goal ? computeCareer(repo, goal) : null), [dataVersion, goal])
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <BackLink href="#/profile" label="Profil" />
          <h1>Hedefim</h1>
          <p>Kariyer hedefin ve gelişim yolun.</p>
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

    </div>
  )
}

/** Sektör listesi (Keşfet › Sektör): önce dil, sonra sektör */
export function IndustriesScreen({ langParam }: { langParam?: string | null }) {
  const { repo, profile, dataVersion } = useApp()
  const indLang = langParam ?? profile.activeLang
  const { data: tracks } = useAsync(() => repo.industryTracks(indLang), [indLang, dataVersion])
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <BackLink href="#/explore" label="Keşfet" />
          <h1>Sektör terimleri</h1>
          <p>Önce dili, sonra sektörü seç. Sektör ilerlemen genel ilerlemenden ayrı tutulur.</p>
        </div>
      </div>
      <div className="lang-grid">
        {profile.targetLanguages.map((l) => (
          <button key={l} className="lang-btn" aria-pressed={l === indLang} onClick={() => go(`#/industries?lang=${l}`)}>
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

/** Bir sektörün dersleri (Keşfet › Sektör › sektör) */
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
          <BackLink href={`#/industries?lang=${lang}`} label="Sektörler" />
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
