#!/usr/bin/env python3
"""Elle yapılan içerik düzeltmelerini (scripts/content/corrections.json) dil paketlerine uygular.

- Örnek cümle değişikliği yalnızca Tatoeba'dan yapılır; kaynak kimliği (tatoeba:<id>) ve insan çevirisi korunur.
- Düzeltilen Türkçe çeviri "trs": "fixed" olarak işaretlenir (uygulamada "çeviri düzeltildi" diye görünür).
- Düzeltilen anlam "ts": "curated" olur; gizlenen anlam "h": 1 alır (uygulamada gösterilmez, kimlik numaraları değişmez).
- build_content.py tüm hattı yeniden çalıştırınca da bu düzeltmeler uygulanır.

Çalıştırma (yalnızca düzeltmeleri uygulamak için):
  python -I -X utf8 scripts/content/apply_corrections.py en ru hu
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_content import OUT, RAW, TATOEBA, load_texts, log, read_tsv_bz2, stats, write_lang  # noqa: E402

CORR = Path(__file__).resolve().parent / 'corrections.json'


def load_corrections() -> dict:
    return json.loads(CORR.read_text(encoding='utf-8'))


def tatoeba_lookup(lang: str, ids: set[str]) -> dict[str, tuple[str, str | None, str | None]]:
    """Tatoeba kimliğinden (cümle, ilk Türkçe insan çevirisi, ilk İngilizce insan çevirisi).
    Türkçe paket için çeviri İngilizcedir (Türkçe cümlenin Türkçe çevirisi olmaz)."""
    code = TATOEBA[lang]
    texts = load_texts(code, ids)

    def linked(target: str) -> dict[str, str]:
        links: dict[str, list[str]] = {}
        for r in read_tsv_bz2(RAW / 'tatoeba' / f'{code}-{target}_links.tsv.bz2'):
            if len(r) >= 2 and r[0] in ids:
                links.setdefault(r[0], []).append(r[1])
        found = load_texts(target, {i for v in links.values() for i in v})
        return {i: next((found[x] for x in v if x in found), None) for i, v in links.items()}

    trs = linked('tur') if lang != 'tr' else {}
    ens = linked('eng') if lang != 'en' else {}
    return {i: (texts[i], trs.get(i), ens.get(i)) for i in ids if i in texts}


def needed_ids(lang: str, corr: dict) -> set[str]:
    return {c['x'].split(':', 1)[1] for c in corr['words'].get(lang, {}).values() if c.get('x')}


def apply_to_words(lang: str, words: list[dict], corr: dict, lookup: dict[str, tuple[str, str | None, str | None]]) -> int:
    wc = corr['words'].get(lang, {})
    sc = corr['sentences'].get(lang, {})
    by = {w['w']: w for w in words}
    changed = 0
    for lemma, c in wc.items():
        w = by.get(lemma)
        if not w:
            log(f'uyarı: {lang} "{lemma}" pakette yok, düzeltme atlandı')
            continue
        if 'p' in c:
            w['p'] = c['p']
        for k, v in c.get('m', {}).items():
            i = int(k)
            if i >= len(w['m']):
                continue
            if v == 'hide':
                if i == 0:
                    raise ValueError(f'{lang} {lemma}: ilk anlam gizlenemez, düzeltilmeli')
                w['m'][i]['h'] = 1
            else:
                w['m'][i] = {**v, 'ts': 'curated'}
        if 'x' in c:
            if c['x'] is None:
                w.pop('x', None)
            else:
                sid = c['x'].split(':', 1)[1]
                if sid not in lookup:
                    raise ValueError(f'{lang} {lemma}: {c["x"]} Tatoeba verisinde bulunamadı')
                t, tr, en = lookup[sid]
                # İngilizce çeviri yalnızca Türkçe çeviri yoksa eklenir (Türkçe paket); diğer paketler değişmez
                w['x'] = {'t': t, 'src': c['x'], **({'tr': tr} if tr else {'en': en} if en else {})}
        changed += 1
    for w in words:
        x = w.get('x')
        if x and x['t'] in sc:
            x['tr'] = sc[x['t']]
            x['trs'] = 'fixed'
    return changed


def main(langs: list[str]):
    corr = load_corrections()
    summary_path = OUT / 'summary.json'
    summary = json.loads(summary_path.read_text(encoding='utf-8'))
    for lang in langs:
        d = OUT / lang
        index = json.loads((d / 'index.json').read_text(encoding='utf-8'))
        words = [w for c in index['chunks'] for w in json.loads((d / c).read_text(encoding='utf-8'))]
        n = apply_to_words(lang, words, corr, tatoeba_lookup(lang, needed_ids(lang, corr)))
        write_lang(lang, words)
        summary['langs'][lang] = stats(words)
        log(f'{lang}: {n} kelimede düzeltme uygulandı')
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main(sys.argv[1:])
