import type { ContentPack } from '../types'
import { collect, word, type WordInput } from './helpers'

// Macarca, Fransızca, İspanyolca ve Türkçe için küçük temel örnek setleri.
// Her biri 10 kelimelik ÖRNEK içeriktir; tam müfredat değildir. Durum: yapay zekâ taslağı.

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

export const HU_CORE = corePack('hu', 'Macarca — temel örnek içerik', [
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
], 'Macarcada vurgu her zaman ilk hecededir. Yaklaşık söyleyiş yalnızca yardımdır; sesi dinle.')

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

