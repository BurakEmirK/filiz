// Metin yardımcıları: dile duyarlı normalleştirme, sözcüklere ayırma, mesafe ve fark.

const LOCALE: Record<string, string> = { tr: 'tr', ru: 'ru', hu: 'hu', fr: 'fr', es: 'es', en: 'en' }

/** Karşılaştırma için normalleştirme. Anlamı değiştirebilecek hiçbir şeyi silmez;
 *  yalnızca büyük/küçük harf, boşluk, tırnak/kesme işareti biçimi ve uç noktalama farklarını yok sayar. */
export function normalize(text: string, lang: string): string {
  let s = text.normalize('NFC')
  s = s.replace(/[‘’ʼ`´]/g, "'").replace(/[“”«»]/g, '"')
  s = s.replace(/[  ]/g, ' ')
  if (lang === 'ru') {
    s = stripStress(s) // öğrenme amaçlı vurgu işaretleri
    s = s.replace(/ё/g, 'е').replace(/Ё/g, 'Е')
  }
  s = s.toLocaleLowerCase(LOCALE[lang] ?? lang)
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/^[\s"'¡¿.,!?;:…-]+|[\s"'.,!?;:…-]+$/g, '')
  return s
}

/** Sözcüklere ayırma (Unicode harfleri, kesme işareti ve tire içi korunur). */
export function tokens(text: string, lang: string): string[] {
  const n = normalize(text, lang)
  return n.match(/[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*/gu) ?? []
}

/** Normalleştirilmiş metinde bir biçim (tek veya çok sözcüklü) sözcük sınırlarıyla geçiyor mu? */
export function containsForm(text: string, form: string, lang: string): boolean {
  const t = tokens(text, lang)
  const f = tokens(form, lang)
  if (f.length === 0) return false
  for (let i = 0; i + f.length <= t.length; i++) {
    if (f.every((w, j) => t[i + j] === w)) return true
  }
  // Fransızca "l'eau" gibi bitişik biçimler için kesme işaretinden sonrasını da dene
  if (f.length === 1) return t.some((w) => w.includes("'") && w.split("'").pop() === f[0])
  return false
}

export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 1; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[m][n]
}

export interface DiffPart {
  text: string
  type: 'same' | 'added' | 'removed'
}

/** Kısa metinler için karakter düzeyinde fark (LCS). */
export function charDiff(user: string, correct: string): DiffPart[] {
  const a = [...user]
  const b = [...correct]
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out: DiffPart[] = []
  const push = (text: string, type: DiffPart['type']) => {
    const last = out[out.length - 1]
    if (last && last.type === type) last.text += text
    else out.push({ text, type })
  }
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(a[i], 'same')
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push(a[i++], 'removed')
    else push(b[j++], 'added')
  }
  while (i < a.length) push(a[i++], 'removed')
  while (j < b.length) push(b[j++], 'added')
  return out
}

export function hasCyrillic(text: string): boolean {
  return /[Ѐ-ӿ]/.test(text)
}

/** Yalnızca Kiril harflerinin üzerindeki öğrenme amaçlı vurgu işaretini (´) siler.
 *  Macarca, İspanyolca, Fransızca gibi dillerin aksanlı harflerine (á, é, ő...) dokunmaz. */
export function stripStress(text: string): string {
  return text.normalize('NFD').replace(/([Ѐ-ӿ])́/g, '$1').normalize('NFC')
}
