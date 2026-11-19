import { useMemo, useState } from 'react'
import { useApp, useAsync, useLangContent } from '../app/context'
import { go } from '../app/router'
import { getLanguage } from '../content/languages'
import { content } from '../content/registry'
import type { Sense } from '../content/types'
import { charDiff } from '../domain/text'
import { SKILL_LABEL, type PersonalPhrase, type Skill, type SkillMemory } from '../domain/types'
import { Card, Dialog, LangSwitcher, Seg, SenseDetail } from '../ui/components'
import { Icon } from '../ui/icons'

type Tab = 'collection' | 'errors' | 'all'

export function WordsScreen({ tab }: { tab: Tab }) {
  const { profile, updateProfile } = useApp()
  const lang = profile.activeLang
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Kelimeler</h1>
          <p>Koleksiyonun, hata defterin ve öğrendiğin anlamlar.</p>
        </div>
        <LangSwitcher value={lang} options={profile.targetLanguages} onChange={(l) => updateProfile({ activeLang: l })} />
      </div>
      <Seg<Tab>
        label="Kelimeler bölümü"
        value={tab}
        onChange={(t) => go(`#/words?tab=${t}`)}
        options={[
          { value: 'collection', label: 'Koleksiyonum' },
          { value: 'errors', label: 'Hata defteri' },
          { value: 'all', label: 'Tüm kelimeler' },
        ]}
      />
      {tab === 'collection' ? <Collection lang={lang} /> : tab === 'errors' ? <Errors lang={lang} /> : <AllWords lang={lang} />}
    </div>
  )
}

const SOURCES: { value: PersonalPhrase['source']; label: string }[] = [
  { value: 'daily', label: 'Günlük hayat' },
  { value: 'text', label: 'Bir metin' },
  { value: 'customer-email', label: 'Müşteri e-postası' },
  { value: 'other', label: 'Diğer' },
]

function Collection({ lang }: { lang: string }) {
  const { repo, dataVersion, bump } = useApp()
  const { data: phrases } = useAsync(() => repo.phrasesForLang(lang), [lang, dataVersion])
  const [form, setForm] = useState({ text: '', meaningTr: '', context: '', example: '', source: 'daily' as PersonalPhrase['source'] })
  const [open, setOpen] = useState(false)
  const save = async () => {
    const p = await repo.addPhrase({ lang, text: form.text.trim(), meaningTr: form.meaningTr.trim(), context: form.context.trim(), example: form.example.trim() || undefined, source: form.source })
    // Tekrar planı: metinde tanıma ve yazma becerileri, hemen tekrar edilebilir olarak eklenir
    for (const skill of ['recognizeText', 'write'] as Skill[]) await repo.seedSkill(lang, `user:${p.id}`, skill, 'collection')
    setForm({ text: '', meaningTr: '', context: '', example: '', source: form.source })
    setOpen(false)
    bump()
  }
  return (
    <>
      <div className="notice">
        <span>Bu ifadeler yalnızca bu cihazda saklanır, hiçbir servise gönderilmez ve Demo Modu'nda görünmez.</span>
      </div>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <Icon.plus /> İfade ekle
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Koleksiyona ekle">
        <div className="field">
          <label htmlFor="ph-text">{getLanguage(lang).nameTr} ifade</label>
          <input id="ph-text" className="input" lang={lang} autoCapitalize="none" autoCorrect="off" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="ph-mean">Bu bağlamdaki anlamı (Türkçe)</label>
          <input id="ph-mean" className="input" value={form.meaningTr} onChange={(e) => setForm({ ...form, meaningTr: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="ph-ctx">Nerede gördün? (isteğe bağlı)</label>
          <input id="ph-ctx" className="input" placeholder="ör. tedarikçinin teslimat e-postası" value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="ph-ex">Örnek cümle (isteğe bağlı)</label>
          <input id="ph-ex" className="input" lang={lang} value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
        </div>
        <div className="field">
          <span className="label">Kaynak</span>
          <Seg label="Kaynak" value={form.source} onChange={(v) => setForm({ ...form, source: v })} options={SOURCES} />
        </div>
        <p className="tiny muted">Kaydettiğinde ifade aralıklı tekrar planına alınır. Anlamı sen girdiğin için içerik "kendin kontrol ettin" olarak işaretlenir.</p>
        <button className="btn btn-primary" disabled={!form.text.trim() || !form.meaningTr.trim()} onClick={save}>
          Kaydet
        </button>
      </Dialog>
      <Card>
        {phrases?.length ? (
          <div className="list">
            {phrases.map((p) => (
              <div className="list-item" key={p.id}>
                <div className="grow">
                  <b lang={lang}>{p.text}</b> <span className="muted">— {p.meaningTr}</span>
                  <div className="tiny muted">
                    {SOURCES.find((s) => s.value === p.source)?.label}
                    {p.context ? ` · ${p.context}` : ''}
                  </div>
                </div>
                <button className="btn btn-ghost btn-icon btn-danger" aria-label={`${p.text} ifadesini sil`} onClick={async () => { if (confirm('Bu ifade ve tekrar planı silinsin mi?')) { await repo.deletePhrase(p.id); bump() } }}>
                  <Icon.trash />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Henüz ifade yok. Günlük hayatta, bir metinde veya müşteri e-postasında karşılaştığın ifadeleri ekleyebilirsin.</p>
        )}
      </Card>
    </>
  )
}

function Errors({ lang }: { lang: string }) {
  const { repo, dataVersion } = useApp()
  const { data: errors } = useAsync(() => repo.errorsForLang(lang), [lang, dataVersion])
  return (
    <Card>
      {errors?.length ? (
        <div className="list">
          {errors.map((e) => {
            const sense = content.senses.get(e.senseId)
            return (
              <div className="list-item" key={e.id} style={{ alignItems: 'flex-start' }}>
                <div className="grow stack" style={{ gap: 4 }}>
                  <span className="diff" lang={lang}>
                    {charDiff(e.userText, e.correctText).map((d, i) => (
                      <span key={i} className={d.type}>{d.text}</span>
                    ))}
                  </span>
                  <span className="small">{e.explanation}</span>
                  <span className="tiny muted">
                    {sense ? `${content.lemma(sense)} · ${content.gloss(sense)} · ` : ''}
                    {e.kind === 'spelling' ? 'yazım' : e.kind === 'grammar' ? 'dilbilgisi' : e.kind === 'meaning' ? 'anlam' : 'kelime seçimi'}
                    {e.practicedCount ? ` · ${e.practicedCount} kez çalışıldı` : ''}
                  </span>
                </div>
                <div className="stack" style={{ gap: 6, justifyItems: 'end' }}>
                  {e.resolved ? <span className="pill good">Düzeldi</span> : null}
                  <button className="btn btn-soft" onClick={() => go(`#/practice/${e.id}`)}>Pratik yap</button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="muted">Hata defterin boş. Yanlış yazdığın kelimeler burada toplanır ve farklı örneklerle tekrar çalışılır.</p>
      )}
    </Card>
  )
}

const SKILLS: Skill[] = ['recognizeText', 'recognizeAudio', 'write', 'produce']

function SkillDots({ senseId, skills }: { senseId: string; skills: SkillMemory[] }) {
  return (
    <span className="row" style={{ gap: 4 }} aria-label="Beceri durumu">
      {SKILLS.map((k) => {
        const m = skills.find((s) => s.senseId === senseId && s.skill === k)
        const color = !m ? 'var(--surface-2)' : m.card.stability >= 21 ? 'var(--good)' : m.card.state === 2 ? 'var(--info)' : 'var(--warn)'
        return <span key={k} title={`${SKILL_LABEL[k]}: ${!m ? 'başlanmadı' : m.card.stability >= 21 ? 'güçlü' : m.card.state === 2 ? 'tekrarda' : 'öğreniliyor'}`} style={{ width: 10, height: 10, borderRadius: 5, background: color, border: '1px solid var(--border)' }} />
      })}
    </span>
  )
}

const PAGE = 60

function AllWords({ lang }: { lang: string }) {
  const loaded = useLangContent(lang)
  const { repo, profile, dataVersion, bump } = useApp()
  const { data: skills } = useAsync(() => repo.skillsForLang(lang), [lang, dataVersion])
  const [detail, setDetail] = useState<Sense | null>(null)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<'all' | 'learning' | 'textile'>('all')
  const [limit, setLimit] = useState(PAGE)
  const started = useMemo(() => new Set((skills ?? []).map((s) => s.senseId)), [skills])
  const senses = useMemo(() => {
    const all = content.sensesForLang(lang).filter((s) => s.senseIndex === 1 || started.has(s.id))
    return all.sort((a, b) => (a.generated ? 1 : 0) - (b.generated ? 1 : 0) || (a.rank ?? 0) - (b.rank ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, loaded.ready, started])
  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr')
    return senses.filter((s) => {
      if (group === 'learning' && !started.has(s.id)) return false
      if (group === 'textile' && s.industry !== 'textile') return false
      if (!needle) return true
      return [content.lemma(s), content.gloss(s), s.glossEn ?? ''].some((t) => t.toLocaleLowerCase('tr').includes(needle))
    })
  }, [senses, q, group, started])
  const learnSense = async (s: Sense) => {
    for (const k of ['recognizeText', 'write'] as Skill[]) await repo.seedSkill(lang, s.id, k, 'lesson')
    bump()
  }
  return (
    <>
      <div className="search stack" style={{ gap: 8 }}>
        <input className="input" type="search" placeholder="Kelime veya anlam ara" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} aria-label="Kelime ara" />
        <Seg label="Kelime grubu" value={group} onChange={(v) => { setGroup(v); setLimit(PAGE) }} options={[{ value: 'all', label: 'Tümü' }, { value: 'learning', label: 'Öğrendiklerim' }, { value: 'textile', label: 'Tekstil' }]} />
      </div>
      <p className="tiny muted">
        {filtered.length} kelime. Noktalar sırasıyla: metinde tanıma · seste anlama · yazma · kendiliğinden üretme. Gri: başlanmadı, sarı: öğreniliyor, mavi: tekrarda, yeşil: güçlü.
      </p>
      <Card>
        <div className="list">
          {filtered.slice(0, limit).map((s) => (
            <button className="list-item" key={s.id} onClick={() => setDetail(s)}>
              <span className="grow">
                {s.emoji ? <span aria-hidden="true">{s.emoji} </span> : null}
                <b lang={lang}>{content.lemma(s)}</b> <span className="muted small">· {content.gloss(s)}</span>
                {s.rank ? <span className="tiny muted"> #{s.rank}</span> : null}
                {s.senseIndex > 1 ? <span className="pill" style={{ marginLeft: 6 }}>{s.senseIndex}. anlam</span> : null}
              </span>
              <SkillDots senseId={s.id} skills={skills ?? []} />
            </button>
          ))}
        </div>
        {filtered.length > limit ? (
          <button className="btn" onClick={() => setLimit(limit + PAGE * 2)}>
            Daha fazla göster ({filtered.length - limit} kaldı)
          </button>
        ) : null}
      </Card>
      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? content.lemma(detail) : ''}>
        {detail ? <SenseDetail sense={detail} profile={profile} onLearnSense={(s) => void learnSense(s)} learnedIds={started} /> : null}
      </Dialog>
    </>
  )
}
