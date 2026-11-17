import { content, shuffle } from '../content/registry'
import type { Lesson, Sense, TaskSpec } from '../content/types'
import { normalize, stripStress } from '../domain/text'
import type { ErrorNote, Skill, SkillMemory } from '../domain/types'

// Alıştırma adımlarını oluşturan saf fonksiyonlar. Aynı ders için aynı sırayı üretir
// (tohumlu rastgelelik), böylece yarım kalan ders kaldığı adımdan devam edebilir.

export type Step =
  | { kind: 'intro'; sense: Sense }
  | { kind: 'choose'; sense: Sense; options: Sense[]; mode: 'audio' | 'text'; skill: Skill }
  | { kind: 'flash'; sense: Sense }
  | { kind: 'type'; sense: Sense; mode: 'word' | 'cloze'; exampleIndex?: number }
  | { kind: 'produce'; sense: Sense }
  | { kind: 'task'; task: TaskSpec }

export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function choose(sense: Sense, mode: 'audio' | 'text', rnd: () => number): Step {
  const options = shuffle([sense, ...content.distractors(sense, 3, rnd)], rnd)
  return { kind: 'choose', sense, options, mode, skill: mode === 'audio' ? 'recognizeAudio' : 'recognizeText' }
}

const hasImage = (s: Sense) => Boolean(content.imageFor(s))

/** Bir örnek cümlede hedef kelimenin geçtiği biçimi bulur (boşluk doldurma için). */
export function findCloze(sense: Sense, exampleIndex: number): { before: string; answer: string; after: string; tr: string } | undefined {
  const ex = sense.examples[exampleIndex]
  if (!ex) return undefined
  const text = stripStress(ex.text)
  const forms = [...sense.forms].sort((a, b) => b.length - a.length)
  for (const f of forms) {
    const re = new RegExp(`(^|[^\\p{L}])(${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^\\p{L}]|$)`, 'iu')
    const m = re.exec(text)
    if (m) {
      const start = m.index + m[1].length
      return { before: text.slice(0, start), answer: m[2], after: text.slice(start + m[2].length), tr: ex.tr }
    }
  }
  return undefined
}

/** Ders: tanıt → tanı (ses/görsel) → yaz → cümlede kullan → kendi cümleni kur → görev */
export function lessonSteps(lesson: Lesson): Step[] {
  const rnd = seeded(lesson.id)
  const senses = lesson.senseIds.map((id) => content.sense(id))
  const steps: Step[] = []
  senses.forEach((s, i) => {
    steps.push({ kind: 'intro', sense: s })
    if (i > 0 && hasImage(senses[i - 1])) steps.push(choose(senses[i - 1], 'audio', rnd))
  })
  const last = senses[senses.length - 1]
  if (hasImage(last)) steps.push(choose(last, 'audio', rnd))
  for (const s of shuffle(senses, rnd)) if (hasImage(s)) steps.push(choose(s, 'text', rnd))
  for (const s of senses) steps.push({ kind: 'type', sense: s, mode: 'word' })
  for (const s of senses.slice(0, 2)) if (findCloze(s, 0)) steps.push({ kind: 'type', sense: s, mode: 'cloze', exampleIndex: 0 })
  steps.push({ kind: 'produce', sense: senses[0] })
  for (const id of lesson.taskIds ?? []) {
    const t = content.tasks.get(id)
    if (t) steps.push({ kind: 'task', task: t })
  }
  return steps
}

/** Tekrar oturumu: her beceri kendi alıştırma türüyle sınanır. */
export function reviewSteps(due: SkillMemory[], resolve: (id: string) => Sense | undefined, limit = 20): Step[] {
  const rnd = seeded(`review-${due.map((d) => d.id).join()}`)
  const steps: Step[] = []
  for (const m of due.slice(0, limit)) {
    const s = resolve(m.senseId)
    if (!s) continue
    if (m.skill === 'recognizeText') steps.push({ kind: 'flash', sense: s })
    else if (m.skill === 'recognizeAudio') steps.push(hasImage(s) ? choose(s, 'audio', rnd) : { kind: 'flash', sense: s })
    else if (m.skill === 'write') {
      const alt = s.examples.length > 1 ? Math.floor(rnd() * s.examples.length) : 0
      steps.push(findCloze(s, alt) && rnd() < 0.5 ? { kind: 'type', sense: s, mode: 'cloze', exampleIndex: alt } : { kind: 'type', sense: s, mode: 'word' })
    }
  }
  return steps
}

/** Günün Kelimesi: yeni kelime + aynı konudaki eski kelimelerle bağlantılı kısa tekrar */
export function wordOfDaySteps(sense: Sense, related: Sense[], alreadyIntroduced: boolean): Step[] {
  const rnd = seeded(`wod-${sense.id}`)
  const steps: Step[] = []
  if (!alreadyIntroduced) steps.push({ kind: 'intro', sense })
  if (hasImage(sense)) steps.push(choose(sense, 'audio', rnd))
  steps.push({ kind: 'type', sense, mode: 'word' })
  for (const r of related) steps.push({ kind: 'flash', sense: r })
  steps.push({ kind: 'produce', sense })
  return steps
}

/** Hata defteri pratiği: hatanın görüldüğü örnekten FARKLI bir örnekle */
export function errorPracticeSteps(err: ErrorNote, sense: Sense): Step[] {
  const steps: Step[] = [{ kind: 'intro', sense }]
  const used = sense.examples.findIndex((e) => e.id === err.exampleId)
  const other = sense.examples.findIndex((_, i) => i !== used && findCloze(sense, i))
  if (other >= 0) steps.push({ kind: 'type', sense, mode: 'cloze', exampleIndex: other })
  steps.push({ kind: 'type', sense, mode: 'word' })
  steps.push({ kind: 'produce', sense })
  return steps
}

/** "Bunu biliyorum, atla": kısa kontrol */
export function skipCheckSteps(lesson: Lesson): Step[] {
  const rnd = seeded(`skip-${lesson.id}`)
  return lesson.senseIds.map((id) => content.sense(id)).map((s) => (hasImage(s) ? choose(s, 'text', rnd) : { kind: 'flash' as const, sense: s }))
}

/** Demo: dinle → görselle eşleştir → kelimeyi görselle eşleştir (3–5 dk hedef, kesin değil) */
export function demoSteps(lang: string, seed: string): Step[] {
  const rnd = seeded(seed)
  const pool = content.coreSenseOrder(lang).map((id) => content.sense(id)).filter((s) => content.concept(s.conceptId).imageNeed === 'concrete')
  const picked = shuffle(pool, rnd).slice(0, 4)
  const steps: Step[] = []
  picked.forEach((s, i) => {
    steps.push({ kind: 'intro', sense: s })
    if (i > 0) steps.push(choose(picked[i - 1], 'audio', rnd))
  })
  steps.push(choose(picked[picked.length - 1], 'audio', rnd))
  for (const s of shuffle(picked, rnd)) steps.push(choose(s, 'text', rnd))
  return steps
}

/** Kelime yazma alıştırmasında kabul edilen cevaplar */
export function acceptedForWord(sense: Sense): string[] {
  const lemma = content.lemma(sense)
  const lex = content.lexemes.get(sense.lexemeId)
  const multi = lex?.pos === 'interj' || lex?.pos === 'phrase' || lex?.pos === 'noun-phrase'
  const list = multi ? [lemma, ...sense.forms] : [lemma]
  return [...new Set(list.map((x) => x))]
}

export function senseTitle(s: Sense) {
  return normalize(content.lemma(s), s.lang)
}
