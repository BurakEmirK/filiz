import type { Lesson, Lexeme, Sense } from './types'

// "Sesler ve Harfler": bir dile sıfırdan başlayanlar için alfabe ve okuma kuralları.
// Açıklamalar Türkçe konuşan biri için yazıldı; "yaklaşık" karşılıklardır, gerçek ses için kayıt dinlenmeli.
// Durum: yapay zekâ taslağı, uzman doğrulaması yok.

export interface SoundItem {
  id: string
  /** Gösterilecek harf(ler) veya kural adı */
  letters: string
  /** Kısa ses açıklaması (alıştırmada doğru cevap) */
  sound: string
  note?: string
  /** Örnek kelimeler (hedef dilde) */
  examples: string[]
  /** iPad'de kalemle yazma alıştırması önerilsin mi (Kiril harfleri) */
  trace?: boolean
}

export interface SoundGroup {
  id: string
  title: string
  intro: string
  items: SoundItem[]
}

export interface SoundModule {
  lang: string
  intro: string
  groups: SoundGroup[]
}

const L = (id: string, letters: string, sound: string, examples: string[], note?: string, trace?: boolean): SoundItem => ({ id, letters, sound, examples, note, trace })

export const SOUND_MODULES: SoundModule[] = [
  {
    lang: 'ru',
    intro: 'Rusça Kiril alfabesiyle yazılır: 33 harf. Bazı harfler Latin harflerine benzer ama farklı okunur. Gruplar halinde ilerleyelim.',
    groups: [
      {
        id: 'familiar', title: 'Tanıdık ve aynı okunan harfler', intro: 'Bu harfler hem görünüş hem ses olarak tanıdık.',
        items: [
          L('a', 'А а', 'a', ['да', 'мама'], undefined, true),
          L('k', 'К к', 'k', ['как', 'кот'], undefined, true),
          L('m', 'М м', 'm', ['мы', 'мама'], undefined, true),
          L('o', 'О о', 'o (vurgusuzsa a gibi)', ['он', 'окно'], 'окно "akno" diye okunur: ilk o vurgusuz.', true),
          L('t', 'Т т', 't', ['так', 'тут'], undefined, true),
          L('e', 'Е е', 'ye / e', ['нет', 'есть'], 'Kelime başında "ye"; ünsüzden sonra "e" ve önceki ünsüzü inceltir.', true),
        ],
      },
      {
        id: 'false-friends', title: 'Dikkat: tanıdık görünüp farklı okunanlar', intro: 'En çok karışan harfler bunlar. Latin harfine benziyorlar ama başka ses veriyorlar.',
        items: [
          L('v', 'В в', 'v', ['вот', 'вода'], 'Latin B\'ye benzer ama "v" okunur.', true),
          L('n', 'Н н', 'n', ['нет', 'нос'], 'Latin H\'ye benzer ama "n" okunur.', true),
          L('r', 'Р р', 'r (dil ucu titrer)', ['рука', 'брат'], 'Latin P\'ye benzer ama "r" okunur.', true),
          L('s', 'С с', 's', ['сам', 'сок'], 'Latin C\'ye benzer ama "s" okunur.', true),
          L('u', 'У у', 'u', ['у', 'утро'], 'Latin y\'ye benzer ama "u" okunur.', true),
          L('h', 'Х х', 'h (gırtlaktan, hırıltılı)', ['хорошо', 'хлеб'], 'Latin X\'e benzer; Türkçe h\'den daha sert.', true),
        ],
      },
      {
        id: 'new1', title: 'Yeni harfler', intro: 'Görünüşü yeni ama sesi Türkçede de olan harfler.',
        items: [
          L('b', 'Б б', 'b', ['быть', 'брат'], undefined, true),
          L('g', 'Г г', 'g', ['год', 'город'], undefined, true),
          L('d', 'Д д', 'd', ['да', 'дом'], undefined, true),
          L('z', 'З з', 'z', ['знать', 'зима'], undefined, true),
          L('i', 'И и', 'i', ['и', 'мир'], undefined, true),
          L('y', 'Й й', 'y (kısa i)', ['мой', 'край'], undefined, true),
          L('l', 'Л л', 'l', ['стол', 'люди'], undefined, true),
          L('p', 'П п', 'p', ['потом', 'папа'], undefined, true),
          L('f', 'Ф ф', 'f', ['фото', 'факт'], undefined, true),
        ],
      },
      {
        id: 'hissing', title: 'Islıklı sesler', intro: 'Türkçede karşılığı olan ama harfi farklı sesler.',
        items: [
          L('zh', 'Ж ж', 'j (jüri\'deki gibi)', ['жизнь', 'жена'], undefined, true),
          L('sh', 'Ш ш', 'ş', ['шаг', 'школа'], undefined, true),
          L('shch', 'Щ щ', 'uzun ve yumuşak ş (şş)', ['ещё', 'борщ'], undefined, true),
          L('ts', 'Ц ц', 'ts', ['отец', 'улица'], undefined, true),
          L('ch', 'Ч ч', 'ç (yumuşak)', ['час', 'чай'], 'Dikkat: что kelimesi istisnadır, "şto" okunur.', true),
        ],
      },
      {
        id: 'vowels', title: 'Ünlüler ve işaretler', intro: 'Türkçede tam karşılığı olmayan ünlüler ve sesi olmayan iki işaret.',
        items: [
          L('y-hard', 'Ы ы', 'ı\'ya yakın (dil geride)', ['мы', 'ты'], undefined, true),
          L('e-open', 'Э э', 'e', ['это', 'этаж'], undefined, true),
          L('yu', 'Ю ю', 'yu', ['люблю', 'юг'], undefined, true),
          L('ya', 'Я я', 'ya', ['я', 'моя'], undefined, true),
          L('yo', 'Ё ё', 'yo (her zaman vurgulu)', ['всё', 'ёлка'], 'Metinlerde çoğu zaman noktasız "е" olarak yazılır.', true),
          L('soft', 'Ь ь', 'yumuşatma işareti (sesi yok)', ['день', 'мать'], 'Önceki ünsüzü inceltir.', true),
          L('hard', 'Ъ ъ', 'sertlik işareti (sesi yok)', ['объём', 'съесть'], 'Ünsüzü sonraki ünlüden ayırır.', true),
        ],
      },
      {
        id: 'rules', title: 'Okuma kuralları', intro: 'Rusçada yazılış ile okunuş arasında birkaç önemli kural var.',
        items: [
          L('stress', 'Vurgu', 'her kelimede tek vurgulu hece', ['за́мок', 'замо́к'], 'Vurgu yeri anlamı değiştirebilir: за́мок "şato", замо́к "kilit". Ders kitaplarında ´ ile gösterilir.'),
          L('akanye', 'Vurgusuz о', 'a gibi okunur', ['молоко', 'хорошо'], 'молоко "malakó" diye okunur.'),
          L('ikanye', 'Vurgusuz е / я', 'i\'ye yakın okunur', ['река', 'язык'], 'язык "yizık" diye okunur.'),
          L('devoicing', 'Sonda sertleşme', 'sondaki б→p, в→f, г→k, д→t, ж→ş, з→s', ['хлеб', 'город'], 'хлеб "hlyep", город "górat" diye okunur.'),
        ],
      },
    ],
  },
  {
    lang: 'hu',
    intro: 'Macarca Latin alfabesiyle yazılır ama bazı harf birleşimleri tek bir ses verir. Türkçe bilmek büyük avantaj: ö, ü ve ünlü uyumu tanıdık.',
    groups: [
      {
        id: 'vowels', title: 'Ünlüler: kısa ve uzun', intro: 'Üstündeki işaret ünlünün uzun okunacağını gösterir. Uzunluk anlamı değiştirir: kerek (yuvarlak) – kérek (rica ederim).',
        items: [
          L('a', 'a', 'kısa, dudaklar hafif yuvarlak (o\'ya yakın)', ['alma', 'nap']),
          L('aa', 'á', 'uzun, açık a (aa)', ['ház', 'már']),
          L('e', 'e', 'kısa, açık e', ['ember', 'kert']),
          L('ee', 'é', 'uzun, kapalı e (ee)', ['kérek', 'szép']),
          L('i', 'i / í', 'i ve uzun ii', ['ki', 'víz']),
          L('o', 'o / ó', 'o ve uzun oo', ['bor', 'jó']),
          L('oe', 'ö / ő', 'Türkçe ö ve uzun öö', ['öt', 'nő']),
          L('u', 'u / ú', 'u ve uzun uu', ['mutat', 'út']),
          L('ue', 'ü / ű', 'Türkçe ü ve uzun üü', ['fül', 'tű']),
        ],
      },
      {
        id: 'consonants', title: 'Türkçeden farklı yazılan ünsüzler', intro: 'En önemli fark: Macarcada "s" Türkçe ş, "sz" Türkçe s demektir.',
        items: [
          L('s', 's', 'Türkçe ş', ['is', 'és']),
          L('sz', 'sz', 'Türkçe s', ['szó', 'szia']),
          L('cs', 'cs', 'Türkçe ç', ['csak', 'kocsi']),
          L('zs', 'zs', 'Türkçe j', ['zseb', 'zsák']),
          L('c', 'c', 'ts', ['cukor', 'utca']),
          L('dzs', 'dzs', 'Türkçe c', ['dzsem', 'dzsungel']),
        ],
      },
      {
        id: 'palatal', title: 'Yumuşak ünsüzler ve "y" sesi', intro: 'Bu harf ikilileri tek bir ses verir.',
        items: [
          L('gy', 'gy', 'yumuşak g ("gâvur"daki g\'ye yakın)', ['egy', 'magyar']),
          L('ty', 'ty', 'yumuşak t ("kâr"daki k\'ye yakın)', ['kutya', 'tyúk']),
          L('ny', 'ny', 'tek ses ny ("kanyon"daki gibi)', ['nyár', 'anya']),
          L('j', 'j / ly', 'ikisi de Türkçe y', ['jó', 'hely']),
        ],
      },
      {
        id: 'rules', title: 'Okuma kuralları', intro: 'Birkaç kural doğru okumanın çoğunu sağlar.',
        items: [
          L('stress', 'Vurgu', 'her zaman ilk hecede', ['köszönöm', 'magyar']),
          L('harmony', 'Ünlü uyumu', 'ekler kalın/ince ünlüye uyar', ['házban', 'kertben'], 'Türkçeye benzer: házban (evde) – kertben (bahçede).'),
          L('double', 'Çift ünsüz', 'çift yazılan ünsüz uzun okunur', ['hall', 'hal'], 'hall "duyar", hal "balık".'),
        ],
      },
    ],
  },
  {
    lang: 'fr',
    intro: 'Fransızcada yazılan harflerin bir kısmı okunmaz ve bazı harf grupları tek ses verir. Kuralları bilince okumak kolaylaşır.',
    groups: [
      {
        id: 'silent', title: 'Okunmayan harfler', intro: 'Fransızcada en çok şaşırtan şey okunmayan harflerdir.',
        items: [
          L('final-cons', 'Sondaki ünsüzler', 'çoğu okunmaz', ['petit', 'vous'], 'c, r, f, l sonda çoğu zaman okunur (avec, finir).'),
          L('final-e', 'Sondaki e', 'okunmaz', ['table', 'porte']),
          L('h', 'h', 'hiç okunmaz', ['homme', 'heure']),
        ],
      },
      {
        id: 'vowels', title: 'Ünlü birleşimleri', intro: 'İki-üç harf bir araya gelince tek bir ünlü okunur.',
        items: [
          L('ou', 'ou', 'Türkçe u', ['vous', 'tout']),
          L('u', 'u', 'Türkçe ü', ['tu', 'rue']),
          L('oi', 'oi', 'ua', ['moi', 'trois']),
          L('au', 'au / eau', 'o', ['eau', 'aussi']),
          L('ai', 'ai / ei', 'açık e', ['lait', 'neige']),
          L('eu', 'eu / œu', 'ö', ['deux', 'sœur']),
          L('e-acc', 'é / è / ê', 'é kapalı e; è ve ê açık e', ['été', 'mère']),
        ],
      },
      {
        id: 'nasal', title: 'Genizden ünlüler', intro: 'n veya m okunmaz; ünlü burundan söylenir.',
        items: [
          L('an', 'an / en', 'genizden a', ['enfant', 'dans']),
          L('on', 'on', 'genizden o', ['bon', 'nom']),
          L('in', 'in / ain / un', 'genizden e\'ye yakın', ['vin', 'pain']),
        ],
      },
      {
        id: 'consonants', title: 'Ünsüzler', intro: 'Türkçeden farklı okunan ünsüzler.',
        items: [
          L('ch', 'ch', 'ş', ['chat', 'chose']),
          L('j', 'j / ge / gi', 'j', ['je', 'rouge']),
          L('gn', 'gn', 'ny', ['montagne', 'gagner']),
          L('qu', 'qu', 'k', ['qui', 'quand']),
          L('c', 'c / ç', 'a, o, u önünde k; e, i önünde ve ç ile s', ['ça', 'ceci']),
          L('r', 'r', 'gırtlaktan, ğ\'ye yakın sürtünmeli ses', ['rue', 'rouge']),
          L('s', 's (iki ünlü arası)', 'z', ['maison', 'rose']),
        ],
      },
      {
        id: 'rules', title: 'Bağlama ve vurgu', intro: 'Kelimeler cümlede birbirine bağlanır.',
        items: [
          L('liaison', 'Bağlama (liaison)', 'okunmayan son ünsüz, ünlüyle başlayan kelimeye bağlanır', ['les', 'amis'], 'les amis "lezami" diye okunur.'),
          L('stress', 'Vurgu', 'sözcük grubunun son hecesinde, hafif', ['bonjour', 'merci']),
        ],
      },
    ],
  },
  {
    lang: 'es',
    intro: 'İspanyolca büyük ölçüde yazıldığı gibi okunur. Birkaç harfi ve vurgu kuralını öğrenince her kelimeyi okuyabilirsin.',
    groups: [
      {
        id: 'vowels', title: 'Ünlüler', intro: 'Beş ünlü var ve her zaman net okunur.',
        items: [L('vowels', 'a e i o u', 'Türkçedeki gibi açık ve net; uzunluk farkı yok', ['casa', 'libro'])],
      },
      {
        id: 'letters', title: 'Farklı okunan harfler', intro: 'Türkçeden farklı okunan harfler.',
        items: [
          L('ny', 'ñ', 'ny', ['año', 'mañana']),
          L('j', 'j', 'gırtlaktan h (Türkçe h\'den sert)', ['jamón', 'joven']),
          L('g', 'g (e, i önünde)', 'gırtlaktan h', ['gente', 'general']),
          L('gu', 'gue / gui', 'ge / gi (u okunmaz)', ['guerra', 'seguir']),
          L('ll', 'll / y', 'y (bölgeye göre j\'ye yakın)', ['llamar', 'yo']),
          L('h', 'h', 'okunmaz', ['hola', 'hacer']),
          L('cz', 'c / z', 'e, i önünde c ve z: İspanya\'da peltek (th), Latin Amerika\'da s', ['cinco', 'zapato']),
          L('qu', 'qu', 'k (u okunmaz)', ['que', 'queso']),
          L('ch', 'ch', 'ç', ['mucho', 'noche']),
          L('vb', 'v / b', 'ikisi de b\'ye yakın', ['vino', 'vaso']),
          L('r', 'r / rr', 'tek r hafif dokunuş; rr ve kelime başında r titrek', ['pero', 'perro']),
        ],
      },
      {
        id: 'rules', title: 'Vurgu ve işaretler', intro: 'Vurguyu yazıdan bulmak mümkün.',
        items: [
          L('stress', 'Vurgu kuralı', 'ünlü, n, s ile bitiyorsa sondan ikinci hece; değilse son hece', ['casa', 'café'], 'Kurala uymayan kelimeler ´ ile yazılır (café, inglés).'),
          L('marks', '¿ ? ¡ !', 'soru ve ünlem cümleleri ters işaretle başlar', ['qué', 'hola']),
        ],
      },
    ],
  },
  {
    lang: 'en',
    intro: 'İngilizcede yazılış ile okunuş arasında çok fark var. Bu bölüm en önemli sesleri ve Türkçe konuşanların sık hatalarını gösterir.',
    groups: [
      {
        id: 'spelling', title: 'Yazılış ve okunuş', intro: 'Aynı harf farklı kelimelerde farklı okunabilir.',
        items: [
          L('a', 'a', 'cat (e), name (ey), car (aa), about (ı)', ['cat', 'name']),
          L('silent-e', 'Sondaki e', 'okunmaz ama önceki ünlüyü uzatır', ['hat', 'hate']),
        ],
      },
      {
        id: 'new-sounds', title: 'Türkçede olmayan sesler', intro: 'Bu sesler için ağız ve dil pozisyonu önemli.',
        items: [
          L('th-voiceless', 'th (think)', 'dil ucu dişler arasında; s değil', ['think', 'three']),
          L('th-voiced', 'th (this)', 'dil ucu dişler arasında; z değil', ['this', 'the']),
          L('w', 'w', 'dudaklar yuvarlak; v değil', ['we', 'water']),
          L('schwa', 'ə (schwa)', 'vurgusuz hecede kısa, belirsiz ı', ['about', 'banana']),
        ],
      },
      {
        id: 'length', title: 'Kısa ve uzun ünlüler', intro: 'Ünlünün uzunluğu anlamı değiştirir.',
        items: [
          L('i-ee', 'i / ee', 'kısa i – uzun ii', ['ship', 'sheep']),
          L('u-oo', 'u / oo', 'kısa u – uzun uu', ['full', 'fool']),
        ],
      },
      {
        id: 'stress', title: 'Vurgu ve sık hatalar', intro: 'Vurgu ve Türkçe konuşanların sık yaptığı hatalar.',
        items: [
          L('stress', 'Vurgu', 'vurgu yeri anlamı değiştirebilir', ['record', 'present'], 'REcord "kayıt", reCORD "kaydetmek".'),
          L('mistakes', 'Sık hatalar', 'w/v karıştırma, th\'yi s/z yapma, son ünsüzü yutma', ['very', 'worked']),
        ],
      },
    ],
  },
  {
    lang: 'tr',
    intro: 'Türkçe yazıldığı gibi okunur. Bu bölüm Türkçeyi yeni öğrenen arkadaşların içindir (Turkish sounds for new learners).',
    groups: [
      {
        id: 'letters', title: 'Özel harfler (special letters)', intro: 'Diğer dillerde olmayan harfler.',
        items: [
          L('i-dotless', 'ı', 'dil geride, dudaklar düz (≈ İng. "about"taki ə)', ['ışık', 'kız']),
          L('g-soft', 'ğ', 'kendi başına okunmaz, önceki ünlüyü uzatır', ['dağ', 'soğuk']),
          L('oe-ue', 'ö / ü', 'dudaklar yuvarlak ince ünlüler (≈ Alm. ö / ü)', ['göz', 'üç']),
          L('c-s', 'ç / ş', 'ç = İng. ch, ş = İng. sh', ['çay', 'şimdi']),
          L('c-j', 'c / j', 'c = İng. j (cam), j = Fr. j', ['cam', 'jeton']),
        ],
      },
      {
        id: 'rules', title: 'Kurallar (rules)', intro: 'Ünlü uyumu ve vurgu.',
        items: [
          L('harmony', 'Ünlü uyumu', 'ekler kalın/ince ünlüye uyar (vowel harmony)', ['evler', 'kızlar']),
          L('stress', 'Vurgu', 'çoğunlukla son hecede (usually last syllable)', ['kitap', 'merhaba']),
        ],
      },
    ],
  },
]

export function soundModule(lang: string): SoundModule | undefined {
  return SOUND_MODULES.find((m) => m.lang === lang)
}

export function soundSenseId(lang: string, itemId: string) {
  return `snd:${lang}:${itemId}`
}

export function isSoundSense(id: string) {
  return id.startsWith('snd:')
}

/** Ses öğelerini, mevcut alıştırma altyapısının kullanabileceği anlam/ders kayıtlarına çevirir. */
export function soundContent() {
  const lexemes: Lexeme[] = []
  const senses: Sense[] = []
  const lessons: Lesson[] = []
  for (const mod of SOUND_MODULES) {
    mod.groups.forEach((g, gi) => {
      const ids: string[] = []
      for (const it of g.items) {
        const id = soundSenseId(mod.lang, it.id)
        lexemes.push({ id: `snd-lx:${mod.lang}:${it.id}`, lang: mod.lang, lemma: it.letters, pos: 'letter' })
        senses.push({
          id,
          lang: mod.lang,
          lexemeId: `snd-lx:${mod.lang}:${it.id}`,
          conceptId: '',
          senseIndex: 1,
          topics: ['sounds'],
          explanation: it.note ?? '',
          examples: it.examples.map((x, i) => ({ id: `${id}-ex${i + 1}`, text: x, tr: '' })),
          forms: [it.letters],
          productionPrompt: '',
          source: 'Filiz (Sesler ve Harfler)',
          validation: 'ai-draft',
          customGloss: it.sound,
        })
        ids.push(id)
      }
      lessons.push({ id: `snd-${mod.lang}-${g.id}`, lang: mod.lang, title: g.title, track: 'sounds', order: gi + 1, senseIds: ids })
    })
  }
  return { lexemes, senses, lessons }
}

export function soundItem(senseId: string): { mod: SoundModule; group: SoundGroup; item: SoundItem } | undefined {
  const [, lang, itemId] = senseId.split(':')
  const mod = soundModule(lang)
  if (!mod) return undefined
  for (const group of mod.groups) {
    const item = group.items.find((i) => i.id === itemId)
    if (item) return { mod, group, item }
  }
  return undefined
}
