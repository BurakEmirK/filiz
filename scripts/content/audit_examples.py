#!/usr/bin/env python3
"""İçerik denetimi yardımcısı: en sık N kelimede örnek cümle gerçekten kelimeyi içeriyor mu?

İçermeyenler için yerel Tatoeba verisinden (data-raw/tatoeba) insan Türkçe çevirisi olan kısa aday cümleler listeler.
Seçim elle yapılır ve scripts/content/corrections.json dosyasına yazılır (bu betik hiçbir paketi değiştirmez).

Çalıştırma:
  python -I -X utf8 scripts/content/audit_examples.py en 100 > denetim-en.txt
"""
from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_content import OUT, TOKEN_RE, load_tatoeba, load_texts, norm  # noqa: E402


def tokens(text: str, lang: str) -> list[str]:
    return [norm(t, lang) for t in TOKEN_RE.findall(text)]


def bare(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c))


def safe_forms(w: dict, lang: str) -> set[str]:
    """Uygulamadaki safeForms ile aynı kural: sözlük biçimi + aynı iki harfle başlayan biçimler."""
    lemma = norm(w['w'], lang)
    head = bare(lemma)[:2]
    return {lemma} | {norm(f, lang) for f in w.get('f', []) if len(norm(f, lang)) >= 2 and bare(norm(f, lang)).startswith(head)}


def main(lang: str, n: int):
    d = OUT / lang
    index = json.loads((d / 'index.json').read_text(encoding='utf-8'))
    words = sorted((w for c in index['chunks'] for w in json.loads((d / c).read_text(encoding='utf-8'))), key=lambda w: w['r'])[:n]
    flagged = []
    for w in words:
        forms = safe_forms(w, lang)
        ex = w.get('x')
        if ex and forms & set(tokens(ex['t'], lang)):
            continue
        flagged.append((w, forms))
    sents, to_tr, _ = load_tatoeba(lang)
    tr_texts = load_texts('tur', {i for v in to_tr.values() for i in v})
    lemma_of = {}
    for w, forms in flagged:
        for f in forms:
            lemma_of.setdefault(f, []).append(w['w'])
    cands: dict[str, list[tuple]] = {w['w']: [] for w, _ in flagged}
    for sid, text in sents.items():
        if len(text) > 60 or sid not in to_tr:
            continue
        toks = tokens(text, lang)
        if not 2 <= len(toks) <= 8:
            continue
        trs = [tr_texts[i] for i in to_tr[sid] if i in tr_texts]
        if not trs:
            continue
        for t in set(toks):
            for lem in lemma_of.get(t, ()):
                exact = t == norm(lem, lang)
                cands[lem].append((0 if exact else 1, len(toks), sid, text, trs[0]))
    print(f'# {lang}: ilk {n} kelimede örneği kelimeyi içermeyen {len(flagged)} kelime\n')
    for w, _ in flagged:
        ex = w.get('x') or {}
        print(f"{w['r']} {w['w']} ({w['p']}) = {w['m'][0].get('tr')} | şimdiki: {ex.get('t', '-')} => {ex.get('tr', '')}")
        for c in sorted(cands[w['w']])[:5]:
            print(f'    tatoeba:{c[2]}  {c[3]}  =>  {c[4]}')


if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 100)
