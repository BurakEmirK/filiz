import { useState } from 'react'
import { useApp, useAsync } from '../app/context'
import { go } from '../app/router'
import { INDUSTRIES } from '../content/industries'
import { getLanguage } from '../content/languages'
import { content } from '../content/registry'
import { LangSwitcher, LinkRow } from '../ui/components'
import { Icon } from '../ui/icons'
import { ContentGate } from './Tabs'

// Keşfet: isteğe bağlı her şey. Öğrenme yolu, Sesler ve Harfler, sektör terimleri, kelimeler ve ek pratik.

export function ExploreScreen() {
  const { profile } = useApp()
  return (
    <ContentGate lang={profile.activeLang}>
      <ExploreInner />
    </ContentGate>
  )
}

function ExploreInner() {
  const { repo, profile, updateProfile, dataVersion } = useApp()
  const lang = profile.activeLang
  const [q, setQ] = useState('')
  const { data } = useAsync(async () => {
    const states = await repo.lessonStates(lang)
    const due = await repo.dueSkills(lang)
    const errors = (await repo.errorsForLang(lang)).filter((e) => !e.resolved && !e.deleted)
    const phrases = await repo.phrasesForLang(lang)
    return { states, dueSenses: new Set(due.map((d) => d.senseId)).size, errors: errors.length, phrases: phrases.length }
  }, [lang, dataVersion])
  const doneIds = new Set((data?.states ?? []).filter((s) => s.status !== 'in-progress').map((s) => s.lessonId))
  const lessons = content.coreLessons(lang)
  const sounds = content.soundLessons(lang)
  const withContent = INDUSTRIES.map((ind) => ({ ind, n: content.industryLessons(lang, ind.id).length }))
  const textileElsewhere = ['en', 'ru'].filter((l) => l !== lang && content.industryLessons(l, 'textile').length)

  return (
    <div className="page explore">
      <div className="page-head">
        <div>
          <h1>Keşfet</h1>
          <p>İstediğin zaman: dersler, sesler, sektör terimleri ve kelimelerin.</p>
        </div>
        <LangSwitcher value={lang} options={profile.targetLanguages} onChange={(l) => updateProfile({ activeLang: l })} />
      </div>

      <form
        role="search"
        className="search-box"
        onSubmit={(e) => {
          e.preventDefault()
          go(`#/words?tab=all&q=${encodeURIComponent(q.trim())}`)
        }}
      >
        <label htmlFor="explore-q" className="sr-only">Kelime ara</label>
        <input id="explore-q" className="input" type="search" enterKeyHint="search" placeholder="Kelime veya anlam ara" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" type="submit">Ara</button>
      </form>

      <div className="explore-grid">
        <section aria-labelledby="ex-path">
          <h2 className="section-title" id="ex-path">Öğrenme yolu</h2>
          <div className="rows">
            <LinkRow href="#/learn" icon={<Icon.learn />} title="Ders kütüphanesi" detail={`${lessons.length} dersin ${lessons.filter((l) => doneIds.has(l.id)).length} tanesi tamam`} />
            {sounds.length ? (
              <LinkRow href="#/sounds" icon={<Icon.pen />} title="Sesler ve Harfler" detail={`Alfabe ve okunuş, ${sounds.filter((l) => doneIds.has(l.id)).length}/${sounds.length} ders`} />
            ) : null}
          </div>
        </section>

        <section aria-labelledby="ex-ind">
          <h2 className="section-title" id="ex-ind">Sektör</h2>
          <div className="rows">
            {withContent
              .filter((x) => x.n > 0)
              .map(({ ind, n }) => (
                <LinkRow key={ind.id} href={`#/industries/${ind.id}?lang=${lang}`} icon={<Icon.industry />} title={ind.nameTr} detail={`${getLanguage(lang).nameTr}, ${n} ders`} />
              ))}
            {withContent.every((x) => x.n === 0) ? (
              <LinkRow
                href={`#/industries?lang=${textileElsewhere[0] ?? lang}`}
                icon={<Icon.industry />}
                title="Tekstil"
                detail={textileElsewhere.length ? `${getLanguage(lang).nameTr} içerik henüz yok; ${textileElsewhere.map((l) => getLanguage(l).nameTr).join(' ve ')} var` : 'Bu dilde içerik henüz yok'}
              />
            ) : null}
            <LinkRow href={`#/industries?lang=${lang}`} title="Tüm sektörler" detail="Finans, bilişim, mühendislik, mimarlık" />
          </div>
        </section>

        <section aria-labelledby="ex-words">
          <h2 className="section-title" id="ex-words">Kelimelerin</h2>
          <div className="rows">
            <LinkRow href="#/words?tab=all" icon={<Icon.words />} title="Tüm kelimeler" detail="Ara, anlamına ve sesine bak" />
            <LinkRow href="#/words?tab=collection" icon={<Icon.plus />} title="Koleksiyonum" detail={data ? `${data.phrases} kendi ifaden` : undefined} />
            <LinkRow href="#/words?tab=errors" icon={<Icon.hint />} title="Hata defteri" detail={data ? `${data.errors} açık kayıt` : undefined} />
          </div>
        </section>

        <section aria-labelledby="ex-extra">
          <h2 className="section-title" id="ex-extra">Ek pratik</h2>
          <div className="rows">
            <LinkRow href="#/review" icon={<Icon.refresh />} title="Tekrar" detail={data ? (data.dueSenses ? `${data.dueSenses} kelimenin zamanı geldi` : 'Şu an zamanı gelen tekrar yok') : undefined} />
            <LinkRow href="#/wod" icon={<Icon.sparkle />} title="Günün kelimesi pratiği" detail="Dinle, yaz, bağlantılı kelimeler" />
          </div>
        </section>
      </div>
    </div>
  )
}
