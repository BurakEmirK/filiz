// Dil bilgileri. Yeni bir hedef dil eklemek için buraya bir kayıt ve packs/ altına bir paket eklemek yeterlidir.

export interface LetterNote {
  letters: string
  note: string
}

export interface LanguageInfo {
  code: string
  nameTr: string
  nativeName: string
  script: 'Latin' | 'Cyrillic'
  /** Konuşma sentezi (TTS) için BCP-47 kodu */
  ttsLang: string
  /** iPadOS Scribble (Apple Pencil ile yazıyı metne çevirme) bu dili destekliyor mu?
   *  Kaynak: apple.com/ios/feature-availability (Kasım 2026'da kontrol edildi). */
  scribble: boolean
  /** Bu dilde sunulabilen telaffuz yardımları */
  aids: ('stress' | 'translit' | 'approx' | 'letterNotes')[]
  letterNotes?: LetterNote[]
  /** Değerlendirmede metin karşılaştırma için dile özgü normalleştirme notu */
  normalizationNote?: string
}

export const LANGUAGES: LanguageInfo[] = [
  {
    code: 'ru',
    nameTr: 'Rusça',
    nativeName: 'Русский',
    script: 'Cyrillic',
    ttsLang: 'ru-RU',
    scribble: true,
    aids: ['stress', 'translit', 'approx'],
    normalizationNote: 'ё ile е eşdeğer kabul edilir; vurgu işaretleri karşılaştırmada yok sayılır.',
  },
  {
    code: 'hu',
    nameTr: 'Macarca',
    nativeName: 'Magyar',
    script: 'Latin',
    ttsLang: 'hu-HU',
    scribble: false,
    aids: ['approx', 'letterNotes'],
    letterNotes: [
      { letters: 's', note: 'Türkçe "ş" gibi: sajt → "şayt"' },
      { letters: 'sz', note: 'Türkçe "s" gibi: szia → "siya"' },
      { letters: 'cs', note: 'Türkçe "ç" gibi: csak → "çak"' },
      { letters: 'zs', note: 'Türkçe "j" gibi: zsák → "jaak"' },
      { letters: 'c', note: '"ts" gibi: cukor → "tsukor"' },
      { letters: 'gy', note: 'Türkçe "gâvur" kelimesindeki ince g\'ye yakın' },
      { letters: 'ty', note: 'Türkçe "kâr" kelimesindeki ince k\'ye yakın' },
      { letters: 'ny', note: '"kanyon"daki "ny" gibi tek ses' },
      { letters: 'j, ly', note: 'Türkçe "y" gibi' },
      { letters: 'a', note: 'Kısa a dudaklar hafif yuvarlak, "o"ya yakın söylenir' },
      { letters: 'á é í ó ú ő ű', note: 'Üstündeki işaret uzun ünlü demektir; á açık ve uzun "aa"' },
      { letters: 'ö ü', note: 'Türkçedeki ö ve ü ile aynı; ő ve ű bunların uzunudur' },
      { letters: 'Vurgu', note: 'Her zaman kelimenin ilk hecesinde' },
    ],
  },
  {
    code: 'fr',
    nameTr: 'Fransızca',
    nativeName: 'Français',
    script: 'Latin',
    ttsLang: 'fr-FR',
    scribble: true,
    aids: ['approx'],
  },
  {
    code: 'es',
    nameTr: 'İspanyolca',
    nativeName: 'Español',
    script: 'Latin',
    ttsLang: 'es-ES',
    scribble: true,
    aids: ['approx'],
  },
  {
    code: 'en',
    nameTr: 'İngilizce',
    nativeName: 'English',
    script: 'Latin',
    ttsLang: 'en-GB',
    scribble: true,
    aids: ['approx'],
  },
  {
    code: 'tr',
    nameTr: 'Türkçe',
    nativeName: 'Türkçe',
    script: 'Latin',
    ttsLang: 'tr-TR',
    scribble: true,
    aids: [],
  },
]

export function getLanguage(code: string): LanguageInfo {
  const found = LANGUAGES.find((l) => l.code === code)
  if (!found) throw new Error(`Bilinmeyen dil: ${code}`)
  return found
}
