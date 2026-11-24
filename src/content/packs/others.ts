import type { ContentPack, Lexeme, Sense } from '../types'
import { collect, phrase, situationLessons, tatoeba, word, type PhraseInput, type WordInput } from './helpers'

// Macarca, Fransızca, İspanyolca ve Türkçe için küçük temel örnek setleri.
// Her biri 10 kelimelik ÖRNEK içeriktir; tam müfredat değildir. Macarcada ayrıca durumlara dayalı başlangıç yolu var
// (HU_SITUATIONS). Durum: yapay zekâ taslağı.

type Row = [concept: string, lemma: string, approx: string, explanation: string, example: string, exampleTr: string, forms: string[], grammar?: Record<string, string>]

const TOPIC: Record<string, string> = {
  apple: 'food', water: 'food', bread: 'food', milk: 'food', book: 'home', house: 'home', cat: 'animals', dog: 'animals', hello: 'greetings', thanks: 'greetings',
}
const POS: Record<string, WordInput['pos']> = { hello: 'interj', thanks: 'interj' }

function corePack(lang: string, title: string, rows: Row[], approxNote?: string): ContentPack {
  const items = rows.map(([concept, lemma, approx, explanation, ex, exTr, forms, grammar]) =>
    word({
      id: `${lang}-${concept}`, lang, concept, lemma, pos: POS[concept] ?? 'noun', grammar,
      pron: approx ? { approx, note: approxNote } : undefined,
      level: 'A1', topics: [TOPIC[concept]], explanation, examples: [[ex, exTr]], forms,
      prompt: concept === 'hello' ? 'Birini selamlayan kısa bir cümle yaz.'
        : concept === 'thanks' ? 'Birine bir şey için teşekkür eden bir cümle yaz.'
        : `"${lemma}" kelimesiyle kendi cümleni yaz.`,
    }),
  )
  const { lexemes, senses } = collect(items)
  const id = (c: string) => `${lang}-${c}`
  return {
    id: `${lang}-core`, lang, version: 1, title, status: 'sample', lexemes, senses,
    lessons: [
      { id: `${lang}-core-1`, lang, title: 'Yiyecek ve içecek', track: 'core', order: 1, senseIds: ['apple', 'water', 'bread', 'milk'].map(id) },
      { id: `${lang}-core-2`, lang, title: 'Ev ve hayvanlar', track: 'core', order: 2, senseIds: ['house', 'book', 'cat', 'dog'].map(id) },
      { id: `${lang}-core-3`, lang, title: 'Selamlaşma ve teşekkür', track: 'core', order: 3, senseIds: ['hello', 'thanks'].map(id) },
    ],
  }
}

/** Bir temel pakete durumlara dayalı başlangıç yolunu ekler (mevcut derslerin hemen ardından). */
function withSituations(pack: ContentPack, items: { lexeme?: Lexeme; sense: Sense }[]): ContentPack {
  const { lexemes, senses } = collect(items)
  const next = Math.max(...pack.lessons.map((l) => l.order)) + 1
  return {
    ...pack,
    lexemes: [...pack.lexemes, ...lexemes],
    senses: [...pack.senses, ...senses],
    lessons: [...pack.lessons, ...situationLessons(pack.lang, next, senses)],
  }
}

const HU_NOTE = 'Macarcada vurgu her zaman ilk hecededir. Yaklaşık söyleyiş yalnızca yardımdır; sesi dinle.'
const HU = (x: Omit<PhraseInput, 'lang'>) => phrase({ ...x, lang: 'hu', pron: x.pron ? { note: HU_NOTE, ...x.pron } : undefined })
const HU_FORMAL = 'Resmî "ön" (siz) biçimi; arkadaşa "te" biçimi kullanılır.'

// Durumlara dayalı başlangıç yolu (hu-core-4 … hu-core-8). Örnek cümleler Tatoeba'dan.
const HU_SITUATIONS = [
  // Selamlaşma ve tanışma
  HU({ situation: 'greetings', concept: 'good-morning', lemma: 'jó reggelt', pron: { approx: 'yoo reggelt' },
    explanation: 'Sabah selamı. Gün içinde "Jó napot!" (iyi günler), akşam "Jó estét!" denir. "j" = Türkçe "y".',
    example: ['Jó reggelt! Hogy van?', 'Günaydın, nasılsınız?', tatoeba(3174058)],
    prompt: 'Sabah iş arkadaşlarını selamlayan kısa bir cümle yaz.' }),
  HU({ situation: 'greetings', concept: 'my-name-is', lemma: 'a nevem', pron: { approx: 'o nevem' },
    explanation: 'Kendini tanıtırken: "A nevem Anna" = "Benim adım Anna". "-m" eki "benim" anlamı katar (név → nevem).',
    example: ['A nevem Sally.', 'Benim adım Sally.', tatoeba(3275796)],
    prompt: 'Adını söyleyerek kendini tanıtan bir cümle yaz.' }),
  HU({ situation: 'greetings', concept: 'nice-to-meet-you', lemma: 'örvendek', pron: { approx: 'örvendek' },
    explanation: 'Biriyle tanışınca: "Memnun oldum." Daha uzun biçimi: "Örülök, hogy megismerhetem."',
    example: ['Örvendek.', 'Memnun oldum.', tatoeba(4266179, 'mt')],
    prompt: 'Yeni tanıştığın birine memnun olduğunu söyleyen bir cümle yaz.' }),
  HU({ situation: 'greetings', concept: 'how-are-you', lemma: 'hogy vagy', pron: { approx: 'hoc voc ("gy" yumuşak bir "c" gibi)' },
    explanation: 'Samimi "Nasılsın?" Resmî biçimi: "Hogy van?" (Nasılsınız?).',
    example: ['Hogy vagy ma?', 'Bugün nasılsın?', tatoeba(3495917)],
    forms: ['hogy vagy', 'hogy vagytok'],
    prompt: 'Bir arkadaşına nasıl olduğunu soran bir cümle yaz.' }),
  HU({ situation: 'greetings', concept: 'goodbye', lemma: 'viszontlátásra', pron: { approx: 'visontlaataaşro' },
    explanation: 'Resmî vedalaşma: "Görüşmek üzere, hoşça kalın." Arkadaşlar arasında "Viszlát!" veya "Szia!" denir.',
    example: ['Viszontlátásra!', 'Görüşmek üzere!', tatoeba(738253, 'mt')],
    prompt: 'Bir dükkândan çıkarken vedalaşan kısa bir cümle yaz.' }),

  // Kafede ve markette
  HU({ situation: 'shopping', concept: 'how-much', lemma: 'mennyibe kerül', pron: { approx: 'menyibe kerül' },
    explanation: 'Fiyat sorarken: "Mennyibe kerül …?" = "… ne kadar?" "ny" = "ny" (yumuşak n).',
    example: ['Mennyibe kerül az újság?', 'Gazete ne kadar?', tatoeba(6736582)],
    forms: ['mennyibe kerül', 'mennyibe kerülnek'],
    prompt: 'Markette bir ürünün fiyatını soran bir cümle yaz.' }),
  HU({ situation: 'shopping', concept: 'i-would-like', lemma: 'kérek egy', pron: { approx: 'keerek ec' },
    explanation: '"Bir … istiyorum." İstenen şey belirtme hali eki alır: kávé → kávét, víz → vizet.',
    example: ['Kérek egy kávét.', 'Bir kahve istiyorum.', tatoeba(13939573, 'mt')],
    prompt: 'Kafede bir şey isteyen bir cümle yaz.' }),
  HU({ situation: 'shopping', concept: 'may-i-have', lemma: 'kaphatnék', pron: { approx: 'kophotneek' },
    explanation: 'Çok kibar istek: "Kaphatnék …?" = "… alabilir miyim?" Sonuna "kérem" (lütfen) eklenebilir.',
    example: ['Kaphatnék még egy kávét, kérem?', 'Bir kahve daha alabilir miyim, lütfen.', tatoeba(8104290)],
    prompt: 'Kafede kibarca bir şey isteyen bir soru yaz.' }),
  HU({ situation: 'shopping', concept: 'can-i-pay-by-card', lemma: 'fizethetek kártyával', pron: { approx: 'fizethetek kaartyaavol' },
    explanation: '"Kartla ödeyebilir miyim?" Nakit: "készpénzzel".',
    example: ['Fizethetek kártyával?', 'Kartla ödeyebilir miyim?', tatoeba(3301250, 'mt')],
    prompt: 'Kasada kartla ödeyip ödeyemeyeceğini soran bir cümle yaz.' }),
  HU({ situation: 'shopping', concept: 'the-bill-please', lemma: 'a számlát kérem', pron: { approx: 'o saamlaat keerem' },
    explanation: 'Restoranda hesabı isterken. "Kérem a számlát" sırası da doğrudur. "sz" = Türkçe "s".',
    example: ['A számlát kérem!', 'Hesap, lütfen!', tatoeba(4574016, 'mt')],
    forms: ['a számlát kérem', 'kérem a számlát'],
    prompt: 'Kafede hesabı isteyen kısa bir cümle yaz.' }),

  // Yol sorma
  HU({ situation: 'directions', concept: 'where-is', lemma: 'hol van', pron: { approx: 'hol von' },
    explanation: 'Bir yerin nerede olduğunu sorarken: "Hol van …?" = "… nerede?" Seslenirken: "Elnézést" (affedersiniz).',
    example: ['Elnézést, hol van a könyvtár?', 'Affedersiniz, kütüphane nerede?', tatoeba(3309366, 'fixed')],
    forms: ['hol van', 'hol vannak'],
    prompt: 'Bir binanın nerede olduğunu soran bir cümle yaz.' }),
  HU({ situation: 'directions', concept: 'is-it-far', lemma: 'messze van', pron: { approx: 'messe von' },
    explanation: '"Uzak mı?" diye sorarken soru tonuyla söylenir. "Közel van" = yakın.',
    example: ['Messze van innen?', 'Buradan uzak mı?', tatoeba(583933, 'mt')],
    prompt: 'Bir yerin uzak olup olmadığını soran bir cümle yaz.' }),
  HU({ situation: 'directions', concept: 'go-straight', lemma: 'menjen egyenesen', pron: { approx: 'menyen ecenesen' },
    explanation: 'Yol tarifi: "Düz gidin." Arkadaşa "Menj egyenesen".',
    example: ['Menjen egyenesen.', 'Düz gidin.', tatoeba(9574850, 'mt')],
    forms: ['menjen egyenesen', 'menj egyenesen'],
    usageNote: HU_FORMAL,
    prompt: 'Birine düz gitmesini söyleyen bir yol tarifi yaz.' }),
  HU({ situation: 'directions', concept: 'turn-right', lemma: 'forduljon jobbra', pron: { approx: 'forduyon yobbro' },
    explanation: 'Yol tarifi: "Sağa dönün." "Jobbra" = sağa, "balra" = sola.',
    example: ['Forduljon jobbra!', 'Sağa dönün!', tatoeba(9061338, 'mt')],
    forms: ['forduljon jobbra', 'fordulj jobbra'],
    usageNote: HU_FORMAL,
    prompt: 'Birine köşeden sağa dönmesini söyleyen bir cümle yaz.' }),
  HU({ situation: 'directions', concept: 'turn-left', lemma: 'forduljon balra', pron: { approx: 'forduyon bolro' },
    explanation: 'Yol tarifi: "Sola dönün." "Balra" = sola, "jobbra" = sağa.',
    example: ['Forduljon balra.', 'Sola dönün.', tatoeba(9574841, 'mt')],
    forms: ['forduljon balra', 'fordulj balra'],
    usageNote: HU_FORMAL,
    prompt: 'Birine ışıklardan sola dönmesini söyleyen bir cümle yaz.' }),

  // Sayılar ve saat
  HU({ situation: 'time', concept: 'what-time-is-it', lemma: 'hány óra van', pron: { approx: 'haany ooro von' },
    explanation: 'Saati sorarken: "Saat kaç?" Cevap: "Két óra van" (Saat iki).',
    example: ['Hány óra van?', 'Saat kaç?', tatoeba(583975)],
    prompt: 'Birine saati soran bir cümle yaz.' }),
  HU({ situation: 'time', concept: 'at-seven-oclock', lemma: 'hét órakor', pron: { approx: 'heet oorokor' },
    explanation: 'Saat yedide. "-kor" eki "saat …-de" demektir: két órakor = saat ikide.',
    example: ['Hét órakor felhívlak.', 'Ben seni saat 7\'de arayacağım.', tatoeba(3465647)],
    prompt: 'İşin kaçta başladığını söyleyen bir cümle yaz.' }),
  HU({ situation: 'time', concept: 'ten-minutes', lemma: 'tíz perc', pron: { approx: 'tiiz perts' },
    explanation: 'On dakika. Sayıdan sonra isim tekil kalır: tíz perc (on dakika), öt perc (beş dakika).',
    example: ['Tíz percet várt.', 'On dakika bekledi.', tatoeba(4165560, 'mt')],
    forms: ['tíz perc', 'tíz percet', 'tíz percig', 'tíz perce'],
    prompt: 'Birkaç dakika beklediğini söyleyen bir cümle yaz.' }),
  HU({ situation: 'time', concept: 'ask-phone-number', lemma: 'mi a telefonszámod', pron: { approx: 'mi o telefonsaamod' },
    explanation: 'Samimi soru: "Telefon numaran ne?" Resmî: "Mi a telefonszáma?"',
    example: ['Mi a telefonszámod?', 'Telefon numaran ne?', tatoeba(1414427, 'mt')],
    forms: ['mi a telefonszámod', 'mi a telefonszáma'],
    prompt: 'Birinin telefon numarasını soran bir cümle yaz.' }),
  HU({ situation: 'time', concept: 'how-old-are-you', lemma: 'hány éves vagy', pron: { approx: 'haany eeveş voc' },
    explanation: 'Yaş sorarken: "Kaç yaşındasın?" Cevap: "Harminc éves vagyok" (Otuz yaşındayım). "s" = Türkçe "ş".',
    example: ['Hány éves vagy?', 'Kaç yaşındasın?', tatoeba(585378)],
    prompt: 'Kendi yaşını söyleyen bir cümle yaz.' }),

  // İş yerinde (tekstil bağlamı)
  HU({ situation: 'work', concept: 'i-work-in-factory', lemma: 'gyárban dolgozom', pron: { approx: 'caarbon dolgozom' },
    explanation: '"Fabrikada çalışıyorum." Tekstil fabrikası: "textilgyár". "-ban" eki "içinde" demektir.',
    example: ['Egy gyárban dolgozom.', 'Bir fabrikada çalışıyorum.', tatoeba(6962765, 'mt')],
    forms: ['gyárban dolgozom', 'gyárban dolgozik', 'gyárban dolgozunk', 'gyárban dolgozott'],
    prompt: 'Nerede çalıştığını anlatan bir cümle yaz.' }),
  HU({ situation: 'work', concept: 'dont-understand', lemma: 'nem értem', pron: { approx: 'nem eertem' },
    explanation: 'Anlamadığını söylerken: "Anlamıyorum." Kibarca: "Elnézést, nem értem."',
    example: ['Nem értem a kérdést.', 'Soruyu anlamıyorum.', tatoeba(4849184)],
    prompt: 'Bir talimatı anlamadığını söyleyen bir cümle yaz.' }),
  HU({ situation: 'work', concept: 'repeat-please', lemma: 'megismételné', pron: { approx: 'megişmeetelnee' },
    explanation: 'Kibarca tekrar isterken: "Tekrar eder misiniz?" Arkadaşa: "Megismételnéd?"',
    example: ['Megismételné?', 'Tekrar eder misiniz?', tatoeba(5848014, 'mt')],
    forms: ['megismételné', 'megismételnéd'],
    usageNote: HU_FORMAL,
    prompt: 'Toplantıda bir şeyi kaçırdığında tekrar isteyen bir cümle yaz.' }),
  HU({ situation: 'work', concept: 'a-bit-slower', lemma: 'kicsit lassabban', pron: { approx: 'kiçit loşşobbon' },
    explanation: '"Biraz daha yavaş." Konuşma için: "Kérem, beszéljen kicsit lassabban" (Lütfen biraz daha yavaş konuşun).',
    example: ['Kérem, beszéljen kicsit lassabban.', 'Lütfen biraz daha yavaş konuşun.', tatoeba(2393370)],
    prompt: 'Birinden daha yavaş konuşmasını isteyen kibar bir cümle yaz.' }),
]

export const HU_CORE = withSituations(corePack('hu', 'Macarca — temel örnek içerik', [
  ['apple', 'alma', 'olma (a yuvarlak)', 'Elma.', 'Ez egy piros alma.', 'Bu kırmızı bir elma.', ['alma', 'almát', 'almák', 'almákat', 'almával', 'almából', 'almája']],
  ['water', 'víz', 'viiz', 'Su. Ek alınca kısalır: víz → vizet.', 'Kérek egy pohár vizet.', 'Bir bardak su istiyorum.', ['víz', 'vizet', 'vize', 'vízzel', 'vízben', 'vizek', 'vízből']],
  ['bread', 'kenyér', 'kenyeer', 'Ekmek. Belirtme hali: kenyeret.', 'Friss kenyeret veszek.', 'Taze ekmek alıyorum.', ['kenyér', 'kenyeret', 'kenyérrel', 'kenyerek', 'kenyérből', 'kenyere']],
  ['milk', 'tej', 'tey', 'Süt.', 'Szeretem a tejet.', 'Sütü severim.', ['tej', 'tejet', 'tejjel', 'tejben', 'tejből']],
  ['book', 'könyv', 'könyv', 'Kitap.', 'Ez a könyv érdekes.', 'Bu kitap ilginç.', ['könyv', 'könyvet', 'könyvek', 'könyvben', 'könyvvel', 'könyvem']],
  ['house', 'ház', 'haaz', 'Ev (bina).', 'A ház nagy.', 'Ev büyük.', ['ház', 'házat', 'házak', 'házban', 'házba', 'háza', 'házam']],
  ['cat', 'macska', 'moçko (a\'lar yuvarlak)', 'Kedi. "cs" = Türkçe "ç".', 'A macska alszik.', 'Kedi uyuyor.', ['macska', 'macskát', 'macskák', 'macskával', 'macskám']],
  ['dog', 'kutya', 'kutyo', 'Köpek.', 'Van egy kutyám.', 'Bir köpeğim var.', ['kutya', 'kutyát', 'kutyák', 'kutyám', 'kutyával']],
  ['hello', 'szia', 'siyo', 'Samimi selamlaşma: selam (hem gelişte hem gidişte). "sz" = Türkçe "s".', 'Szia! Hogy vagy?', 'Selam! Nasılsın?', ['szia', 'sziasztok']],
  ['thanks', 'köszönöm', 'kösönöm', 'Teşekkür ederim.', 'Köszönöm a segítséget!', 'Yardımın için teşekkür ederim!', ['köszönöm', 'köszi']],
], HU_NOTE), HU_SITUATIONS)

export const FR_CORE = corePack('fr', 'Fransızca — temel örnek içerik', [
  ['apple', 'pomme', 'pom', 'Elma (dişil: une pomme).', 'Je mange une pomme.', 'Bir elma yiyorum.', ['pomme', 'pommes'], { cinsiyet: 'dişil' }],
  ['water', 'eau', 'o', 'Su (dişil: l\'eau).', 'Je bois de l\'eau.', 'Su içiyorum.', ['eau', 'eaux', "l'eau", "d'eau", "de l'eau"], { cinsiyet: 'dişil' }],
  ['bread', 'pain', 'pen (genizden)', 'Ekmek (eril: le pain).', 'J\'achète du pain.', 'Ekmek alıyorum.', ['pain', 'pains'], { cinsiyet: 'eril' }],
  ['milk', 'lait', 'le', 'Süt (eril: le lait).', 'J\'aime le lait.', 'Sütü severim.', ['lait', 'laits'], { cinsiyet: 'eril' }],
  ['book', 'livre', 'livr', 'Kitap (eril: le livre). Dişil "la livre" ise "pound/yarım kilo" demektir.', 'Ce livre est intéressant.', 'Bu kitap ilginç.', ['livre', 'livres'], { cinsiyet: 'eril' }],
  ['house', 'maison', 'mezon', 'Ev (dişil: la maison).', 'La maison est grande.', 'Ev büyük.', ['maison', 'maisons'], { cinsiyet: 'dişil' }],
  ['cat', 'chat', 'şa', 'Kedi (eril: le chat).', 'Le chat dort.', 'Kedi uyuyor.', ['chat', 'chats', 'chatte', 'chattes'], { cinsiyet: 'eril' }],
  ['dog', 'chien', 'şiyen (genizden)', 'Köpek (eril: le chien).', 'J\'ai un chien.', 'Bir köpeğim var.', ['chien', 'chiens', 'chienne', 'chiennes'], { cinsiyet: 'eril' }],
  ['hello', 'bonjour', 'bonjur', 'Merhaba, iyi günler (gün içinde, resmî ve samimi).', 'Bonjour ! Comment allez-vous ?', 'Merhaba! Nasılsınız?', ['bonjour']],
  ['thanks', 'merci', 'mersi', 'Teşekkürler.', 'Merci pour ton aide !', 'Yardımın için teşekkürler!', ['merci']],
], 'Fransızcada kelime sonundaki harflerin çoğu okunmaz. Genizden sesler için sesi dinle.')

export const ES_CORE = corePack('es', 'İspanyolca — temel örnek içerik', [
  ['apple', 'manzana', 'mansana / manthana', 'Elma (dişil: la manzana). "z" İspanya\'da peltek, Latin Amerika\'da "s" gibi.', 'Como una manzana.', 'Bir elma yiyorum.', ['manzana', 'manzanas'], { cinsiyet: 'dişil' }],
  ['water', 'agua', 'agua', 'Su. Dişildir ama "el agua" denir (vurgulu a ile başladığı için).', 'Bebo agua.', 'Su içiyorum.', ['agua', 'aguas'], { cinsiyet: 'dişil' }],
  ['bread', 'pan', 'pan', 'Ekmek (eril: el pan).', 'Compro pan.', 'Ekmek alıyorum.', ['pan', 'panes'], { cinsiyet: 'eril' }],
  ['milk', 'leche', 'leçe', 'Süt (dişil: la leche).', 'Me gusta la leche.', 'Sütü severim.', ['leche', 'leches'], { cinsiyet: 'dişil' }],
  ['book', 'libro', 'libro', 'Kitap (eril: el libro).', 'Este libro es interesante.', 'Bu kitap ilginç.', ['libro', 'libros'], { cinsiyet: 'eril' }],
  ['house', 'casa', 'kasa', 'Ev (dişil: la casa).', 'La casa es grande.', 'Ev büyük.', ['casa', 'casas'], { cinsiyet: 'dişil' }],
  ['cat', 'gato', 'gato', 'Kedi (eril: el gato).', 'El gato duerme.', 'Kedi uyuyor.', ['gato', 'gatos', 'gata', 'gatas'], { cinsiyet: 'eril' }],
  ['dog', 'perro', 'perro (titreşimli r)', 'Köpek (eril: el perro).', 'Tengo un perro.', 'Bir köpeğim var.', ['perro', 'perros', 'perra', 'perras'], { cinsiyet: 'eril' }],
  ['hello', 'hola', 'ola', 'Merhaba. "h" okunmaz.', '¡Hola! ¿Qué tal?', 'Merhaba! Nasılsın?', ['hola']],
  ['thanks', 'gracias', 'grasyas / grathias', 'Teşekkürler.', '¡Gracias por tu ayuda!', 'Yardımın için teşekkürler!', ['gracias']],
])

export const TR_CORE = corePack('tr', 'Türkçe — temel örnek içerik', [
  ['apple', 'elma', '', 'Elma (meyve).', 'Her gün bir elma yerim.', 'I eat an apple every day.', ['elma', 'elmayı', 'elmalar', 'elmanın', 'elmaya', 'elmam']],
  ['water', 'su', '', 'Su.', 'Bir bardak su içiyorum.', 'I am drinking a glass of water.', ['su', 'suyu', 'sular', 'suyun', 'suya', 'suyum']],
  ['bread', 'ekmek', '', 'Ekmek.', 'Taze ekmek alıyorum.', 'I am buying fresh bread.', ['ekmek', 'ekmeği', 'ekmekler', 'ekmeğin', 'ekmeğe']],
  ['milk', 'süt', '', 'Süt.', 'Sütü severim.', 'I like milk.', ['süt', 'sütü', 'sütler', 'sütün', 'süte']],
  ['book', 'kitap', '', 'Kitap. Ünlüyle başlayan ek alınca p → b olur: kitabı.', 'Bu kitap ilginç.', 'This book is interesting.', ['kitap', 'kitabı', 'kitaplar', 'kitabın', 'kitaba', 'kitabım']],
  ['house', 'ev', '', 'Ev.', 'Ev büyük.', 'The house is big.', ['ev', 'evi', 'evler', 'evin', 'eve', 'evde', 'evim']],
  ['cat', 'kedi', '', 'Kedi.', 'Kedi uyuyor.', 'The cat is sleeping.', ['kedi', 'kediyi', 'kediler', 'kedinin', 'kediye', 'kedim']],
  ['dog', 'köpek', '', 'Köpek. Ünlüyle başlayan ek alınca k → ğ olur: köpeği.', 'Bir köpeğim var.', 'I have a dog.', ['köpek', 'köpeği', 'köpekler', 'köpeğin', 'köpeğe', 'köpeğim']],
  ['hello', 'merhaba', '', 'Merhaba.', 'Merhaba! Nasılsın?', 'Hello! How are you?', ['merhaba']],
  ['thanks', 'teşekkürler', '', 'Teşekkürler.', 'Yardımın için teşekkürler!', 'Thank you for your help!', ['teşekkürler', 'teşekkür']],
])

