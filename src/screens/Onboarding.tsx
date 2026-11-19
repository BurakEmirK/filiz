import { useMemo, useState } from 'react'
import { useApp } from '../app/context'
import { LANGUAGES, getLanguage } from '../content/languages'
import { content } from '../content/registry'
import type { Cefr } from '../content/types'
import type { Profile } from '../domain/types'
import { BrandMark } from '../ui/icons'
import { Chips, Seg } from '../ui/components'
import { GOALS, INTERESTS } from './Me'
import { Player } from './Player'
import { seeded, type Step } from './steps'
import { shuffle } from '../content/registry'

// İlk kurulum: hedef dil(ler), bildiğin diller, yaş grubu, hedefler, süre. Sonunda isteğe bağlı kısa seviye kontrolü.

export function Onboarding() {
  const { profile, updateProfile, repo, bump } = useApp()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Profile>(profile)
  const [checking, setChecking] = useState(false)
  const [placement, setPlacement] = useState<{ checked: number; recognized: number }>()
  const set = (p: Partial<Profile>) => setDraft((d) => ({ ...d, ...p }))
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const checkSteps: Step[] = useMemo(() => {
    const rnd = seeded(`placement-${draft.activeLang}`)
    const senses = content
      .coreSenseOrder(draft.activeLang)
      .map((id) => content.sense(id))
      .filter((s) => content.imageFor(s) && (s.level === 'A1' || s.level === 'A2'))
    return shuffle(senses, rnd)
      .slice(0, 6)
      .map((s) => ({ kind: 'choose', sense: s, options: shuffle([s, ...content.distractors(s, 3, rnd)], rnd), mode: 'text', skill: 'recognizeText' }) as Step)
  }, [draft.activeLang])

  const finish = async (placement?: { checked: number; recognized: number }) => {
    await updateProfile({ ...draft, onboarded: true })
    const track = await repo.ensureTrack(draft.activeLang)
    const own = draft.knownLanguages.find((k) => k.lang === draft.activeLang)
    await repo.saveTrack({ ...track, selfEstimate: own && own.level !== 'native' ? own.level : undefined, placement: placement ? { ...placement, at: Date.now() } : undefined })
    bump()
  }

  if (checking) {
    return (
      <Player
        title="Kısa seviye kontrolü"
        steps={checkSteps}
        ctx={{ repo, profile: draft, lang: draft.activeLang, context: 'core', source: 'lesson', recordOnlyCorrect: true }}
        showNextDue={false}
        finishLabel="Başla"
        finishExtra={(results) => (
          <div className="notice">
            {results.filter((r) => r.correct).length}/{results.length} kelimeyi tanıdın. Tanıdığın kelimeler doğrudan tekrar planına alındı; bu bir resmî seviye
            belirlemesi değildir. Uygulama hızını senin performansına göre ayarlayacak.
          </div>
        )}
        onFinish={(results) => setPlacement({ checked: results.length, recognized: results.filter((r) => r.correct).length })}
        onClose={() => void finish(placement)}
      />
    )
  }

  const screens = [
    <>
      <div className="row"><BrandMark size={48} /><h1>Filiz'e hoş geldin</h1></div>
      <p>Kısa dersler, aralıklı tekrar ve kendi cümlelerini kurma. Birkaç soruyla başlayalım; hepsi sonradan değiştirilebilir.</p>
      <div className="notice">
        Her dilde en sık kullanılan ~3200 kelime, sesler ve harfler bölümü ve resimli başlangıç dersleri var. Kelimeler açık kaynaklardan otomatik
        hazırlandı; uzman doğrulaması yok.
      </div>
    </>,
    <>
      <h1>Hangi dilleri öğrenmek istiyorsun?</h1>
      <p className="muted">Birden fazla seçebilirsin. Her dilin ilerlemesi ayrı tutulur.</p>
      <div className="lang-grid">
        {LANGUAGES.map((l) => (
          <button key={l.code} className="lang-btn" aria-pressed={draft.targetLanguages.includes(l.code)} onClick={() => {
            const next = toggle(draft.targetLanguages, l.code)
            set({ targetLanguages: next, activeLang: next.includes(draft.activeLang) ? draft.activeLang : next[0] ?? 'ru' })
          }}>
            <span className="native">{l.nativeName}</span>
            <span className="small muted">{l.nameTr}</span>
          </button>
        ))}
      </div>
      {draft.targetLanguages.length > 1 ? (
        <div className="field">
          <span className="label">İlk hangisiyle başlayalım?</span>
          <Seg label="Etkin dil" value={draft.activeLang} onChange={(v) => set({ activeLang: v })} options={draft.targetLanguages.map((c) => ({ value: c, label: getLanguage(c).nameTr }))} />
        </div>
      ) : null}
    </>,
    <>
      <h1>Hangi dilleri biliyorsun?</h1>
      <p className="muted">Kendi tahminin yeterli; resmî bir seviye istenmiyor.</p>
      {LANGUAGES.map((l) => {
        const k = draft.knownLanguages.find((x) => x.lang === l.code)
        return (
          <div className="spread" key={l.code}>
            <span>{l.nameTr}</span>
            <select className="input" style={{ width: 'auto', minHeight: 40 }} aria-label={`${l.nameTr} seviyen`} value={k?.level ?? ''} onChange={(e) => {
              const rest = draft.knownLanguages.filter((x) => x.lang !== l.code)
              set({ knownLanguages: e.target.value ? [...rest, { lang: l.code, level: e.target.value as Cefr | 'native' }] : rest })
            }}>
              <option value="">Bilmiyorum</option>
              {(['native', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((x) => <option key={x} value={x}>{x === 'native' ? 'Ana dil' : x}</option>)}
            </select>
          </div>
        )
      })}
    </>,
    <>
      <h1>Seni biraz tanıyalım</h1>
      <div className="field">
        <span className="label">Yaş grubu</span>
        <Seg label="Yaş grubu" value={draft.ageGroup} onChange={(v) => set({ ageGroup: v, theme: v === 'child' ? 'oyun' : draft.theme })} options={[{ value: 'child', label: 'Çocuk' }, { value: 'teen', label: 'Genç' }, { value: 'adult', label: 'Yetişkin' }]} />
        <p className="tiny muted">Yalnızca örnekleri ve görünümü uyarlamak için; öğrenme hızın performansına göre ayarlanır.</p>
      </div>
      <div className="field">
        <span className="label">Hedeflerin</span>
        <Chips label="Hedefler" values={draft.goals} options={GOALS} onToggle={(v) => set({ goals: toggle(draft.goals, v) })} />
      </div>
      <div className="field">
        <span className="label">İlgi alanların</span>
        <Chips label="İlgi alanları" values={draft.interests} options={INTERESTS} onToggle={(v) => set({ interests: toggle(draft.interests, v) })} />
      </div>
    </>,
    <>
      <h1>Ne kadar zamanın var?</h1>
      <div className="field">
        <label htmlFor="ob-min">Günlük süre: {draft.dailyMinutes} dk</label>
        <input id="ob-min" className="range" type="range" min={5} max={60} step={5} value={draft.dailyMinutes} onChange={(e) => set({ dailyMinutes: Number(e.target.value) })} />
      </div>
      <div className="field">
        <label htmlFor="ob-new">Günlük yeni öğe: {draft.newPerDay}</label>
        <input id="ob-new" className="range" type="range" min={1} max={20} value={draft.newPerDay} onChange={(e) => set({ newPerDay: Number(e.target.value) })} />
      </div>
      <p className="small muted">
        Önerilen başlangıç: günde 15 dakika ve 5 yeni öğe. Bu bir tasarım tercihidir, bilimsel bir zorunluluk değil. Tekrarların çoğaldığı günlerde
        uygulama yeni öğe sayısını otomatik azaltır; Günün Kelimesi her zaman kalır.
      </p>
    </>,
    <>
      <h1>Kısa bir kontrol ister misin?</h1>
      <p>
        {getLanguage(draft.activeLang).nameTr} için 6 kelimelik, 1 dakikalık bir tanıma kontrolü. Tanıdıkların doğrudan tekrar planına alınır, böylece bildiklerini
        baştan öğrenmezsin. İstersen atlayabilirsin.
      </p>
    </>,
  ]
  const last = step === screens.length - 1
  return (
    <div className="page" style={{ maxWidth: 640, minHeight: '100dvh', alignContent: 'center' }}>
      <div className="card">{screens[step]}</div>
      <div className="row">
        {step > 0 ? <button className="btn" onClick={() => setStep(step - 1)}>Geri</button> : null}
        <div style={{ flex: 1 }} />
        {last ? (
          <>
            <button className="btn" onClick={() => void finish()}>Atla ve başla</button>
            <button className="btn btn-primary" onClick={() => setChecking(true)}>Kontrolü yap</button>
          </>
        ) : (
          <button className="btn btn-primary" disabled={step === 1 && draft.targetLanguages.length === 0} onClick={() => setStep(step + 1)}>Devam</button>
        )}
      </div>
      <p className="tiny muted" style={{ textAlign: 'center' }}>{step + 1} / {screens.length}</p>
    </div>
  )
}
