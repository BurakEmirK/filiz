import type { GlossSource, Lesson, Lexeme, Sense } from './types'

// Açık veriden üretilen sık kelime paketleri (scripts/content/build_content.py çıktısı: public/content/<dil>/).
// Kısa alan adları dosya boyutunu küçültmek içindir.

export interface GenMeaning {
  en: string
  pos: string
  tr?: string | null
  ts?: string | null
  /** 1 = elle gizlendi (yanlış/bozuk anlam; kimlik numaraları değişmesin diye silinmez) */
  h?: number
}

export interface GenWord {
  /** sıklık sırası */
  r: number
  /** sözlük biçimi */
  w: string
  /** sözcük türü */
  p: string
  /** anlamlar (en fazla 3; ilki önce öğretilir) */
  m: GenMeaning[]
  /** çekimli biçimler (cümle içinde tanımak için) */
  f: string[]
  /** Rusça vurgu işaretli yazılış */
  s?: string
  /** harf çevirisi */
  t?: string
  /** IPA */
  i?: string
  /** insan sesi (Wikimedia Commons) */
  a?: { u: string; f: string }
  /** örnek cümle */
  x?: { t: string; tr?: string; en?: string; src: string; trs?: string /* 'mt' | 'fixed' */ }
  /** emoji */
  e?: string
}

export interface GenIndex {
  lang: string
  count: number
  chunks: string[]
  built: string
  stats: Record<string, number>
  pos: Record<string, string>
}

export const LESSON_SIZE = 5
export const UNIT_LESSONS = 10

export function lowerLemma(lemma: string, lang: string): string {
  return lemma.toLocaleLowerCase(lang)
}

export function genKey(lang: string, lemma: string): string {
  return `g:${lang}:${lowerLemma(lemma, lang)}`
}

const GLOSS_SOURCES: GlossSource[] = ['vikisozluk-tr', 'vikisozluk-en', 'pivot-en', 'mt', 'curated']

export const GLOSS_SOURCE_LABEL: Record<GlossSource, string> = {
  'vikisozluk-tr': 'Türkçe Vikisözlük',
  'vikisozluk-en': 'İngilizce Vikisözlük çeviri tablosu',
  'pivot-en': 'İngilizce üzerinden (Vikisözlük)',
  mt: 'makine çevirisi',
  'en-only': 'Türkçesi yok, İngilizce',
  curated: 'elle düzeltildi',
}

/** Paket kelimelerini uygulamanın kelime/anlam/ders yapısına çevirir. Elle hazırlanmış içerikte
 *  zaten bulunan kelimeler atlanır (aynı kelime iki kez öğretilmez). */
export function convertWords(lang: string, index: GenIndex, words: GenWord[], skipLemmas: Set<string>) {
  const lexemes: Lexeme[] = []
  const senses: Sense[] = []
  const firstSenseIds: string[] = []
  /** Elle hazırlanmış içerikte zaten olan kelimeler: ses kaydı ve IPA'ları onlara aktarılır */
  const skipped: GenWord[] = []
  for (const w of [...words].sort((a, b) => a.r - b.r)) {
    const lower = lowerLemma(w.w, lang)
    if (skipLemmas.has(lower)) {
      skipped.push(w)
      continue
    }
    const key = genKey(lang, w.w)
    lexemes.push({ id: key, lang, lemma: w.w, pos: w.p, pronunciation: { stressed: w.s, translit: w.t, ipa: w.i } })
    const forms = [...new Set([lower, ...w.f])]
    w.m.slice(0, 3).forEach((m, i) => {
      if (m.h && i > 0) return
      const posLabel = index.pos[m.pos] ?? m.pos
      const source: GlossSource = m.tr ? (GLOSS_SOURCES.includes(m.ts as GlossSource) ? (m.ts as GlossSource) : 'mt') : 'en-only'
      const sense: Sense = {
        id: `${key}#${i + 1}`,
        lang,
        lexemeId: key,
        conceptId: '',
        senseIndex: i + 1,
        rank: w.r,
        topics: [],
        explanation: `${posLabel} · İngilizce: ${m.en}`,
        examples:
          i === 0 && w.x
            ? [
                {
                  id: `${key}-ex1`,
                  text: w.x.t,
                  tr: w.x.tr ?? w.x.en ?? '',
                  src: w.x.src,
                  trSource: w.x.tr ? (w.x.trs === 'mt' ? 'mt' : w.x.trs === 'fixed' ? 'fixed' : 'human') : 'en-only',
                },
              ]
            : [],
        forms,
        productionPrompt: `"${w.w}" kelimesiyle kendi cümleni yaz.`,
        source: 'Vikisözlük (CC BY-SA) · sıklık: wordfreq (CC BY-SA 4.0)',
        validation: 'open-data',
        customGloss: m.tr || m.en,
        glossEn: m.en,
        glossSource: source,
        audio: w.a ? { url: w.a.u.startsWith('//') ? `https:${w.a.u}` : w.a.u, file: w.a.f } : undefined,
        emoji: i === 0 ? w.e : undefined,
        posLabel,
        generated: true,
      }
      senses.push(sense)
      if (i === 0) firstSenseIds.push(sense.id)
    })
  }
  const lessons: Lesson[] = []
  for (let i = 0; i * LESSON_SIZE < firstSenseIds.length; i++) {
    const ids = firstSenseIds.slice(i * LESSON_SIZE, (i + 1) * LESSON_SIZE)
    const n = i + 1
    lessons.push({
      id: `g-${lang}-${n}`,
      lang,
      title: `Sık kelimeler ${i * LESSON_SIZE + 1}–${i * LESSON_SIZE + ids.length}`,
      track: 'core',
      order: 1000 + n,
      senseIds: ids,
      unit: Math.ceil(n / UNIT_LESSONS),
    })
  }
  return { lexemes, senses, lessons, skipped }
}

export type Fetcher = (path: string) => Promise<unknown>

/** Tarayıcıda içerik dosyalarını uygulamanın kendi adresinden indirir (çevrimdışı önbelleğe alınır). */
export const browserFetcher: Fetcher = async (path) => {
  const res = await fetch(`${import.meta.env.BASE_URL}content/${path}`)
  if (!res.ok) throw new Error(`İçerik indirilemedi: ${path} (${res.status})`)
  return res.json()
}
