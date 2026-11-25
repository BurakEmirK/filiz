#!/usr/bin/env python3
"""Biçim süzmesini küçük bir örnekle sınar: seçilen kelimelerin önceki ve sonraki biçim listelerini yazdırır.

"Önce" = süzme öncesi (tüm biçimler), "sonra" = build_content.py'deki form_kept() süzmesinden geçenler.
Elenen her biçimin yanında Vikisözlük etiketi gösterilir. Hiçbir paketi değiştirmez.

Çalıştırma (tüm döküm taranır, birkaç dakika sürer):
  python -I -X utf8 scripts/content/preview_forms.py en one,first,my,they,of
Daha hızlı: önceden ayıklanmış satırlar (kaikki JSONL, .gz olabilir) verilebilir:
  python -I -X utf8 scripts/content/preview_forms.py en one,first --from ornek.jsonl
"""
from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_content import META_FORM_TAGS, RAW, form_kept, norm, valid  # noqa: E402


def open_lines(path: Path):
    return gzip.open(path, 'rt', encoding='utf-8') if path.suffix == '.gz' else path.open(encoding='utf-8')


def main(lang: str, words: list[str], src: Path):
    want = {norm(w, lang) for w in words}
    needle = f'"lang_code": "{lang}"'
    found: dict[str, list[tuple[str, dict]]] = {w: [] for w in want}
    with open_lines(src) as fh:
        for line in fh:
            if needle not in line:
                continue
            o = json.loads(line)
            word = o.get('word') or ''
            if o.get('lang_code') != lang or word != word.lower() or norm(word, lang) not in want:
                continue
            for fm in o.get('forms') or []:
                ft = fm.get('form') or ''
                if set(fm.get('tags') or []) & META_FORM_TAGS or not ft or ' ' in ft:
                    continue
                nf = norm(ft, lang)
                if valid(nf, lang) and nf != norm(word, lang):
                    found[norm(word, lang)].append((nf, fm))
    for w in words:
        rows = found[norm(w, lang)]
        before = list(dict.fromkeys(nf for nf, _ in rows))
        after = list(dict.fromkeys(nf for nf, fm in rows if form_kept(fm, nf, norm(w, lang), lang)))
        dropped = {nf: fm.get('tags') or fm.get('raw_tags') for nf, fm in rows if nf not in after}
        print(f'## {lang} {w}')
        print(f'   önce  ({len(before)}): {", ".join(before)}')
        print(f'   sonra ({len(after)}): {", ".join(after)}')
        print('   elenen: ' + (', '.join(f'{k} {v}' for k, v in dropped.items()) or '-'))


if __name__ == '__main__':
    args = sys.argv[1:]
    src = RAW / 'kaikki' / 'en-raw.jsonl.gz'
    if '--from' in args:
        i = args.index('--from')
        src = Path(args[i + 1])
        args = args[:i] + args[i + 2:]
    main(args[0], args[1].split(','), src)
