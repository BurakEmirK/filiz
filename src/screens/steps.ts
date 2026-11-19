import { content, shuffle } from '../content/registry'
import { isSoundSense } from '../content/sounds'
import type { Lesson, Sense, TaskSpec } from '../content/types'
import { normalize, stripStress } from '../domain/text'
import type { ErrorNote, LessonState, Skill, SkillMemory, StepDesc } from '../domain/types'

// Alıştırma adımlarını oluşturan saf fonksiyonlar. Aynı ders için aynı sırayı üretir
// (tohumlu rastgelelik), böylece yarım kalan ders kaldığı adımdan devam edebilir.

export type Step =
  | { kind: 'intro'; sense: Sense; tag?: 'wod' }
  | { kind: 'choose'; sense: Sense; options: Sense[]; mode: 'audio' | 'text'; skill: Skill }
  | { kind: 'choose-gloss'; sense: Sense; options: Sense[]; mode: 'audio' | 'text'; skill: Skill }
  | { kind: 'flash'; sense: Sense }
  | { kind: 'type'; sense: Sense; mode: 'word' | 'cloze'; exampleIndex?: number }
  | { kind: 'produce'; sense: Sense }
  | { kind: 'task'; task: TaskSpec }
  | { kind: 'letter'; sense: Sense }

export function stepSenseIds(s: Step): string[] {
  return s.kind === 'task' ? s.task.targetSenseIds : [s.sense.id]
}

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

const hasImage = (s: Sense) => Boolean(content.imageFor(s))

/** Tanıma alıştırması: çizimi varsa görsel seçme, yoksa anlam seçme. */
export function recognize(sense: Sense, mode: 'audio' | 'text', rnd: () => number): Step {
  const skill: Skill = mode === 'audio' ? 'recognizeAudio' : 'recognizeText'
  if (hasImage(sense)) {
    return { kind: 'choose', sense, options: shuffle([sense, ...content.distractors(sense, 3, rnd)], rnd), mode, skill }
  }
  return { kind: 'choose-gloss', sense, options: shuffle([sense, ...content.glossDistractors(sense, 3, rnd)], rnd), mode, skill }
}

/** Bir örnek cümlede hedef kelimenin geçtiği biçimi bulur (boşluk doldurma için). */
export function findCloze(sense: Sense, exampleIndex: number): { before: string; answer: string; after: string; tr: string } | undefined {
  const ex = sense.examples[exampleIndex]
  if (!ex) return undefined
  const text = stripStress(ex.text)
  const forms = [...sense.forms].filter(Boolean).sort((a, b) => b.length - a.length)
  for (const f of forms) {
    const re = new RegExp(`(^|[^\\p{L}])(${stripStress(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^\\p{L}]|$)`, 'iu')
    const m = re.exec(text)
    if (m) {
      const start = m.index + m[1].length
      return { before: text.slice(0, start), answer: m[2], after: text.slice(start + m[2].length), tr: ex.tr }
    }
  }
  return undefined
}

/** Ders (kısa düzen, sürüm 2): her kelime tanıtılır, bir sonraki kelimeden sonra tanıma ile sorulur.
 *  5 kelimede 10 adım. Yazma, boşluk doldurma ve cümle kurma sonraki tekrarlara dağıtılır (bkz. daily.ts).
 *  Sektör derslerindeki pratik görevler sonda kalır (isteğe bağlı). */
export const LESSON_SEQ = 2

export function lessonSteps(lesson: Lesson): Step[] {
  if (lesson.track === 'sounds') return soundLessonSteps(lesson)
  const rnd = seeded(lesson.id)
  const senses = lesson.senseIds.map((id) => content.sense(id))
  const steps: Step[] = []
  const mode = (i: number) => (i % 2 === 0 ? 'audio' : 'text')
  senses.forEach((s, i) => {
    steps.push({ kind: 'intro', sense: s })
    if (i > 0) steps.push(recognize(senses[i - 1], mode(i - 1), rnd))
  })
  if (senses.length) steps.push(recognize(senses[senses.length - 1], mode(senses.length - 1), rnd))
  for (const id of lesson.taskIds ?? []) {
    const t = content.tasks.get(id)
    if (t) steps.push({ kind: 'task', task: t })
  }
  return steps
}

/** Eski uzun düzen (sürüm 1): yalnızca bu düzende yarım kalmış dersleri kaldığı adımdan sürdürmek için. */
export function legacyLessonSteps(lesson: Lesson): Step[] {
  if (lesson.track === 'sounds') return soundLessonSteps(lesson)
  const rnd = seeded(lesson.id)
  const senses = lesson.senseIds.map((id) => content.sense(id))
  const steps: Step[] = []
  senses.forEach((s, i) => {
    steps.push({ kind: 'intro', sense: s })
    if (i > 0) steps.push(recognize(senses[i - 1], 'audio', rnd))
  })
  steps.push(recognize(senses[senses.length - 1], 'audio', rnd))
  for (const s of shuffle(senses, rnd)) steps.push(recognize(s, 'text', rnd))
  for (const s of senses) steps.push({ kind: 'type', sense: s, mode: 'word' })
  for (const s of senses.slice(0, 2)) if (findCloze(s, 0)) steps.push({ kind: 'type', sense: s, mode: 'cloze', exampleIndex: 0 })
  steps.push({ kind: 'produce', sense: senses[0] })
  for (const id of lesson.taskIds ?? []) {
    const t = content.tasks.get(id)
    if (t) steps.push({ kind: 'task', task: t })
  }
  return steps
}

/** Bir dersin hangi düzenle ve hangi adımdan açılacağı.
 *  - Eski düzende yarım kalmış ders: eski sırayla, kaldığı adımdan (ilgisiz adıma atlamaz, ilerleme silinmez).
 *  - Yeni düzende yarım: kaldığı adım; dizinin dışına taşmışsa son adım (ders kendiliğinden "bitti" sayılmaz).
 *  - Bitmiş veya hiç açılmamış: yeni düzen, baştan. */
export function lessonStepsFor(lesson: Lesson, state: LessonState | undefined): { steps: Step[]; legacy: boolean; startAt: number } {
  if (state?.status === 'in-progress' && lesson.track !== 'sounds' && (state.seq ?? 1) < LESSON_SEQ) {
    const steps = legacyLessonSteps(lesson)
    return { steps, legacy: true, startAt: Math.min(state.step, Math.max(0, steps.length - 1)) }
  }
  const steps = lessonSteps(lesson)
  if (state?.status !== 'in-progress') return { steps, legacy: false, startAt: 0 }
  return { steps, legacy: false, startAt: Math.min(state.step, Math.max(0, steps.length - 1)) }
}

/** Sesler ve Harfler dersi: her harfi tanıt (iPad'de yazma alanıyla), sonra harf → ses eşleştirme */
export function soundLessonSteps(lesson: Lesson): Step[] {
  const rnd = seeded(lesson.id)
  const senses = lesson.senseIds.map((id) => content.sense(id))
  const steps: Step[] = senses.map((s) => ({ kind: 'letter', sense: s }) as Step)
  if (senses.length > 1) for (const s of shuffle(senses, rnd)) steps.push(recognize(s, 'text', rnd))
  return steps
}

/** Bir tekrar adımı: her beceri kendi alıştırma türüyle sınanır. */
export function reviewStep(m: SkillMemory, s: Sense, rnd: () => number): Step | undefined {
  if (m.skill === 'recognizeText') return isSoundSense(s.id) ? recognize(s, 'text', rnd) : { kind: 'flash', sense: s }
  if (m.skill === 'recognizeAudio') return s.customGloss && !s.generated && !hasImage(s) ? { kind: 'flash', sense: s } : recognize(s, 'audio', rnd)
  if (m.skill === 'write') return writeStep(s, rnd)
  return undefined
}

/** Yazma adımı: örnek cümlede kelime bulunursa yarı yarıya boşluk doldurma (bağlam içinde kullanım), yoksa kelimeyi yaz. */
export function writeStep(s: Sense, rnd: () => number): Step {
  const alt = s.examples.length > 1 ? Math.floor(rnd() * s.examples.length) : 0
  return findCloze(s, alt) && rnd() < 0.5 ? { kind: 'type', sense: s, mode: 'cloze', exampleIndex: alt } : { kind: 'type', sense: s, mode: 'word' }
}

/** Tekrar oturumu (Keşfet → Tekrar): her beceri kendi alıştırma türüyle sınanır. */
export function reviewSteps(due: SkillMemory[], resolve: (id: string) => Sense | undefined, limit = 20): Step[] {
  const rnd = seeded(`review-${due.map((d) => d.id).join()}`)
  const steps: Step[] = []
  for (const m of due.slice(0, limit)) {
    const s = resolve(m.senseId)
    if (!s) continue
    const step = reviewStep(m, s, rnd)
    if (step) steps.push(step)
  }
  return steps
}

/** Günün Kelimesi: yeni kelime + aynı konudaki eski kelimelerle bağlantılı kısa tekrar */
export function wordOfDaySteps(sense: Sense, related: Sense[], alreadyIntroduced: boolean): Step[] {
  const rnd = seeded(`wod-${sense.id}`)
  const steps: Step[] = []
  if (!alreadyIntroduced) steps.push({ kind: 'intro', sense })
  steps.push(recognize(sense, 'audio', rnd))
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
  return lesson.senseIds.map((id) => recognize(content.sense(id), 'text', rnd))
}

/** Bir birimi (10 ders, 50 kelime) atlamak için 10 kelimelik kontrol */
export function unitCheckSteps(lessons: Lesson[], seed: string): Step[] {
  const rnd = seeded(seed)
  const ids = shuffle(lessons.flatMap((l) => l.senseIds), rnd).slice(0, 10)
  return ids.map((id) => recognize(content.sense(id), 'text', rnd))
}

/** Demo: dinle → görselle eşleştir → kelimeyi görselle eşleştir (3–5 dk hedef, kesin değil) */
export function demoSteps(lang: string, seed: string): Step[] {
  const rnd = seeded(seed)
  const pool = content
    .coreLessons(lang)
    .filter((l) => !l.id.startsWith('g-'))
    .flatMap((l) => l.senseIds)
    .map((id) => content.sense(id))
    .filter((s) => content.concepts.get(s.conceptId)?.imageNeed === 'concrete')
  const picked = shuffle(pool, rnd).slice(0, 4)
  const steps: Step[] = []
  picked.forEach((s, i) => {
    steps.push({ kind: 'intro', sense: s })
    if (i > 0) steps.push(recognize(picked[i - 1], 'audio', rnd))
  })
  steps.push(recognize(picked[picked.length - 1], 'audio', rnd))
  for (const s of shuffle(picked, rnd)) steps.push(recognize(s, 'text', rnd))
  return steps
}

/** Kelime yazma alıştırmasında kabul edilen cevaplar: sözlük biçimi (ifadelerde çekimli biçimler de).
 *  Aynı Türkçe anlamı taşıyan başka kelimeler kabul EDİLMEZ (birbirinin yerine geçtikleri varsayılmaz); bkz. relatedForWord. */
export function acceptedForWord(sense: Sense): string[] {
  const lemma = content.lemma(sense)
  const lex = content.lexemes.get(sense.lexemeId)
  const multi = lex?.pos === 'interj' || lex?.pos === 'phrase' || lex?.pos === 'noun-phrase'
  const list = multi ? [lemma, ...sense.forms] : [lemma]
  return [...new Set(list)]
}

/** Aynı Türkçe anlamlı diğer kelimeler: yazılırsa "benzer olabilir ama burada istenen bu" diye açıklanır. */
export function relatedForWord(sense: Sense): string[] {
  const own = new Set(acceptedForWord(sense).map((x) => x.toLocaleLowerCase(sense.lang)))
  return [...new Set(content.sameGloss(sense).map((o) => content.lemma(o)))].filter((x) => !own.has(x.toLocaleLowerCase(sense.lang)))
}

// ---- Adımların kaydedilmesi (günlük oturum kaldığı yerden sürer) ----

export function toDesc(s: Step): StepDesc {
  switch (s.kind) {
    case 'intro':
      return s.tag ? { kind: 'intro', senseId: s.sense.id, tag: s.tag } : { kind: 'intro', senseId: s.sense.id }
    case 'choose':
    case 'choose-gloss':
      return { kind: s.kind, senseId: s.sense.id, optionIds: s.options.map((o) => o.id), mode: s.mode, skill: s.skill }
    case 'type':
      return s.exampleIndex === undefined ? { kind: 'type', senseId: s.sense.id, mode: s.mode } : { kind: 'type', senseId: s.sense.id, mode: s.mode, exampleIndex: s.exampleIndex }
    case 'task':
      return { kind: 'task', senseId: s.task.targetSenseIds[0] ?? '', taskId: s.task.id }
    default:
      return { kind: s.kind, senseId: s.sense.id }
  }
}

/** Kayıtlı tanımdan adımı kurar. İçerik artık yoksa (ör. paket değişti) undefined döner; adım atlanır. */
export function fromDesc(d: StepDesc, resolve: (id: string) => Sense | undefined): Step | undefined {
  if (d.kind === 'task') {
    const task = content.tasks.get(d.taskId)
    return task ? { kind: 'task', task } : undefined
  }
  const sense = resolve(d.senseId)
  if (!sense) return undefined
  switch (d.kind) {
    case 'intro':
      return d.tag ? { kind: 'intro', sense, tag: d.tag } : { kind: 'intro', sense }
    case 'choose':
    case 'choose-gloss': {
      const options = d.optionIds.map(resolve).filter((x): x is Sense => Boolean(x))
      if (!options.some((o) => o.id === sense.id) || options.length < 2) return undefined
      return { kind: d.kind, sense, options, mode: d.mode, skill: d.skill }
    }
    case 'type':
      return d.exampleIndex === undefined ? { kind: 'type', sense, mode: d.mode } : { kind: 'type', sense, mode: d.mode, exampleIndex: d.exampleIndex }
    default:
      return { kind: d.kind, sense }
  }
}

export function senseTitle(s: Sense) {
  return normalize(content.lemma(s), s.lang)
}
