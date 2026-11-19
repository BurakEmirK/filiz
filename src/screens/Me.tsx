import { useRef, useState } from 'react'
import { useApp, useAsync } from '../app/context'
import { LANGUAGES, getLanguage } from '../content/languages'
import { getIndustry } from '../content/industries'
import { content } from '../content/registry'
import type { Cefr } from '../content/types'
import type { BackupFile } from '../data/repo'
import { computeProgress } from '../domain/services'
import { SKILL_LABEL, type Profile, type Skill } from '../domain/types'
import { Card, Chips, Dialog, LangSwitcher, Progress, Seg } from '../ui/components'
import { Icon } from '../ui/icons'

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

export function MeScreen() {
  const { profile, updateProfile } = useApp()
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Ben</h1>
          <p>İlerleme, profil ve ayarlar.</p>
        </div>
      </div>
      <ProgressCard />
      <div className="grid-2">
        <ProfileCard profile={profile} update={updateProfile} />
        <StudyCard profile={profile} update={updateProfile} />
        <AppearanceCard profile={profile} update={updateProfile} />
        <EvaluationCard />
        <DataCard />
        <SourcesCard />
        <StatusCard />
      </div>
      <OtherCard />
    </div>
  )
}

/** Ses testi ve Demo Modu: sık kullanılmayan araçlar en altta tek satır */
function OtherCard() {
  const { startDemo } = useApp()
  const [demoOpen, setDemoOpen] = useState(false)
  return (
    <Card title="Araçlar">
      <div className="list">
        <a className="list-item" href="#/sound-test" style={{ textDecoration: 'none', color: 'inherit' }}>
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
        <p className="small muted">Bu dilin kelime paketi henüz yüklenmedi (dili seçip Öğren'i açınca yüklenir).</p>
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
          <p className="tiny muted">"Kendiliğinden üretme" çevrimiçi değerlendirme bağlanınca (sonraki aşama) izlenmeye başlayacak. "Güçlü" = tahmini hafıza kararlılığı 21 günün üstünde; bir sertifika veya resmî seviye değildir.</p>
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
    <Card title="Profil">
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
    <Card title="Çalışma ayarları">
      <div className="field">
        <label htmlFor="mins">Günlük süre: {profile.dailyMinutes} dk</label>
        <input id="mins" className="range" type="range" min={5} max={60} step={5} value={profile.dailyMinutes} onChange={(e) => update({ dailyMinutes: Number(e.target.value) })} />
      </div>
      <div className="field">
        <label htmlFor="newper">Günlük yeni öğe: {profile.newPerDay}</label>
        <input id="newper" className="range" type="range" min={1} max={20} step={1} value={profile.newPerDay} onChange={(e) => update({ newPerDay: Number(e.target.value) })} />
        <p className="tiny muted">1 = yalnızca Günün Kelimesi. Tekrar yükü artınca uygulama bu sayıyı geçici olarak düşürür. Varsayılanlar (15 dk, 5 öğe) tasarım tercihidir, bilimsel bir kural değildir.</p>
      </div>
      <div className="field">
        <span className="label">Hedef hatırlama oranı</span>
        <Seg label="Hedef hatırlama oranı" value={String(profile.desiredRetention)} onChange={(v) => update({ desiredRetention: Number(v) })} options={[{ value: '0.85', label: '%85' }, { value: '0.9', label: '%90' }, { value: '0.95', label: '%95' }]} />
        <p className="tiny muted">Tekrar planlayıcı (FSRS) bu orana göre aralık seçer. Yükseltirsen daha sık tekrar yaparsın. Planlayıcının varsayılanları genel kullanıcı verisinden gelir; senin için kişiselleştirme ilerideki bir aşamadır.</p>
      </div>
      {['ru', 'hu'].filter((l) => profile.targetLanguages.includes(l)).map((l) => (
        <div className="field" key={l}>
          <span className="label">{getLanguage(l).nameTr} telaffuz yardımı</span>
          <Seg label={`${getLanguage(l).nameTr} telaffuz yardımı`} value={profile.pronunciationAid[l] ?? 'full'} onChange={(v) => update({ pronunciationAid: { ...profile.pronunciationAid, [l]: v } })} options={[{ value: 'full', label: 'Tam' }, { value: 'stress', label: l === 'ru' ? 'Yalnız vurgu' : 'Az' }, { value: 'none', label: 'Kapalı' }]} />
        </div>
      ))}
      {profile.targetLanguages.includes('hu') ? <HungarianLetters /> : null}
    </Card>
  )
}

function HungarianLetters() {
  const [open, setOpen] = useState(false)
  const notes = getLanguage('hu').letterNotes ?? []
  return (
    <div>
      <button className="btn btn-ghost" onClick={() => setOpen(!open)}>{open ? 'Macarca harf notlarını gizle' : 'Macarca harf notları (Türkçe konuşanlar için)'}</button>
      {open ? (
        <div className="list small">
          {notes.map((n) => (
            <div className="list-item" key={n.letters}>
              <b style={{ minWidth: 90 }} lang="hu">{n.letters}</b>
              <span>{n.note}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AppearanceCard({ profile, update }: { profile: Profile; update: (p: Partial<Profile>) => Promise<void> }) {
  return (
    <Card title="Görünüm ve erişilebilirlik">
      <div className="field">
        <span className="label">Tema</span>
        <Seg label="Tema" value={profile.theme} onChange={(v) => update({ theme: v })} options={[{ value: 'kum', label: 'Kum' }, { value: 'adacayi', label: 'Adaçayı' }, { value: 'sis', label: 'Sis' }, { value: 'oyun', label: 'Oyun' }]} />
        <p className="tiny muted">"Oyun" teması çocuklar için daha canlı ve yuvarlak bir görünümdür.</p>
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
  const { repo, dataVersion } = useApp()
  const { data: pending } = useAsync(() => repo.pendingAttempts(), [dataVersion])
  return (
    <Card title="Cümle değerlendirme">
      <p><span className="pill info">Entegrasyon bekliyor</span></p>
      <p className="small">
        Şu an cihaz yalnızca basit kontrolleri yapar (hedef kelime geçiyor mu, kapalı cevaplar). Dilbilgisi, görev anlamı ve doğallık kontrolü için
        çevrimiçi değerlendirme sonraki aşamada bağlanacak. O zamana kadar cümlelerin "bekliyor" olarak saklanır.
      </p>
      <p className="small">Bekleyen cümle: <b>{pending?.length ?? 0}</b></p>
      <p className="tiny muted">Çevrimiçi değerlendirme açıldığında, yalnızca değerlendirilecek cümle ve görev bilgisi sunucuna gönderilecek; bu her seferinde açıkça belirtilecek.</p>
    </Card>
  )
}

function DataCard() {
  const { repo, bump } = useApp()
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
      setMsg(`İçe aktarıldı: ${r.added} yeni, ${r.updated} güncellenen, ${r.skipped} zaten güncel kayıt. Hiçbir kayıt çoğaltılmadı.`)
      bump()
    } catch (e) {
      setMsg(`İçe aktarılamadı: ${(e as Error).message}`)
    }
  }
  return (
    <Card title="Verilerin">
      <p className="small">
        İlerlemen bu cihazda saklanır ve internetsiz çalışır. iOS nadiren web uygulaması verisini silebilir; düzenli yedek almanı öneririm. iPhone–iPad
        otomatik senkronu sonraki aşamada gelecek; şimdilik yedeği bir cihazdan alıp diğerine aktarabilirsin (kayıtlar birleştirilir, çoğalmaz).
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
  { label: 'Cümle değerlendirme (dilbilgisi, anlam, doğallık)', state: 'Entegrasyon bekliyor' },
  { label: 'Demo Modu (veri izolasyonu)', state: 'Çalışıyor' },
  { label: 'İnsan sesi kayıtları ve cihaz sesi (iPhone)', state: 'Test edilmedi' },
  { label: 'El yazısı (Scribble) ve Pencil ile harf yazma (iPad)', state: 'Test edilmedi' },
  { label: 'Ana ekrana kurulum ve çevrimdışı çalışma', state: 'Test edilmedi' },
  { label: 'iPhone–iPad senkronu', state: 'Sonraki aşama' },
  { label: 'Konuşma kaydı, dinleme metinleri, haftalık kalıcılık kontrolü', state: 'Sonraki aşama' },
]

function StatusCard() {
  return (
    <Card title="Özellik durumu">
      <div className="list small">
        {STATUS.map((s) => (
          <div className="list-item" key={s.label}>
            <span className="grow">{s.label}</span>
            <span className={`pill ${s.state === 'Çalışıyor' ? 'good' : s.state === 'Örnek içerik' ? 'accent' : s.state === 'Test edilmedi' ? 'warn' : 'info'}`}>{s.state}</span>
          </div>
        ))}
      </div>
      <p className="tiny muted">İçeriklerin tamamı yapay zekâ taslağıdır ve uzman doğrulamasından geçmemiştir. Görseller bu proje için çizilmiş basit özgün illüstrasyonlardır.</p>
    </Card>
  )
}
