import { useRef, useState, type ReactNode } from 'react'
import { useApp, useAsync } from '../app/context'
import { LANGUAGES, getLanguage } from '../content/languages'
import { getIndustry } from '../content/industries'
import { content } from '../content/registry'
import type { Cefr } from '../content/types'
import type { BackupFile } from '../data/repo'
import { computeCareer } from '../domain/career'
import { evaluatorState } from '../domain/evaluation'
import { computeProgress } from '../domain/services'
import { SKILL_LABEL, type Profile, type Skill } from '../domain/types'
import { BackLink, Card, Chips, Dialog, LangSwitcher, LinkRow, Progress, Seg } from '../ui/components'
import { Icon } from '../ui/icons'
import { GoalScreen } from './Tabs'

const LEVELS: (Cefr | 'native')[] = ['native', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const LEVEL_LABEL = (l: Cefr | 'native') => (l === 'native' ? 'Ana dil' : l)
export const GOALS = [
  { value: 'work', label: 'İş / müşteri iletişimi' },
  { value: 'travel', label: 'Seyahat' },
  { value: 'study', label: 'Eğitim / üniversite' },
  { value: 'living', label: 'Yurt dışında yaşam' },
  { value: 'exam', label: 'Sınav' },
  { value: 'hobby', label: 'Merak / hobi' },
]
export const INTERESTS = [
  { value: 'textile', label: 'Tekstil' },
  { value: 'finance', label: 'Finans' },
  { value: 'it', label: 'Bilişim' },
  { value: 'engineering', label: 'Mühendislik' },
  { value: 'architecture', label: 'Mimarlık' },
  { value: 'food', label: 'Yemek' },
  { value: 'culture', label: 'Kültür' },
]

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

export type ProfileSection = 'learning' | 'appearance' | 'backup' | 'help' | 'sources' | 'progress' | 'goal'

/** Profil: kısa açılış ekranı + odaklı alt sayfalar */
export function ProfileScreen({ section }: { section?: string }) {
  const { profile, updateProfile } = useApp()
  switch (section as ProfileSection | undefined) {
    case 'learning':
      return (
        <SubPage title="Öğrenme tercihleri">
          <StudyCard profile={profile} update={updateProfile} />
          <ProfileCard profile={profile} update={updateProfile} />
        </SubPage>
      )
    case 'appearance':
      return (
        <SubPage title="Görünüm ve erişilebilirlik">
          <AppearanceCard profile={profile} update={updateProfile} />
        </SubPage>
      )
    case 'backup':
      return (
        <SubPage title="Yedekleme ve geri yükleme">
          <DataCard />
        </SubPage>
      )
    case 'help':
      return (
        <SubPage title="Yardım">
          <OtherCard />
          <EvaluationCard />
          <ReportsCard />
          <StatusCard />
        </SubPage>
      )
    case 'sources':
      return (
        <SubPage title="Kaynaklar ve lisanslar">
          <SourcesCard />
        </SubPage>
      )
    case 'progress':
      return (
        <SubPage title="Ayrıntılı ilerleme">
          <ProgressCard />
        </SubPage>
      )
    case 'goal':
      return <GoalScreen />
    default:
      return <ProfileHome />
  }
}

function SubPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <BackLink href="#/profile" label="Profil" />
          <h1>{title}</h1>
        </div>
      </div>
      {children}
    </div>
  )
}

function ProfileHome() {
  const { repo, profile, updateProfile, dataVersion } = useApp()
  const lang = profile.activeLang
  const { data } = useAsync(async () => {
    await content.ensureLanguage(lang).catch(() => undefined)
    const p = await computeProgress(repo, lang)
    const career = profile.career ? await computeCareer(repo, profile.career) : null
    return { p, career }
  }, [lang, dataVersion, profile.career])
  const name = getLanguage(lang).nameTr
  return (
    <div className="page narrow profile">
      <div className="page-head">
        <div>
          <h1>Profil</h1>
        </div>
      </div>

      <section className="card">
        <h2>Öğrendiğin diller</h2>
        <div className="row" role="group" aria-label="Etkin dil">
          {profile.targetLanguages.map((l) => (
            <button key={l} type="button" className="chip" aria-pressed={l === lang} onClick={() => void updateProfile({ activeLang: l })}>
              {getLanguage(l).nameTr}
            </button>
          ))}
        </div>
        <p className="tiny muted">Seçili dil Bugün ve Keşfet'te kullanılır. Her dilin kayıtları ayrı tutulur.</p>
      </section>

      <section className="card">
        <h2>{name} ilerlemen</h2>
        {data ? (
          <>
            <p>
              {data.p.core.introduced} kelimeyle tanıştın. Son 7 günde {data.p.reviews7d} tekrar yaptın
              {data.p.accuracy7d !== null ? `; hatırlama oranın %${Math.round(data.p.accuracy7d * 100)}` : ''}.
            </p>
            <a className="small" href="#/profile/progress">Ayrıntılı ilerleme</a>
          </>
        ) : (
          <p className="muted">Yükleniyor…</p>
        )}
      </section>

      <section className="card">
        <h2>Hedefin</h2>
        {profile.career && data?.career ? (
          <>
            <p>{profile.career.title}</p>
            <Progress value={data.career.overall} label="Hedef ilerlemesi" />
            <p className="small muted">
              %{Math.round(data.career.overall * 100)} tamam
              {data.career.projectedDate ? `. Bu hızla tahmini bitiş: ${data.career.projectedDate}` : ''}.
            </p>
            <a className="small" href="#/profile/goal">Yol haritasını gör</a>
          </>
        ) : (
          <>
            <p className="small muted">Bir hedef koyarsan uygulama sana adım adım bir yol haritası çıkarır.</p>
            <a className="btn btn-soft" href="#/profile/goal">Hedef belirle</a>
          </>
        )}
      </section>

      <nav className="rows" aria-label="Ayarlar">
        <LinkRow href="#/profile/learning" title="Öğrenme tercihleri" detail={`Günde ${profile.dailyMinutes} dk, ${profile.newPerDay} yeni kelime; diller ve hedefler`} />
        <LinkRow href="#/profile/appearance" title="Görünüm ve erişilebilirlik" detail="Tema, metin boyutu, hareket" />
        <LinkRow href="#/profile/backup" title="Yedekleme ve geri yükleme" detail="Verilerini dosyaya al, başka cihaza aktar" />
        <LinkRow href="#/profile/help" title="Yardım" detail="Ses testi, Demo Modu, içerik bildirimlerin" />
        <LinkRow href="#/profile/sources" title="Kaynaklar ve lisanslar" />
      </nav>
    </div>
  )
}

/** Ses testi ve Demo Modu */
function OtherCard() {
  const { startDemo } = useApp()
  const [demoOpen, setDemoOpen] = useState(false)
  return (
    <Card title="Araçlar">
      <div className="list">
        <a className="list-item" href="#/sound-test?from=help" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="grow">
            <b>Ses testi</b>
            <div className="tiny muted">Telefonunda hangi dillerde ses çalıştığını kontrol et, raporu kopyala.</div>
          </span>
          <Icon.play />
        </a>
        <button className="list-item" onClick={() => setDemoOpen(true)}>
          <span className="grow">
            <b>Demo Modu</b>
            <div className="tiny muted">Telefonu bir arkadaşına verirken</div>
          </span>
          <Icon.users />
        </button>
      </div>
      <Dialog open={demoOpen} onClose={() => setDemoOpen(false)} title="Demo Modu">
        <p>
          Misafir istediği dili seçip sıfırdan kısa bir deneme yapar. Senin kelimelerin, tekrarların, hataların ve istatistiklerin değişmez; kişisel
          metinlerin görünmez. Çıkınca kaldığın yere dönersin.
        </p>
        <button className="btn btn-primary" onClick={() => void startDemo()}>
          Demo Modu'nu başlat
        </button>
      </Dialog>
    </Card>
  )
}

const SRC_LABEL: Record<string, string> = {
  'vikisozluk-tr': 'Türkçe Vikisözlük',
  'vikisozluk-en': 'İng. Vikisözlük çevirisi',
  'pivot-en': 'İngilizce üzerinden',
  mt: 'makine çevirisi',
  curated: 'elle düzeltildi',
  yok: 'Türkçesi yok',
}

function SourcesCard() {
  const { profile } = useApp()
  const [lang, setLang] = useState(profile.activeLang)
  const idx = content.indexes.get(lang)
  const pct = (v?: number) => `%${Math.round((v ?? 0) * 100)}`
  return (
    <Card title="Kaynaklar ve lisanslar" action={<LangSwitcher value={lang} options={profile.targetLanguages} onChange={setLang} />}>
      {idx ? (
        <div className="stack small">
          <p>
            <b>{idx.count}</b> sık kelime ({idx.built} tarihinde işlendi).
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>İnsan sesi kaydı: {pct(idx.stats.audio)}</li>
            <li>Örnek cümle: {pct(idx.stats.example)} (Türkçe insan çevirisiyle: {pct(idx.stats.example_tr_human)})</li>
            <li>
              Türkçe anlam kaynağı:{' '}
              {Object.entries(SRC_LABEL)
                .filter(([k]) => idx.stats[k])
                .map(([k, l]) => `${l} ${pct(idx.stats[k])}`)
                .join(', ')}
            </li>
            <li>Emoji görseli: {pct(idx.stats.emoji)}</li>
          </ul>
        </div>
      ) : (
        <p className="small muted">Bu dilin kelime paketi henüz yüklenmedi (dili seçip Bugün'ü açınca yüklenir).</p>
      )}
      <ul className="tiny muted" style={{ margin: 0, paddingLeft: 18 }}>
        <li>Kelime sıklığı: wordfreq (R. Speer ve ark.) — CC BY-SA 4.0</li>
        <li>Anlamlar, çekimler, IPA, ses adresleri: Vikisözlük (Wiktextract / kaikki.org) — CC BY-SA</li>
        <li>Örnek cümleler: Tatoeba — CC BY 2.0 FR</li>
        <li>Ses kayıtları: Wikimedia Commons (çoğu Lingua Libre) — lisans dosya sayfasında</li>
        <li>Makine çevirisi: Argos Translate modeli (bilgisayarda, ücretsiz)</li>
        <li>Emoji adları: emojibase (MIT, Unicode CLDR)</li>
      </ul>
      <p className="tiny muted">Bu içerikten türetilen kelime paketleri CC BY-SA 4.0 lisanslıdır. Uzman doğrulaması yoktur.</p>
    </Card>
  )
}

function ProgressCard() {
  const { repo, profile, dataVersion } = useApp()
  const [lang, setLang] = useState(profile.activeLang)
  const { data: p } = useAsync(async () => {
    await content.ensureLanguage(lang).catch(() => undefined)
    return computeProgress(repo, lang)
  }, [lang, dataVersion])
  const skills: Skill[] = ['recognizeText', 'recognizeAudio', 'write', 'produce']
  return (
    <Card title="İlerleme" icon={<Icon.flame />} action={<LangSwitcher value={lang} options={profile.targetLanguages} onChange={setLang} />}>
      {p ? (
        <>
          <div className="stack" style={{ gap: 6 }}>
            <div className="spread">
              <span>Genel ({getLanguage(lang).nameTr} örnek içeriği)</span>
              <span className="pill">{p.core.introduced}/{p.core.total} anlam</span>
            </div>
            <Progress value={p.core.total ? p.core.introduced / p.core.total : 0} label="Genel ilerleme" />
          </div>
          <table className="skill-table">
            <thead>
              <tr>
                <th>Beceri</th>
                <th>Öğreniliyor</th>
                <th>Tekrarda</th>
                <th>Güçlü</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((k) => (
                <tr key={k}>
                  <td>{SKILL_LABEL[k]}</td>
                  <td>{p.core.bySkill[k].learning}</td>
                  <td>{p.core.bySkill[k].review}</td>
                  <td>{p.core.bySkill[k].strong}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny muted">"Kendiliğinden üretme" şu an izlenmiyor (cümle değerlendirme bağlı değil). "Güçlü" = tahmini hafıza kararlılığı 21 günün üstünde; bir sertifika veya resmî seviye değildir.</p>
          <h3>Sektörler (genel ilerlemeden ayrı)</h3>
          {p.industries.filter((i) => i.total > 0).map((i) => (
            <div key={i.industryId} className="stack" style={{ gap: 6 }}>
              <div className="spread">
                <span>{getIndustry(i.industryId).nameTr}</span>
                <span className="pill">{i.introduced}/{i.total} terim</span>
              </div>
              <Progress value={i.introduced / i.total} label={`${getIndustry(i.industryId).nameTr} ilerlemesi`} />
            </div>
          ))}
          {p.industries.every((i) => i.total === 0) ? <p className="small muted">Bu dilde sektör içeriği henüz yok.</p> : null}
          <p className="small muted">
            Son 7 gün: {p.reviews7d} tekrar
            {p.accuracy7d !== null ? ` · hatırlama oranı %${Math.round(p.accuracy7d * 100)}` : ''} · kişisel koleksiyon: {p.personal / 2} ifade
          </p>
        </>
      ) : (
        <p className="muted">Yükleniyor…</p>
      )}
    </Card>
  )
}

function ProfileCard({ profile, update }: { profile: Profile; update: (p: Partial<Profile>) => Promise<void> }) {
  const known = profile.knownLanguages
  const setKnown = (lang: string, level: Cefr | 'native' | '') => {
    const rest = known.filter((k) => k.lang !== lang)
    void update({ knownLanguages: level ? [...rest, { lang, level }] : rest })
  }
  return (
    <Card title="Diller ve hedefler">
      <div className="field">
        <span className="label">Öğrendiğin diller (her biri ayrı izlenir)</span>
        <Chips
          label="Hedef diller"
          values={profile.targetLanguages}
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.nameTr }))}
          onToggle={(v) => {
            const next = toggle(profile.targetLanguages, v)
            if (next.length === 0) return
            void update({ targetLanguages: next, activeLang: next.includes(profile.activeLang) ? profile.activeLang : next[0] })
          }}
        />
      </div>
      <div className="field">
        <span className="label">Arayüz dili</span>
        <Seg label="Arayüz dili" value={profile.interfaceLang} onChange={() => undefined} options={[{ value: 'tr', label: 'Türkçe' }]} />
        <p className="tiny muted">Diğer arayüz dilleri henüz yok.</p>
      </div>
      <div className="field">
        <span className="label">Açıklama dili (kelime anlamları)</span>
        <Seg label="Açıklama dili" value={profile.explanationLang} onChange={(v) => update({ explanationLang: v })} options={[{ value: 'tr', label: 'Türkçe' }, { value: 'en', label: 'English' }]} />
        <p className="tiny muted">Şimdilik yalnızca kısa anlamlar İngilizce gösterilebilir; uzun açıklamalar Türkçe kalır.</p>
      </div>
      <div className="field">
        <span className="label">Bildiğin diller ve tahmini seviyen</span>
        <p className="tiny muted">Kendi tahminindir; resmî bir seviye belgesi yerine geçmez.</p>
        {LANGUAGES.map((l) => (
          <div className="spread" key={l.code}>
            <span>{l.nameTr}</span>
            <select className="input" style={{ width: 'auto', minHeight: 40 }} value={known.find((k) => k.lang === l.code)?.level ?? ''} onChange={(e) => setKnown(l.code, e.target.value as Cefr | 'native' | '')} aria-label={`${l.nameTr} seviyen`}>
              <option value="">—</option>
              {LEVELS.map((x) => <option key={x} value={x}>{LEVEL_LABEL(x)}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="field">
        <span className="label">Yaş grubu</span>
        <Seg label="Yaş grubu" value={profile.ageGroup} onChange={(v) => update({ ageGroup: v, theme: v === 'child' && profile.theme !== 'oyun' ? 'oyun' : profile.theme })} options={[{ value: 'child', label: 'Çocuk' }, { value: 'teen', label: 'Genç' }, { value: 'adult', label: 'Yetişkin' }]} />
        <p className="tiny muted">Yaş yalnızca örneklerin ve görünümün uyarlanması için kullanılır; öğrenme hızı yaşa göre değil, gösterdiğin performansa göre ayarlanır.</p>
      </div>
      {profile.ageGroup === 'child' ? (
        <label className="row">
          <input type="checkbox" checked={profile.readingSupport} onChange={(e) => update({ readingSupport: e.target.checked })} /> Okuma desteği (daha az metin, daha çok ses)
        </label>
      ) : null}
      <div className="field">
        <span className="label">Hedefler</span>
        <Chips label="Hedefler" values={profile.goals} options={GOALS} onToggle={(v) => update({ goals: toggle(profile.goals, v) })} />
      </div>
      <div className="field">
        <span className="label">İlgi alanları</span>
        <Chips label="İlgi alanları" values={profile.interests} options={INTERESTS} onToggle={(v) => update({ interests: toggle(profile.interests, v) })} />
      </div>
    </Card>
  )
}

function StudyCard({ profile, update }: { profile: Profile; update: (p: Partial<Profile>) => Promise<void> }) {
  return (
    <Card title="Günlük çalışma">
      <div className="field">
        <label htmlFor="mins">Günlük süre: {profile.dailyMinutes} dk</label>
        <input id="mins" className="range" type="range" min={5} max={60} step={5} value={profile.dailyMinutes} onChange={(e) => update({ dailyMinutes: Number(e.target.value) })} />
      </div>
      <div className="field">
        <label htmlFor="newper">Günlük yeni kelime: {profile.newPerDay}</label>
        <input id="newper" className="range" type="range" min={1} max={20} step={1} value={profile.newPerDay} onChange={(e) => update({ newPerDay: Number(e.target.value) })} />
        <p className="tiny muted">Bugün ilk kez tanıştığın kelimeler sayılır; aynı kelime iki kez sayılmaz. Tekrar yükü artınca uygulama bu sayıyı geçici olarak düşürür. Hedef dolunca Bugün ekranında "Biraz daha çalış" ile devam edebilirsin. Varsayılanlar (15 dk, 5 kelime) tasarım tercihidir, bilimsel bir kural değildir.</p>
      </div>
      <details className="details">
        <summary>Gelişmiş: tekrar planlayıcı</summary>
      <div className="field details-body">
        <span className="label">Hedef hatırlama oranı</span>
        <Seg label="Hedef hatırlama oranı" value={String(profile.desiredRetention)} onChange={(v) => update({ desiredRetention: Number(v) })} options={[{ value: '0.85', label: '%85' }, { value: '0.9', label: '%90' }, { value: '0.95', label: '%95' }]} />
        <p className="tiny muted">Tekrar planlayıcı (FSRS) bu orana göre aralık seçer. Yükseltirsen daha sık tekrar yaparsın. Planlayıcının varsayılanları genel kullanıcı verisinden gelir. Emin değilsen %90'da bırak.</p>
      </div>
      </details>
      {['ru', 'hu'].filter((l) => profile.targetLanguages.includes(l)).map((l) => (
        <div className="field" key={l}>
          <span className="label">{getLanguage(l).nameTr} telaffuz yardımı</span>
          <Seg label={`${getLanguage(l).nameTr} telaffuz yardımı`} value={profile.pronunciationAid[l] ?? 'full'} onChange={(v) => update({ pronunciationAid: { ...profile.pronunciationAid, [l]: v } })} options={[{ value: 'full', label: 'Tam' }, { value: 'stress', label: l === 'ru' ? 'Yalnız vurgu' : 'Az' }, { value: 'none', label: 'Kapalı' }]} />
        </div>
      ))}
    </Card>
  )
}

function AppearanceCard({ profile, update }: { profile: Profile; update: (p: Partial<Profile>) => Promise<void> }) {
  return (
    <Card>
      <div className="field">
        <span className="label">Tema</span>
        <Seg label="Tema" value={profile.theme} onChange={(v) => update({ theme: v })} options={[{ value: 'civit', label: 'Çivit' }, { value: 'kum', label: 'Kum' }, { value: 'adacayi', label: 'Adaçayı' }, { value: 'sis', label: 'Sis' }, { value: 'oyun', label: 'Oyun' }]} />
        <p className="tiny muted">Çivit yeni varsayılan temadır. "Oyun" çocuklar için daha canlı ve yuvarlak bir görünümdür.</p>
      </div>
      <div className="field">
        <span className="label">Açık / koyu</span>
        <Seg label="Görünüm" value={profile.appearance} onChange={(v) => update({ appearance: v })} options={[{ value: 'system', label: 'Sistem' }, { value: 'light', label: 'Açık' }, { value: 'dark', label: 'Koyu' }]} />
      </div>
      <div className="field">
        <label htmlFor="scale">Metin boyutu: %{Math.round(profile.textScale * 100)}</label>
        <input id="scale" className="range" type="range" min={0.9} max={1.5} step={0.05} value={profile.textScale} onChange={(e) => update({ textScale: Number(e.target.value) })} />
        <p className="tiny muted">iPhone/iPad'in sistem metin boyutu da (Dinamik Yazı) dikkate alınır.</p>
      </div>
      <div className="field">
        <span className="label">Hareketi azalt</span>
        <Seg label="Hareketi azalt" value={profile.reduceMotion} onChange={(v) => update({ reduceMotion: v })} options={[{ value: 'system', label: 'Sistem' }, { value: 'on', label: 'Açık' }, { value: 'off', label: 'Kapalı' }]} />
      </div>
    </Card>
  )
}

function EvaluationCard() {
  const { repo, profile, dataVersion } = useApp()
  const state = evaluatorState(profile.evaluationEndpoint, navigator.onLine)
  const { data } = useAsync(async () => {
    const all = await repo.db.attempts.toArray()
    const sentences = all.filter((a) => a.exerciseType === 'free-sentence' || a.exerciseType === 'task')
    return { saved: sentences.length, pending: sentences.filter((a) => a.evalStatus === 'pending').length }
  }, [dataVersion])
  return (
    <Card title="Cümle değerlendirme">
      {state === 'unconfigured' ? (
        <>
          <p><span className="pill">Bağlı değil</span></p>
          <p className="small">
            Şu an cümleleri değerlendiren bir hizmet yok. Yazdığın cümleler pratik olarak kaydedilir; cihaz yalnızca hedef kelimenin geçip
            geçmediğine bakar. Dilbilgisi ve doğallık kontrol edilmez.
          </p>
        </>
      ) : state === 'offline' ? (
        <>
          <p><span className="pill warn">Ayarlı, şu an çevrimdışı</span></p>
          <p className="small">Cümlelerin kaydedilir ve bağlantı gelince değerlendirilir.</p>
        </>
      ) : (
        <p><span className="pill good">Ayarlı ve çevrimiçi</span></p>
      )}
      {data ? (
        <p className="small muted">
          Kayıtlı pratik cümlesi: {data.saved}.
          {data.pending ? ` Bunlardan ${data.pending} tanesi "bekliyor" olarak işaretli; bir değerlendirici bağlanırsa değerlendirilebilir.` : ''}
        </p>
      ) : null}
    </Card>
  )
}

const ISSUE_LABEL = { meaning: 'Anlam yanlış', translation: 'Çeviri yanlış', example: 'Örnek uygun değil', audio: 'Ses yanlış', other: 'Başka' } as const

/** İçerik bildirimleri: yalnızca bu cihazda; kopyalanıp geliştiriciye iletilebilir */
function ReportsCard() {
  const { repo, dataVersion, bump } = useApp()
  const { data: reports } = useAsync(() => repo.reports(), [dataVersion])
  const [copied, setCopied] = useState(false)
  const text = (reports ?? [])
    .map((r) => `${new Date(r.createdAt).toISOString().slice(0, 10)} | ${r.lang} | ${r.word} | ${ISSUE_LABEL[r.issue]} | ${r.context}${r.senseId ? ` | ${r.senseId}` : ''}${r.note ? ` | ${r.note}` : ''}`)
    .join('\n')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Card title="İçerik bildirimlerim">
      <p className="small muted">
        Kelime kartlarındaki "Bu içerikte sorun var" ile yaptığın bildirimler. Yalnızca bu cihazda saklanır, hiçbir yere gönderilmez; yedeğe
        dahildir.
      </p>
      {reports?.length ? (
        <>
          <div className="list small">
            {reports.map((r) => (
              <div className="list-item" key={r.id}>
                <span className="grow">
                  <b lang={r.lang}>{r.word}</b> <span className="muted">{ISSUE_LABEL[r.issue]}, {r.context}</span>
                  {r.note ? <div className="muted">{r.note}</div> : null}
                </span>
                <button className="btn btn-ghost btn-icon" aria-label={`${r.word} bildirimini sil`} onClick={() => void repo.deleteReport(r.id).then(bump)}>
                  <Icon.trash />
                </button>
              </div>
            ))}
          </div>
          <button className="btn" onClick={() => void copy()}>{copied ? 'Kopyalandı' : 'Listeyi kopyala'}</button>
          {!copied ? null : <p className="tiny muted">Kopyaladığın listeyi bir mesaja yapıştırıp iletebilirsin.</p>}
        </>
      ) : (
        <p className="small">Henüz bildirim yok.</p>
      )}
    </Card>
  )
}

function DataCard() {
  const { repo, reloadProfile } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const exportData = async () => {
    const data = await repo.exportAll()
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `filiz-yedek-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    setMsg('Yedek dosyası hazırlandı. Dosyalar uygulamasına veya iCloud Drive\'a kaydedebilirsin.')
  }
  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as BackupFile
      const r = await repo.importAll(parsed)
      await reloadProfile()
      setMsg(`İçe aktarıldı: ${r.added} yeni, ${r.updated} güncellenen, ${r.skipped} zaten güncel kayıt. Hiçbir kayıt çoğaltılmadı. Profilin ve ekranlar yenilendi.`)
    } catch (e) {
      setMsg(`İçe aktarılamadı: ${(e as Error).message}`)
    }
  }
  return (
    <Card>
      <p className="small">
        İlerlemen bu cihazda saklanır ve internetsiz çalışır. iOS nadiren web uygulaması verisini silebilir; düzenli yedek almanı öneririm. iPhone–iPad
        otomatik senkronu yok; yedeği bir cihazdan alıp diğerine aktarabilirsin (kayıtlar birleştirilir, çoğalmaz).
      </p>
      <div className="row">
        <button className="btn" onClick={exportData}><Icon.download /> Yedek al</button>
        <button className="btn" onClick={() => fileRef.current?.click()}><Icon.upload /> Yedekten yükle</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
      </div>
      {msg ? <div className="notice">{msg}</div> : null}
    </Card>
  )
}

const STATUS: { label: string; state: 'Çalışıyor' | 'Örnek içerik' | 'Entegrasyon bekliyor' | 'Test edilmedi' | 'Sonraki aşama' }[] = [
  { label: 'Dersler, tekrar planlayıcı, Günün Kelimesi', state: 'Çalışıyor' },
  { label: 'Her dilde en sık ~3200 kelime (açık veriden, otomatik)', state: 'Çalışıyor' },
  { label: 'Sesler ve Harfler (6 dil)', state: 'Çalışıyor' },
  { label: 'Kariyer hedefi ve yol haritası', state: 'Çalışıyor' },
  { label: 'Tekstil terimleri (İngilizce, Rusça)', state: 'Örnek içerik' },
  { label: 'Finans, BT, Mühendislik, Mimarlık terimleri', state: 'Sonraki aşama' },
  { label: 'Cümle değerlendirme (dilbilgisi, anlam, doğallık)', state: 'Sonraki aşama' },
  { label: 'Demo Modu (veri izolasyonu)', state: 'Çalışıyor' },
  { label: 'İnsan sesi kayıtları ve cihaz sesi (iPhone)', state: 'Test edilmedi' },
  { label: 'El yazısı (Scribble) ve Pencil ile harf yazma (iPad)', state: 'Test edilmedi' },
  { label: 'Ana ekrana kurulum ve çevrimdışı çalışma', state: 'Test edilmedi' },
  { label: 'iPhone–iPad senkronu', state: 'Sonraki aşama' },
  { label: 'Konuşma kaydı, dinleme metinleri, haftalık kalıcılık kontrolü', state: 'Sonraki aşama' },
]

function StatusCard() {
  return (
    <details className="details card">
      <summary>Özellik durumu (geliştirme notları)</summary>
      <div className="list small">
        {STATUS.map((s) => (
          <div className="list-item" key={s.label}>
            <span className="grow">{s.label}</span>
            <span className={`pill ${s.state === 'Çalışıyor' ? 'good' : s.state === 'Örnek içerik' ? 'accent' : s.state === 'Test edilmedi' ? 'warn' : 'info'}`}>{s.state}</span>
          </div>
        ))}
      </div>
      <p className="tiny muted">İçerikler yapay zekâ taslağı veya açık veriden otomatik işlenmiştir ve uzman doğrulamasından geçmemiştir. Görseller bu proje için çizilmiş basit özgün illüstrasyonlardır.</p>
    </details>
  )
}
