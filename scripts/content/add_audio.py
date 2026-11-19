#!/usr/bin/env python3
"""Mevcut bir dil paketine, o dilin kendi Vikisözlüğündeki insan sesi kayıtlarını ekler (tüm hattı yeniden çalıştırmadan).

Yalnızca kaydı olmayan kelimelere ekler; anlamlara, sıralamaya ve örneklere dokunmaz.

Çalıştırma:
  PYTHONUTF8=1 python -I scripts/content/add_audio.py es data-raw/eswikt/es-wikt.jsonl.gz
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_content import OUT, log, norm, scan_wikt_audio, stats, write_lang  # noqa: E402


def main(lang: str, dump: str):
    d = OUT / lang
    index = json.loads((d / 'index.json').read_text(encoding='utf-8'))
    words = [w for c in index['chunks'] for w in json.loads((d / c).read_text(encoding='utf-8'))]
    audio = scan_wikt_audio(Path(dump), lang)
    added = 0
    for w in words:
        if 'a' in w:
            continue
        a = audio.get(norm(w['w'], lang))
        if a:
            w['a'] = a
            added += 1
    write_lang(lang, words)
    summary_path = OUT / 'summary.json'
    summary = json.loads(summary_path.read_text(encoding='utf-8'))
    summary['langs'][lang] = stats(words)
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding='utf-8')
    log(f'{lang}: {added} kelimeye ses eklendi; toplam {sum("a" in w for w in words)}/{len(words)}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
