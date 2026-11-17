import { describe, expect, it } from 'vitest'
import { content } from '../src/content/registry'
import { hasIllustration } from '../src/ui/illustrations'
import { demoSteps, findCloze, lessonSteps } from '../src/screens/steps'

describe('İçerik bütünlüğü', () => {
  it('her görsel varlığın gerçek bir çizimi var (eksikse "eksik" diye işaretlenmeli)', () => {
    for (const a of content.assets.values()) {
      if (a.status === 'original-illustration') expect(hasIllustration(a.render), a.id).toBe(true)
    }
  })

  it('her anlamın en az bir örnek cümlesi, açıklaması ve üretim yönergesi var', () => {
    for (const s of content.senses.values()) {
      expect(s.examples.length, s.id).toBeGreaterThan(0)
      expect(s.explanation.length, s.id).toBeGreaterThan(0)
      expect(s.productionPrompt.length, s.id).toBeGreaterThan(0)
    }
  })

  it('örnek cümlelerde hedef kelime bilinen biçimlerden biriyle geçiyor (boşluk doldurma kurulabiliyor)', () => {
    const missing = [...content.senses.values()].filter((s) => !findCloze(s, 0)).map((s) => s.id)
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
    const a = lessonSteps(l).map((s) => s.kind + (s.kind === 'task' ? s.task.id : s.sense.id))
    const b = lessonSteps(l).map((s) => s.kind + (s.kind === 'task' ? s.task.id : s.sense.id))
    expect(a).toEqual(b)
  })

  it('demo her dilde somut kelimelerle kurulabiliyor', () => {
    for (const lang of ['ru', 'hu', 'fr', 'es', 'en', 'tr']) {
      const steps = demoSteps(lang, 'seed')
      expect(steps.length, lang).toBeGreaterThanOrEqual(10)
      for (const st of steps) if (st.kind === 'choose') expect(st.options.some((o) => o.id === st.sense.id)).toBe(true)
    }
  })
})
