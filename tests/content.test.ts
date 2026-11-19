import { describe, expect, it } from 'vitest'
import { content } from '../src/content/registry'
import { isSoundSense, SOUND_MODULES } from '../src/content/sounds'
import { hasIllustration } from '../src/ui/illustrations'
import { demoSteps, findCloze, lessonSteps } from '../src/screens/steps'

const words = () => [...content.senses.values()].filter((s) => !isSoundSense(s.id))

describe('İçerik bütünlüğü (elle hazırlanmış)', () => {
  it('her görsel varlığın gerçek bir çizimi var (eksikse "eksik" diye işaretlenmeli)', () => {
    for (const a of content.assets.values()) {
      if (a.status === 'original-illustration') expect(hasIllustration(a.render), a.id).toBe(true)
    }
  })

  it('her kelimenin en az bir örnek cümlesi, açıklaması ve üretim yönergesi var', () => {
    for (const s of words()) {
      expect(s.examples.length, s.id).toBeGreaterThan(0)
      expect(s.explanation.length, s.id).toBeGreaterThan(0)
      expect(s.productionPrompt.length, s.id).toBeGreaterThan(0)
    }
  })

  it('örnek cümlelerde hedef kelime bilinen biçimlerden biriyle geçiyor (boşluk doldurma kurulabiliyor)', () => {
    const missing = words().filter((s) => !findCloze(s, 0)).map((s) => s.id)
    expect(missing).toEqual([])
  })

  it('vurgu işareti yalnızca Kiril harflerinden silinir; diğer dillerin aksanlı harfleri korunur', async () => {
    const { stripStress, normalize } = await import('../src/domain/text')
    expect(stripStress('молоко́')).toBe('молоко')
    expect(stripStress('A ház nagy.')).toBe('A ház nagy.')
    expect(stripStress('köszönöm, ő, ű, é, ñ, à')).toBe('köszönöm, ő, ű, é, ñ, à')
    expect(normalize('Ёлка', 'ru')).toBe('елка')
    expect(normalize('Kenyér', 'hu')).toBe('kenyér')
  })

  it('ders adımları tekrarlanabilir: aynı ders her açılışta aynı sırayı üretir (kaldığı yerden devam için)', () => {
    const l = content.lessons.get('ru-core-1')!
    const key = (s: ReturnType<typeof lessonSteps>[number]) => s.kind + (s.kind === 'task' ? s.task.id : s.sense.id)
    expect(lessonSteps(l).map(key)).toEqual(lessonSteps(l).map(key))
  })

  it('demo her dilde somut kelimelerle kurulabiliyor', () => {
    for (const lang of ['ru', 'hu', 'fr', 'es', 'en', 'tr']) {
      const steps = demoSteps(lang, 'seed')
      expect(steps.length, lang).toBeGreaterThanOrEqual(10)
      for (const st of steps) if (st.kind === 'choose') expect(st.options.some((o) => o.id === st.sense.id)).toBe(true)
    }
  })
})

describe('Sesler ve Harfler', () => {
  it('6 dilin hepsinde modül var; her öğenin açıklaması ve en az bir örnek kelimesi var', () => {
    expect(SOUND_MODULES.map((m) => m.lang).sort()).toEqual(['en', 'es', 'fr', 'hu', 'ru', 'tr'])
    for (const m of SOUND_MODULES) {
      for (const g of m.groups) {
        for (const it of g.items) {
          expect(it.sound.length, `${m.lang}:${it.id}`).toBeGreaterThan(0)
          expect(it.examples.length, `${m.lang}:${it.id}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('Rusça 33 harfin hepsini kapsıyor', () => {
    const ru = SOUND_MODULES.find((m) => m.lang === 'ru')!
    const letters = new Set(ru.groups.flatMap((g) => g.items).flatMap((i) => i.letters.split(' ')).filter((x) => /^[А-ЯЁ]$/.test(x)))
    expect(letters.size).toBe(33)
  })

  it('harf dersleri kelime sırasına karışmaz ama kendi derslerinde çalışır', () => {
    for (const lang of ['ru', 'hu', 'fr', 'es', 'en', 'tr']) {
      expect(content.coreSenseOrder(lang).some(isSoundSense), lang).toBe(false)
      const lessons = content.soundLessons(lang)
      expect(lessons.length, lang).toBeGreaterThan(0)
      const steps = lessonSteps(lessons[0])
      expect(steps.some((s) => s.kind === 'letter')).toBe(true)
      for (const s of steps) if (s.kind === 'choose-gloss') expect(new Set(s.options.map((o) => content.gloss(o))).size).toBe(s.options.length)
    }
  })
})
