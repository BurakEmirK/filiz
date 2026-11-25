#!/usr/bin/env python3
"""Filiz içerik hattı: her dil için en sık kullanılan >= 3000 kelime (sözlük biçimi).

Kaynaklar (hepsi açık lisanslı; bkz. public/content/SOURCES.md):
  - Sıklık: wordfreq (Robyn Speer ve ark.), CC BY-SA 4.0
  - Sözlük biçimi, anlamlar, çekimler, IPA, ses dosyası adresleri: İngilizce Vikisözlük (Wiktextract / kaikki.org), CC BY-SA
  - Türkçe anlamlar: Türkçe Vikisözlük (Wiktextract), İngilizce Vikisözlük çeviri tabloları; yoksa Argos Translate (makine çevirisi)
  - Örnek cümleler: Tatoeba, CC BY 2.0 FR (yoksa Vikisözlük örnekleri)
  - Emoji adları: emojibase-data (MIT, Unicode CLDR verisine dayanır)

Çalıştırma (data-raw/ altında indirilmiş verilerle):
  PYTHONUTF8=1 python scripts/content/build_content.py
"""
from __future__ import annotations

import bz2
import gzip
import json
import math
import os
import re
import sys
import tempfile
import time
import unicodedata
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from overrides import BLACKLIST, KEEP_FORMS, OVERRIDES  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data-raw'
OUT = ROOT / 'public' / 'content'
LANGS = ['ru', 'hu', 'fr', 'es', 'en', 'tr']
TATOEBA = {'ru': 'rus', 'hu': 'hun', 'fr': 'fra', 'es': 'spa', 'en': 'eng', 'tr': 'tur'}
TARGET = 3000
KEEP = 3400  # emniyet payı: sonradan elenenler için
SURFACE_LIMIT = 90000
CHUNK = 500

ALLOWED_POS = {
    'noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'conj', 'det', 'num', 'particle', 'intj', 'article',
    'postp', 'contraction', 'phrase', 'prep_phrase', 'adv_phrase',
}
POS_TR = {
    'noun': 'isim', 'verb': 'fiil', 'adj': 'sıfat', 'adv': 'zarf', 'pron': 'zamir', 'prep': 'edat', 'conj': 'bağlaç',
    'det': 'belirleyici', 'num': 'sayı', 'particle': 'parçacık', 'intj': 'ünlem', 'article': 'tanımlık', 'postp': 'edat',
    'contraction': 'kısaltılmış biçim', 'phrase': 'kalıp', 'prep_phrase': 'edat öbeği', 'adv_phrase': 'zarf öbeği',
}
BAD_TAGS = {'vulgar', 'offensive', 'derogatory', 'slur', 'ethnic', 'obscene'}
WEAK_TAGS = {'obsolete', 'archaic', 'dated', 'rare', 'nonstandard', 'misspelling', 'proscribed', 'historical'}
# Bu etiketli "biçimidir" ilişkileri çekim sayılmaz (kısaltma, eski yazım, lehçe vb.)
WEAK_FORM_TAGS = WEAK_TAGS | {
    'dialectal', 'eye-dialect', 'pronunciation-spelling', 'abbreviation', 'initialism', 'acronym', 'informal',
    'colloquial', 'slang', 'Internet', 'alternative', 'clipping', 'contraction',
}
# Kelimenin biçim listesine (f) alınmayan biçimler, Vikisözlük etiketlerine göre: "alternative form" girişleri,
# eski yazımlar, ağız biçimleri, standart dışı yazımlar, yazım hataları, kısaltmalar ve Roma rakamları.
# Örnek: "one" ve "first" için "I" (Roma rakamı), "my" için "me", "they" için "the", "of" için "a".
# Aynı biçim tabloda bir kez eski/ağız, bir kez olağan etiketle geçebilir (İng. "were"); olağan geçişi yeterlidir.
# Bu süzme yalnızca biçim listesini ve örnek cümle seçimini etkiler. Sıralama süzülmemiş biçimlerle yapılır;
# böylece kelime sırası, ders ve anlam kimlikleri değişmez.
# Rusçada devrim öncesi yazımlar (собакъ, собакѣ) "dated" etiketlidir. "informal" süzülmez: İspanyolca ve Macarcada
# senli (tú) çekimleri bu etiketi taşır. "multiword-construction": bileşik zamanların yardımcı fiili (être → "ayant").
DROP_FORM_TAGS = {
    'alternative', 'alt-of', 'obsolete', 'archaic', 'dated', 'historical', 'pre-reform', 'superseded',
    'dialectal', 'eye-dialect', 'pronunciation-spelling', 'nonstandard', 'proscribed', 'misspelling',
    'hypercorrect', 'misconstruction', 'colloquial', 'slang', 'Internet',
    'abbreviation', 'initialism', 'acronym', 'clipping', 'Roman', 'roman', 'multiword-construction',
}
# Bölge etiketli "alternative" yazım, başka bir sorun etiketi yoksa standarttır (İng. centre, programme)
STANDARD_REGION_TAGS = {'UK', 'US', 'British', 'American', 'Commonwealth', 'Canada', 'Australia', 'New-Zealand'}
# Etiket yerine serbest metin (raw_tags) olarak gelenler
DROP_FORM_RAW = re.compile(r'obsolete|archaic|dated|pre-reform|pre-1918|dialect|nonstandard|misspell|roman numeral|abbreviat')
FUNCTION_POS = {'pron', 'det', 'article', 'prep', 'postp', 'conj', 'contraction'}
LETTER_GLOSS = re.compile(r'(name of the .*letter|letter of the .*alphabet|^the letter )', re.I)
NO_TR_POS = {'name', 'character', 'letter', 'symbol', 'abbrev', 'suffix', 'prefix', 'infix', 'affix', 'romanization'}
SELF_WEIGHT = 0.05  # kendisi de kelime olan biçimin kendi payı (ör. "как")
META_FORM_TAGS = {'table-tags', 'inflection-template', 'class', 'romanization', 'canonical', 'error-unrecognized-form'}

WORD_RE = {
    'ru': re.compile(r"^[а-яё]+(?:-[а-яё]+)*$"),
    'default': re.compile(r"^[^\W\d_]+(?:['’-][^\W\d_]+)*$"),
}


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def strip_stress(s: str) -> str:
    return unicodedata.normalize('NFC', re.sub(r'([Ѐ-ӿ])[́̀]', r'\1', unicodedata.normalize('NFD', s)))


def norm(s: str, lang: str) -> str:
    s = strip_stress(s.strip())
    if lang == 'tr':
        s = s.replace('I', 'ı').replace('İ', 'i')
    s = s.lower()
    if lang == 'ru':
        s = s.replace('ё', 'е')
    return s.replace('’', "'")


def valid(word: str, lang: str) -> bool:
    return bool((WORD_RE.get(lang) or WORD_RE['default']).match(word))


def fold(s: str) -> str:
    """Aksan ve bitişik harf farkını yok sayar: cœur = coeur, connaître = connaitre, événement = évènement."""
    s = s.replace('œ', 'oe').replace('æ', 'ae')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c))


def form_kept(fm: dict, nf: str, nw: str, lang: str) -> bool:
    """Vikisözlük biçim kaydı (forms[] öğesi) `nw` kelimesinin biçim listesine girer mi? Bkz. DROP_FORM_TAGS.

    Üç istisna: KEEP_FORMS'taki standart çeşitler (Rusça в → во, Macarca nincs → nincsen), yalnızca aksan ya da
    bitişik harf farkı olan "alternative" yazımlar (cœur → coeur) ve İngiliz/Amerikan yazımları (center → centre)."""
    tags = set(fm.get('tags') or [])
    raw = ' '.join(fm.get('raw_tags') or []).lower()
    bad = tags & DROP_FORM_TAGS
    if not bad and not DROP_FORM_RAW.search(raw):
        return True
    if nf in KEEP_FORMS.get(lang, {}).get(nw, ()):
        return True
    if bad != {'alternative'} or raw:
        return False
    return fold(nf) == fold(nw) or bool(tags & STANDARD_REGION_TAGS)


# ---------------------------------------------------------------- 1. Sıklık
def load_frequencies():
    from wordfreq import get_frequency_dict

    surfaces = {}
    for lang in LANGS:
        d = get_frequency_dict(lang, wordlist='best')
        items = sorted(d.items(), key=lambda kv: -kv[1])
        out = {}
        for w, f in items:
            nw = norm(w, lang)
            if not valid(nw, lang):
                continue
            out[nw] = out.get(nw, 0.0) + f
            if len(out) >= SURFACE_LIMIT:
                break
        surfaces[lang] = out
        log(f'sıklık {lang}: {len(out)} biçim')
    return surfaces


# ---------------------------------------------------------------- 2. Vikisözlük (İngilizce)
def first_gloss(sense):
    g = sense.get('glosses') or sense.get('raw_glosses') or []
    return g[-1].strip() if g else ''


def scan_enwiktionary(surfaces):
    """Tek geçişte: çekim→sözlük biçimi eşlemesi, aday kelime bilgileri, İngilizce→Türkçe çeviriler.

    İki eşleme döner: `formmap` sıralama içindir (tüm biçimler; değiştirilmedi, kelime sırası korunur),
    `exmap` örnek cümle seçimi içindir (süzülmüş biçimler; bkz. DROP_FORM_TAGS)."""
    lemma_entries = {l: defaultdict(list) for l in LANGS}
    formmap = {l: defaultdict(set) for l in LANGS}
    exmap = {l: defaultdict(set) for l in LANGS}
    en_tr = defaultdict(list)  # İngilizce kelime -> [(pos, sense, tr_word)]
    needles = [f'"lang_code": "{l}"' for l in LANGS]
    path = RAW / 'kaikki' / 'en-raw.jsonl.gz'
    n = parsed = 0
    with gzip.open(path, 'rt', encoding='utf-8') as fh:
        for line in fh:
            n += 1
            if n % 1_000_000 == 0:
                log(f'  vikisözlük: {n:,} satır, {parsed:,} çözümlendi')
            if not any(x in line for x in needles):
                continue
            o = json.loads(line)
            lang = o.get('lang_code')
            if lang not in surfaces:
                continue
            parsed += 1
            word = o.get('word') or ''
            nw = norm(word, lang)
            surf = surfaces[lang]
            senses = o.get('senses') or []
            pos = o.get('pos') or ''
            # Çekim girişleri: "воду, вода'nın biçimidir". Kısaltma/eski yazım/lehçe ilişkileri alınmaz.
            fo_all = [
                (fo.get('word'), set(s.get('tags') or [])) for s in senses
                for fo in (s.get('form_of') or []) if fo.get('word')
            ]
            fo_targets = [t for t, st in fo_all if not st & WEAK_FORM_TAGS]  # sıralama için (değişmedi)
            fo_ex = [t for t, st in fo_all if not st & (WEAK_FORM_TAGS | DROP_FORM_TAGS)]  # örnek seçimi için
            lemma_senses = [
                s for s in senses
                if not s.get('form_of') and not s.get('alt_of') and not ({'form-of', 'alt-of'} & set(s.get('tags') or []))
                and not LETTER_GLOSS.search(first_gloss(s))
            ]
            if fo_targets and nw in surf:
                for t in fo_targets:
                    formmap[lang][nw].add(norm(t, lang))
                for t in fo_ex:
                    exmap[lang][nw].add(norm(t, lang))
            # Büyük harfli girişler (kısaltma, özel ad) alınmaz; İngilizce "I" hariç
            if word != word.lower() and not (lang == 'en' and word == 'I'):
                continue
            # Anlamlarının çoğu "biçimidir" olan girişler sözlük biçimi sayılmaz (ör. İngilizce "was")
            if not lemma_senses or len(lemma_senses) * 2 < len(senses) or nw not in surf:
                continue
            forms, canonical, roman = [], None, None
            for fm in o.get('forms') or []:
                ft = fm.get('form') or ''
                tags = set(fm.get('tags') or [])
                if 'canonical' in tags and not canonical:
                    canonical = ft
                if 'romanization' in tags and not roman:
                    roman = ft
                if tags & META_FORM_TAGS or not ft or ' ' in ft:
                    continue
                nf = norm(ft, lang)
                if valid(nf, lang):
                    kept = form_kept(fm, nf, nw, lang)
                    if kept:
                        forms.append(nf)
                    if nf in surf and nf != nw:
                        formmap[lang][nf].add(nw)
                        if kept:
                            exmap[lang][nf].add(nw)
            ipa = next((s['ipa'] for s in o.get('sounds') or [] if s.get('ipa')), None)
            audio = [
                {'u': s['mp3_url'], 'f': s.get('audio') or '', 't': s.get('tags') or []}
                for s in o.get('sounds') or [] if s.get('mp3_url')
            ][:6]
            glosses = []
            tagset = set()
            for s in lemma_senses:
                st = set(s.get('tags') or [])
                tagset |= st
                g = first_gloss(s)
                if g:
                    glosses.append({'g': g[:160], 'weak': bool(st & WEAK_TAGS), 'bad': bool(st & BAD_TAGS)})
            examples = []
            for s in lemma_senses[:3]:
                for ex in s.get('examples') or []:
                    if ex.get('text') and (ex.get('english') or ex.get('translation')) and len(ex['text']) < 120:
                        examples.append({'t': ex['text'], 'en': ex.get('english') or ex.get('translation')})
                        break
            rec = {
                'pos': pos, 'gl': glosses[:6], 'tags': sorted(tagset & (BAD_TAGS | {'proper-noun'})),
                'forms': forms[:120], 'can': canonical, 'rom': roman, 'ipa': ipa, 'au': audio, 'ex': examples[:2],
                'word': word,
            }
            lemma_entries[lang][nw].append(rec)
            if lang == 'en':
                for t in o.get('translations') or []:
                    if t.get('lang_code') == 'tr' and t.get('word') and 'obsolete' not in (t.get('tags') or []):
                        en_tr[nw].append((pos, t.get('sense') or '', t['word']))
    log(f'vikisözlük bitti: {n:,} satır, {parsed:,} çözümlendi')
    return lemma_entries, formmap, exmap, en_tr


# ---------------------------------------------------------------- 3. Türkçe Vikisözlük
def scan_trwiktionary():
    """(dil, kelime) → [(sözcük türü, Türkçe anlam)] ve Türkçe Vikisözlük'teki ses kayıtları."""
    tr = defaultdict(list)
    audio = {}
    with gzip.open(RAW / 'kaikki' / 'tr-wikt.jsonl.gz', 'rt', encoding='utf-8') as fh:
        for line in fh:
            o = json.loads(line)
            lang = o.get('lang_code')
            if lang not in LANGS:
                continue
            word = o.get('word') or ''
            if word != word.lower():
                continue
            key = (lang, norm(word, lang))
            pos = o.get('pos') or ''
            if key not in audio:
                snd = next((s for s in o.get('sounds') or [] if s.get('mp3_url')), None)
                if snd:
                    audio[key] = {'u': snd['mp3_url'], 'f': snd.get('audio') or '', 't': snd.get('tags') or []}
            if pos in NO_TR_POS:
                continue
            for s in o.get('senses') or []:
                if s.get('form_of') or s.get('alt_of'):
                    continue
                g = first_gloss(s)
                if g and not g.startswith('{{') and len(g) < 200 and not LETTER_GLOSS.search(g) and 'soyad' not in g.lower():
                    tr[key].append((pos, g))
    log(f'türkçe vikisözlük: {len(tr):,} kelime, {len(audio):,} ses kaydı')
    return tr, audio


# ---------------------------------------------------------------- 3b. Dilin kendi Vikisözlüğündeki ses kayıtları
# İngilizce Vikisözlük'te kaydı az olan diller için (ör. İspanyolca: kaikki.org/eswiktionary).
EXTRA_AUDIO = {'es': RAW / 'eswikt' / 'es-wikt.jsonl.gz'}


def pick_audio(sounds):
    """Kayıtlar arasından seçim: önce İspanya etiketli, sonra etiketsiz, sonra diğerleri (yalnızca mp3'ü olanlar)."""
    def rank(s):
        tags = (s.get('tags') or []) + (s.get('raw_tags') or [])
        return 0 if 'Spain' in tags else 1 if not tags else 2
    cands = [s for s in sounds or [] if s.get('mp3_url')]
    if not cands:
        return None
    best = min(cands, key=rank)  # min, eşitlikte ilk geleni korur
    return {'u': best['mp3_url'], 'f': best.get('audio') or ''}


def scan_wikt_audio(path, lang):
    """Bir Vikisözlük dökümünden (Wiktextract) `lang` dilindeki kelimelerin ses kayıtları: kelime → {'u', 'f'}."""
    found = defaultdict(list)
    needle = f'"lang_code": "{lang}"'
    with gzip.open(path, 'rt', encoding='utf-8') as fh:
        for line in fh:
            if needle not in line or 'mp3_url' not in line:
                continue
            o = json.loads(line)
            if o.get('lang_code') != lang:
                continue
            found[norm(o.get('word') or '', lang)] += o.get('sounds') or []
    out = {k: a for k, v in found.items() if (a := pick_audio(v))}
    log(f'{lang} vikisözlük ses kayıtları: {len(out):,} kelime')
    return out


# ---------------------------------------------------------------- 4. Sıralama
def rank_lemmas(lang, surfaces, lemma_entries, formmap):
    surf = surfaces[lang]
    entries = lemma_entries[lang]

    def eligible(key):
        recs = [r for r in entries.get(key, []) if r['pos'] in ALLOWED_POS and r['gl']]
        if not recs:
            return False
        # İlk anlamı küfür/hakaret olan kelimeler alınmaz; argo yan anlamlar yalnızca atlanır
        if recs[0]['gl'][0]['bad']:
            return False
        good = [g for r in recs for g in r['gl'] if not g['weak'] and not g['bad']]
        return bool(good)

    cands = {}
    for s, f in surf.items():
        c = set()
        if s in entries:
            c.add(s)
        c |= {x for x in formmap[lang].get(s, ()) if x in entries}
        c = {x for x in c if eligible(x)}
        if c:
            cands[s] = (f, c)
    # Belirsiz biçimlerin sıklığı, adayların başka (belirsiz olmayan) biçimlerinden gelen kanıtla paylaştırılır.
    # Biçim kendisi de bir kelimeyse (ör. "как"), kendi sıklığının küçük bir payı o kelimeye kanıt sayılır.
    base = Counter()
    for s, (f, c) in cands.items():
        if len(c) == 1:
            base[next(iter(c))] += f
    score = Counter()
    for s, (f, c) in cands.items():
        if len(c) == 1:
            score[next(iter(c))] += f
        else:
            w = {x: base[x] + (SELF_WEIGHT * f if x == s else 0.0) + 1e-12 for x in c}
            tot = sum(w.values())
            for x in c:
                score[x] += f * w[x] / tot
    ranked = [k for k, _ in score.most_common(KEEP)]
    log(f'sıralama {lang}: {len(score):,} aday sözlük biçimi, ilk {len(ranked)} alındı')
    return ranked, score


# ---------------------------------------------------------------- 5. Makine çevirisi (Argos modeli, ctranslate2 ile)
class MT:
    def __init__(self):
        import ctranslate2
        import sentencepiece as spm

        d = Path(tempfile.gettempdir()) / 'fz-argos'
        if not (d / 'ok').exists():
            d.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(RAW / 'argos' / 'en_tr.argosmodel') as z:
                z.extractall(d)
            (d / 'ok').write_text('1')
        model = next(p.parent for p in d.rglob('model.bin'))
        spm_path = next(d.rglob('sentencepiece.model'))
        self.tr = ctranslate2.Translator(str(model), device='cpu', compute_type='int8')
        self.sp = spm.SentencePieceProcessor(model_file=str(spm_path))
        self.cache = {}

    def translate(self, texts):
        """Tam cümleler için. Tekrarı önleyen ayarlarla (kısa girdilerde model kelimeyi tekrarlayabiliyor)."""
        todo = [t for t in dict.fromkeys(texts) if t not in self.cache]
        for i in range(0, len(todo), 64):
            batch = todo[i:i + 64]
            toks = [self.sp.encode(t, out_type=str) for t in batch]
            res = self.tr.translate_batch(
                toks, beam_size=4, max_decoding_length=max(len(t) for t in toks) * 2 + 8,
                repetition_penalty=1.3, no_repeat_ngram_size=2, length_penalty=0.2,
            )
            for t, r in zip(batch, res):
                self.cache[t] = self.sp.decode(r.hypotheses[0]).strip()
        return [self.cache[t] for t in texts]

    def glosses(self, items):
        """Kısa anlamlar: isim/sıfat → "Water." biçiminde; fiil → "I want to X." kalıbından mastar ("-mak istiyorum")."""
        texts = []
        for g, pos in items:
            g = g.strip()
            if pos == 'verb':
                texts.append(f"I want to {re.sub(r'^to\s+', '', g, flags=re.I)}.")
            else:
                texts.append(g[:1].upper() + g[1:] + '.')
        out = []
        for (g, pos), o in zip(items, self.translate(texts)):
            if pos == 'verb':
                m = re.match(r'^(?:ben\s+)?(.+?)\s+istiyorum\.?$', o, flags=re.I)
                o = m.group(1) if m else o
            o = o.rstrip('.').strip()
            if o[:1] == 'I':
                o = 'ı' + o[1:]
            elif o[:1] == 'İ':
                o = 'i' + o[1:]
            else:
                o = o[:1].lower() + o[1:]
            out.append(o)
        return out


# ---------------------------------------------------------------- 6. Türkçe anlam seçimi
GRAMMAR_DESC = re.compile(r'(çekimi|biçimi|çoğulu|kısaltması|kişilik|adılının|ekinin|\bhâli\b|\bhali\b|tamlayan durumu)', re.I)


def clean_tr(g: str, lang: str):
    """Türkçe Vikisözlük tanımını kısa bir anlama çevirir; dilbilgisi tanımlarını ("... çekimi") eler."""
    g = g.strip()
    g = re.sub(r'^\([^)]*\)\s*:?\s*', '', g)  # "(işaret adılı): şu" → "şu"
    g = re.sub(r'\s*\([^)]*\)', '', g)
    g = re.sub(r'\[[^\]]*\]', '', g)
    if lang != 'tr' and GRAMMAR_DESC.search(g):
        return None
    if len(g) > 45 and '. ' in g:
        g = g.split('. ')[0]
    g = g.strip(' .:;,')
    if not g:
        return None
    return g[:80] if lang != 'tr' else g[:140]


def clean_en_gloss(g: str) -> str:
    g = re.sub(r'\([^)]*\)', '', g)
    g = g.split(';')[0].split(',')[0].strip(' .:')
    return g


def pivot_tr(en_gloss: str, pos: str, en_tr):
    head = clean_en_gloss(en_gloss)
    head = re.sub(r'^(to|a|an|the)\s+', '', head, flags=re.I).strip().lower()
    if not head or len(head.split()) > 3 or head not in en_tr:
        return None
    rows = en_tr[head]
    same = [w for p, s, w in rows if p == pos] or [w for p, s, w in rows]
    out = list(dict.fromkeys(same))[:2]
    return ', '.join(out) if out else None


def en_target_tr(gloss: str, rows):
    if not rows:
        return None
    gw = set(re.findall(r'[a-z]+', gloss.lower()))
    best = max(rows, key=lambda r: len(gw & set(re.findall(r'[a-z]+', r[1].lower()))))
    sense = best[1]
    out = list(dict.fromkeys(w for p, s, w in rows if s == sense))[:2]
    return ', '.join(out) if out else None


# ---------------------------------------------------------------- 7. Örnek cümleler (Tatoeba)
def read_tsv_bz2(path):
    if not path.exists():
        return
    with bz2.open(path, 'rt', encoding='utf-8', errors='replace') as fh:
        for line in fh:
            yield line.rstrip('\n').split('\t')


def load_tatoeba(lang):
    code = TATOEBA[lang]
    d = RAW / 'tatoeba'
    flagged = {r[0] for r in read_tsv_bz2(d / f'{code}_tags.tsv.bz2') if len(r) > 1 and r[1].startswith('@')}
    sents = {r[0]: r[2] for r in read_tsv_bz2(d / f'{code}_sentences.tsv.bz2') if len(r) >= 3 and r[0] not in flagged}
    to_tr = defaultdict(list)
    to_en = defaultdict(list)
    if lang != 'tr':
        for r in read_tsv_bz2(d / f'{code}-tur_links.tsv.bz2'):
            if len(r) >= 2 and r[0] in sents:
                to_tr[r[0]].append(r[1])
    if lang != 'en':
        for r in read_tsv_bz2(d / f'{code}-eng_links.tsv.bz2'):
            if len(r) >= 2 and r[0] in sents:
                to_en[r[0]].append(r[1])
    return sents, to_tr, to_en


def load_texts(code, ids):
    ids = set(ids)
    return {r[0]: r[2] for r in read_tsv_bz2(RAW / 'tatoeba' / f'{code}_sentences.tsv.bz2') if len(r) >= 3 and r[0] in ids}


TOKEN_RE = re.compile(r"[^\W\d_]+(?:['’-][^\W\d_]+)*")


def pick_examples(lang, ranked, form_index):
    sents, to_tr, to_en = load_tatoeba(lang)
    tr_texts = load_texts('tur', {i for v in to_tr.values() for i in v}) if to_tr else {}
    en_texts = load_texts('eng', {i for v in to_en.values() for i in v}) if to_en else {}
    want = set(ranked)
    best = {}
    for sid, text in sents.items():
        toks = [norm(t, lang) for t in TOKEN_RE.findall(text)]
        if not 3 <= len(toks) <= 12 or len(text) > 90:
            continue
        has_tr = any(i in tr_texts for i in to_tr.get(sid, ()))
        has_en = any(i in en_texts for i in to_en.get(sid, ()))
        if lang == 'tr':
            has_tr = True  # Türkçe cümlenin kendisi
        if not (has_tr or has_en):
            continue
        quality = (0 if has_tr else 1, abs(len(toks) - 6))
        for t in set(toks):
            for lem in form_index.get(t, ()):
                if lem in want and (lem not in best or quality < best[lem][0]):
                    best[lem] = (quality, sid)
    out = {}
    for lem, (_, sid) in best.items():
        ex = {'t': sents[sid], 'src': f'tatoeba:{sid}'}
        trs = [tr_texts[i] for i in to_tr.get(sid, ()) if i in tr_texts]
        ens = [en_texts[i] for i in to_en.get(sid, ()) if i in en_texts]
        if trs:
            ex['tr'] = trs[0]
        if ens:
            ex['en'] = ens[0]
        out[lem] = ex
    log(f'örnekler {lang}: {len(out)} kelimeye Tatoeba cümlesi bulundu')
    return out


# ---------------------------------------------------------------- 8. Emoji
def load_emoji():
    """Unicode adı kelimenin kendisi olan ya da adında kelime geçen ilk emoji (ör. 'red apple' → apple).
    Bileşen/sembol/bayrak grupları alınmaz."""
    maps = {}
    for loc in ['ru', 'hu', 'fr', 'es', 'en']:
        p = RAW / 'emoji' / f'{loc}.json'
        if not p.exists():
            continue
        exact, inside = {}, {}
        for e in json.loads(p.read_text(encoding='utf-8')):
            if e.get('group') in (2, 8, 9):
                continue
            label = norm(e.get('label') or '', loc if loc in LANGS else 'en')
            if not label:
                continue
            exact.setdefault(label, e['emoji'])
            for part in re.findall(r"[^\W\d_]+", label):
                if len(part) > 2:
                    inside.setdefault(part, e['emoji'])
        maps[loc] = {**inside, **exact}
    return maps


# ---------------------------------------------------------------- Ana akış
def main():
    t0 = time.time()
    OUT.mkdir(parents=True, exist_ok=True)
    surfaces = load_frequencies()
    lemma_entries, formmap, exmap, en_tr = scan_enwiktionary(surfaces)
    trw, trw_audio = scan_trwiktionary()
    extra_audio = {l: scan_wikt_audio(p, l) for l, p in EXTRA_AUDIO.items() if p.exists()}
    mt = MT()
    emoji = load_emoji()
    summary = {}
    for lang in LANGS:
        ranked, score = rank_lemmas(lang, surfaces, lemma_entries, formmap)
        entries = lemma_entries[lang]
        # çekim → sözlük biçimi dizini (yalnızca seçilenler; süzülmüş biçimlerle)
        chosen = set(ranked)
        form_index = defaultdict(set)
        for lem in ranked:
            form_index[lem].add(lem)
            for r in entries[lem]:
                for fm in r['forms']:
                    form_index[fm].add(lem)
        for s, lems in exmap[lang].items():
            for x in lems:
                if x in chosen:
                    form_index[s].add(x)
        examples = pick_examples(lang, ranked, form_index)

        overrides_n = {norm(k, lang): v for k, v in OVERRIDES.get(lang, {}).items()}
        blacklist_n = {norm(k, lang) for k in BLACKLIST.get(lang, set())}
        words = []
        mt_jobs = []  # (index, field, text)
        for lem in ranked:
            if lem in blacklist_n:
                continue
            recs = [r for r in entries[lem] if r['pos'] in ALLOWED_POS and any(not g['weak'] and not g['bad'] for g in r['gl'])]
            if not recs:
                continue
            # Çok sık kelimelerde sıklık büyük ölçüde görevli kullanımdan gelir (ör. Fr. "pas" = değil, "adım" değil)
            if len(words) < 400:
                recs = sorted(recs, key=lambda r: 0 if r['pos'] in FUNCTION_POS else 1)
            main_rec = recs[0]
            senses = []
            for r in recs:
                for g in r['gl']:
                    if g['weak'] or g['bad']:
                        continue
                    senses.append({'en': g['g'], 'pos': r['pos']})
                    if len(senses) >= 3:
                        break
                if len(senses) >= 3:
                    break
            # Elle düzeltilmiş anlam (en sık görevli kelimelerdeki hatalı otomatik seçimler için)
            ov = overrides_n.get(lem)
            if ov:
                pos, en, trg = ov
                senses = [{'en': en, 'pos': pos, 'tr': trg, 'ts': 'curated'}] + [s for s in senses if s['pos'] != pos][:2]
                main_rec = next((r for r in recs if r['pos'] == pos), main_rec)
            # Türkçe anlam: sırayla kaynaklar (Türkçe Vikisözlük'te sözcük türü eşleşmeli)
            trw_rows = trw.get((lang, lem), [])
            used = set()
            for i, s in enumerate(senses):
                if s.get('ts') == 'curated':
                    continue
                tr, src = None, None
                cm = re.match(r'^contraction of (.+?)\.?$', s['en'], re.I)
                if cm:
                    tr, src = f"{cm.group(1).replace(' and ', ' + ').replace(' ', ' + ')} (kaynaşmış biçim)", 'vikisozluk-en'
                if not tr and lang == 'en':
                    tr = en_target_tr(s['en'], [row for row in en_tr.get(lem, []) if row[0] == s['pos']] or en_tr.get(lem, []))
                    src = 'vikisozluk-en' if tr else None
                if not tr:
                    cand = [(j, clean_tr(g, lang)) for j, (p, g) in enumerate(trw_rows) if p == s['pos'] and j not in used]
                    cand = [(j, g) for j, g in cand if g]
                    if cand:
                        j, g = cand[0]
                        used.add(j)
                        tr, src = g, 'vikisozluk-tr'
                if not tr and lang != 'tr':
                    tr = pivot_tr(s['en'], s['pos'], en_tr)
                    src = 'pivot-en' if tr else None
                if not tr and lang != 'tr':
                    mt_jobs.append((len(words), i, (clean_en_gloss(s['en']), s['pos'])))
                    src = 'mt'
                s['tr'] = tr
                s['ts'] = src
            forms = []
            for r in recs:
                forms += r['forms']
            forms = [f for f in dict.fromkeys(forms) if f != lem]
            seen = [f for f in forms if f in surfaces[lang]]
            forms = (seen + [f for f in forms if f not in surfaces[lang]])[:40]
            audio = next((a for r in recs for a in r['au']), None) or trw_audio.get((lang, lem)) or extra_audio.get(lang, {}).get(lem)
            ipa = next((r['ipa'] for r in recs if r['ipa']), None)
            ex = examples.get(lem)
            if not ex:
                wex = next((e for r in recs for e in r['ex']), None)
                if wex:
                    ex = {'t': wex['t'], 'en': wex['en'], 'src': 'vikisozluk'}
            if ex and not ex.get('tr') and ex.get('en') and lang != 'tr':
                mt_jobs.append((len(words), 'ex', ex['en']))
            w = {
                'r': len(words) + 1,
                'w': main_rec['word'] if main_rec['word'] else lem,
                'p': senses[0]['pos'],
                'm': senses,
                'f': forms,
            }
            if lang == 'ru' and main_rec.get('can'):
                w['s'] = main_rec['can']
            if lang == 'ru' and main_rec.get('rom'):
                w['t'] = main_rec['rom']
            if ipa:
                w['i'] = ipa
            if audio:
                w['a'] = {'u': audio['u'], 'f': audio['f']}
            if ex:
                w['x'] = ex
            # emoji: yalnızca isimlerde, ad birebir eşleşirse
            if main_rec['pos'] == 'noun':
                em = emoji.get(lang, {}).get(lem) if lang in emoji else None
                if not em:
                    head = re.sub(r'^(a|an|the)\s+', '', clean_en_gloss(senses[0]['en']).lower())
                    em = emoji.get('en', {}).get(head)
                if em:
                    w['e'] = em
            words.append(w)
            if len(words) >= max(TARGET, len(ranked) - 200):
                break
        # makine çevirisi toplu
        if mt_jobs:
            log(f'makine çevirisi {lang}: {len(mt_jobs)} metin')
            gl_jobs = [j for j in mt_jobs if j[1] != 'ex']
            ex_jobs = [j for j in mt_jobs if j[1] == 'ex']
            for (wi, si, (src_text, _)), tr in zip(gl_jobs, mt.glosses([j[2] for j in gl_jobs])):
                # Çeviri İngilizceyi aynen geri verdiyse Türkçe anlam yok sayılır (yalnızca İngilizce gösterilir)
                if not tr or tr.lower().strip(' .') == src_text.lower().strip(' .'):
                    words[wi]['m'][si]['tr'] = None
                    words[wi]['m'][si]['ts'] = None
                else:
                    words[wi]['m'][si]['tr'] = tr
            for (wi, _, _), tr in zip(ex_jobs, mt.translate([j[2] for j in ex_jobs])):
                words[wi]['x']['tr'] = tr
                words[wi]['x']['trs'] = 'mt'
        # Elle yapılan içerik düzeltmeleri (corrections.json) her yeniden üretimde uygulanır
        from apply_corrections import apply_to_words, load_corrections, needed_ids, tatoeba_lookup
        corr = load_corrections()
        apply_to_words(lang, words, corr, tatoeba_lookup(lang, needed_ids(lang, corr)))
        write_lang(lang, words)
        summary[lang] = stats(words)
        log(f'{lang}: {summary[lang]}')
    (OUT / 'summary.json').write_text(json.dumps({'built': time.strftime('%Y-%m-%d'), 'langs': summary}, ensure_ascii=False, indent=1), encoding='utf-8')
    log(f'bitti ({(time.time() - t0) / 60:.1f} dk)')


def stats(words):
    n = len(words)
    c = Counter()
    for w in words:
        c[w['m'][0].get('ts') or 'yok'] += 1
        c['audio'] += 'a' in w
        c['example'] += 'x' in w
        c['example_tr_human'] += 'x' in w and 'tr' in w['x'] and w['x'].get('trs') != 'mt'
        c['emoji'] += 'e' in w
        c['ipa'] += 'i' in w
    return {'words': n, **{k: round(v / n, 3) for k, v in c.items()}}


def write_lang(lang, words):
    d = OUT / lang
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob('words-*.json'):
        old.unlink()
    chunks = []
    for i in range(0, len(words), CHUNK):
        name = f'words-{i // CHUNK + 1}.json'
        (d / name).write_text(json.dumps(words[i:i + CHUNK], ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        chunks.append(name)
    index = {
        'lang': lang, 'count': len(words), 'chunks': chunks, 'built': time.strftime('%Y-%m-%d'),
        'stats': stats(words), 'pos': POS_TR,
    }
    (d / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
