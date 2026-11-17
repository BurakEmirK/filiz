// İçerik şeması. İçerik (kelimeler, anlamlar, dersler) uygulama koduyla birlikte gelir ve
// salt okunurdur; kullanıcı verisi (ilerleme, cevaplar) ayrı tutulur (src/domain/types.ts).
// Yeni dil, sektör veya içerik eklemek = yeni bir paket dosyası eklemek; çekirdek kod değişmez.

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

/** İçeriğin doğruluk durumu. Hiçbir içerik uzman onayı olmadan "uzman onaylı" sayılmaz. */
export type ValidationStatus =
  | 'ai-draft' // Yapay zekâ taslağı; uzman doğrulaması yok
  | 'self-checked' // Proje sahibi kontrol etti
  | 'expert-reviewed' // Bir uzman / anadili konuşuru onayladı

export type ImageNeed = 'concrete' | 'scene' | 'situation' | 'none'

/** Bir anlamın "anlam çapası": görsel ve kısa açıklama dile göre değil anlama bağlıdır. */
export interface Concept {
  id: string
  gloss: { tr: string; en: string }
  imageNeed: ImageNeed
  /** Görsel varlık kimliği (assets içinde). imageNeed 'none' ise boş olabilir. */
  imageId?: string
}

export type AssetStatus = 'original-illustration' | 'licensed-photo' | 'placeholder' | 'missing'

export interface MediaAsset {
  id: string
  kind: 'illustration' | 'photo'
  /** Bu görselin gösterdiği anlamlar (kavram kimlikleri). Eşleşme testi bunu denetler. */
  conceptIds: string[]
  /** Çizim anahtarı (src/ui/illustrations.tsx) veya foto yolu */
  render: string
  alt: string
  author: string
  license: string
  source: string
  status: AssetStatus
}

export interface Example {
  id: string
  text: string
  tr: string
  level: Cefr
}

export interface Pronunciation {
  /** Vurgu işaretli yazım (ör. Rusça "молоко́") */
  stressed?: string
  /** Harf çevirisi (transliterasyon): harfleri Latin'e çevirir, söyleyişi değil */
  translit?: string
  /** Yaklaşık söyleniş, Türkçe okuyucu için. Gerçek söyleyiş için ses esas alınır. */
  approx?: string
  ipa?: string
  note?: string
}

export interface Lexeme {
  id: string
  lang: string
  lemma: string
  pos: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase' | 'interj' | 'noun-phrase'
  /** Dilbilgisel özellikler: cinsiyet, çoğul, fiil görünüşü vb. (dile özgü) */
  grammar?: Record<string, string>
  pronunciation?: Pronunciation
}

export interface Sense {
  id: string
  lang: string
  lexemeId: string
  conceptId: string
  /** 1 = önce öğretilen yaygın anlam. Diğer anlamlar sonra eklenir. */
  senseIndex: number
  level: Cefr
  topics: string[]
  industry?: string
  subtopic?: string
  /** Anlama özgü Türkçe açıklama */
  explanation: string
  examples: Example[]
  /** Cümle içinde hedef kelimeyi tanımak için kabul edilen biçimler (çekimler) */
  forms: string[]
  collocations?: string[]
  synonyms?: { text: string; note: string }[]
  antonyms?: string[]
  usageNote?: string
  morphology?: string
  /** Üretim alıştırması için Türkçe yönerge */
  productionPrompt: string
  source: string
  validation: ValidationStatus
  /** Kullanıcının kendi eklediği ifadeler için anlam (kavram yerine) */
  customGloss?: string
}

export interface TaskSpec {
  id: string
  lang: string
  title: string
  /** Türkçe görev yönergesi */
  prompt: string
  /** Görevin istediği anlam (değerlendirmede "görev anlamı" ekseni buna bakar) */
  requiredMeaning: string
  targetSenseIds: string[]
  mode: 'constrained' | 'free'
  /** Birden fazla geçerli örnek cevap (karşılaştırma için tek referans değildir) */
  sampleAnswers?: string[]
  industry?: string
  subtopic?: string
}

export interface Lesson {
  id: string
  lang: string
  title: string
  track: 'core' | 'industry'
  industry?: string
  subtopic?: string
  order: number
  senseIds: string[]
  taskIds?: string[]
}

export interface ContentPack {
  id: string
  lang: string
  version: number
  title: string
  status: 'sample' | 'full'
  lexemes: Lexeme[]
  senses: Sense[]
  lessons: Lesson[]
  tasks?: TaskSpec[]
}
