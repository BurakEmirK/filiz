# Ses iyileştirmesi — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İnsan kayıtları dokununca anında, Dynamic Island'a düşmeden ve sessiz modda da çalsın; elle hazırlanmış kelimeler kayıtlarını bulsun; Ses testi doğru bilgi versin; İspanyolcaya insan sesi eklensin.

**Architecture:** `src/ui/audio.ts` kayıtları indirip Web Audio ile çözer ve `AudioBufferSourceNode` ile çalar; çözülmüş kayıt yoksa bugünkü `HTMLAudioElement` yolu, o da olmazsa cihaz sesi. Kayıt adresi dokunma anında `content.wordSense()` ile bulunur. İspanyolca ses, İspanyolca Vikisözlük'ten (kaikki) ayrı bir betikle mevcut pakete eklenir; ana hat da aynı işlevi kullanır.

**Tech Stack:** React 19, TypeScript 7, Vite 8, vitest 5 (node ortamı), Python 3 (stdlib).

**Spec:** `docs/superpowers/specs/2026-11-19-ses-iyilestirme-design.md`

## Global Constraints
- `navigator.audioSession.type = 'playback'` kalır (kullanıcı seçimi A: sessiz modda da çal).
- Hiçbir ses kendiliğinden çalmaz; yalnızca dokunuşla.
- Ses adresleri yalnızca `upload.wikimedia.org` / `commons.wikimedia.org`.
- Arayüz metinleri Türkçe.
- Ücretli hizmet yok; yeni bağımlılık yok.

## Review Focus
1. Kayıt önceden çözülmemişken dokunma → ses yine çalmalı (oynatıcı yoluna düşer). Test: Task 2 `fallback`.
2. Çok sayıda kelime ekranda (Kelimeler listesi) → bellek sınırlı kalmalı. Test: Task 2 `cap`.
3. Paket henüz yüklenmemişken kelimeye dokunma → cihaz sesiyle çalmalı, hata vermemeli. Test: Task 3 `before load`.
4. Büyük/küçük harf ve noktalama farkı ("Ház!", "¿Agua?") → aynı kayıt bulunmalı. Test: Task 3 `normalize`.
5. Çözme (decode) hatası veren dosya → oynatıcı yoluna düşmeli. Test: Task 2 `decode error`.

---

### Task 1: İspanyolca insan sesi

**Files:**
- Modify: `scripts/content/build_content.py` (yeni `scan_wikt_audio`, `pick_audio`; `main` ses zinciri)
- Create: `scripts/content/add_audio.py`
- Modify: `public/content/es/*.json`, `public/content/summary.json`, `public/content/SOURCES.md`
- Test: `tests/batch.test.ts`

**Interfaces:**
- Produces: `scan_wikt_audio(path: Path, lang: str) -> dict[str, dict]` (küçük harfli kelime → `{'u': mp3_url, 'f': audio}`), `pick_audio(sounds: list[dict]) -> dict | None` (önce `Spain` etiketli, sonra etiketsiz, sonra diğerleri; yalnızca `mp3_url` olanlar).
- `add_audio.py es data-raw/eswikt/es-wikt.jsonl.gz`: kaydı olmayan kelimelere `a` ekler, `write_lang` ile yazar, `summary.json`'daki dil istatistiğini günceller.

- [ ] Test: `es: İspanyolca Vikisözlük ile insan sesi kapsamı en az %15` → `words.filter(w => w.a).length / words.length > 0.15`.
- [ ] Çalıştır, FAIL (0,007).
- [ ] İşlevleri ve betiği yaz; `main` içinde `RAW/'eswikt'/'es-wikt.jsonl.gz'` varsa `es` için zincire ekle.
- [ ] `python -I scripts/content/add_audio.py es data-raw/eswikt/es-wikt.jsonl.gz` → ~596/3200.
- [ ] Testler PASS; SOURCES.md'ye İspanyolca Vikisözlük (CC BY-SA, ses dosyası adresleri) satırı.

### Task 2: Anında çalan kayıtlar (Web Audio)

**Files:**
- Modify: `src/ui/audio.ts`
- Test: `tests/audio.test.ts` (yeni)

**Interfaces:**
- Consumes: —
- Produces (imzalar korunur): `preloadRecording(url?: string): Promise<void>` (artık çözer de), `play(target: AudioTarget): Promise<PlayOutcome>`; `audioLog[0].detail` kayıtta `'anında'` veya `'oynatıcı'`; yeni `audioStats(): { decoded: number }`; sabit `MAX_DECODED = 40`.
- Ses bağlamı tek; boşta 5 sn sonra `suspend()`, dokununca `resume()` (dokunuşun içinde, eşzamanlı).

- [ ] `tests/audio.test.ts`: sahte `AudioContext` (decodeAudioData, createBufferSource.start, resume/suspend), sahte `fetch`, sahte `Audio`; `vi.resetModules()` + dinamik import.
  - `instant`: `await preloadRecording(u); await play({text:'x',lang:'hu',recording:u})` → `'recording'`, `start` çağrıldı, `audioLog[0].detail === 'anında'`.
  - `fallback`: önceden yüklenmemiş adres → `'recording'`, `Audio.play` çağrıldı, detail `'oynatıcı'`.
  - `decode error`: decodeAudioData reddeder → play detail `'oynatıcı'`.
  - `cap`: 50 adres önceden yüklenince `audioStats().decoded <= 40`.
- [ ] FAIL → uygula → PASS.

### Task 3: Kaydın dokunma anında bulunması

**Files:**
- Modify: `src/content/registry.ts` (`wordSense`), `src/ui/components.tsx` (AudioButton), `src/screens/Player.tsx` (LetterStep, TypeStep, ders başında önceden yükleme), `src/screens/Demo.tsx` (paketi yükle)
- Test: `tests/batch.test.ts`

**Interfaces:**
- Produces: `ContentRegistry.wordSense(lang: string, word: string): Sense | undefined` — `snd:` olmayan, `senseIndex === 1`, kaydı olan tercih edilir; anahtar: küçük harf + `´́¿?¡!.,` temizlenmiş; dizin `addGenerated` sonrası yenilenir.
- AudioButton: `recording` verilmezse dokunma anında `content.wordSense(lang, text)?.audio?.url`.

- [ ] Test `normalize`/`curated`: `ensureLanguage('hu')` sonrası `reg.wordSense('hu','Ház!')?.audio?.url` Wikimedia adresi ve `id === 'hu-house'` gibi elle hazırlanmış anlam (generated değil).
- [ ] Test `before load`: yeni kayıt defterinde `reg.wordSense('hu','ház')?.audio` → `undefined` (hata yok).
- [ ] FAIL → uygula → PASS.

### Task 4: Ses testi ve sessiz mod ipucu

**Files:**
- Modify: `src/screens/SoundTest.tsx`, `src/screens/Player.tsx` (useListenMode), `src/ui/components.tsx`

- [ ] Yüklenmemiş dil: satırda "paket yüklenmedi" + "Paketi yükle" düğmesi; raporda `insan kaydı paket yüklenmedi`.
- [ ] Cihaz sesi çaldığında (oturumda ilk kez) "Duymuyorsan sessiz modu kapatmayı dene." ipucu; dinleme ekranında kalıcı küçük not.
- [ ] Tarayıcıda doğrula (Task 5).

### Task 5: Doğrulama ve yayın
- [ ] `npm run typecheck`, `npm test`, `npm run build` → hepsi geçer.
- [ ] Geliştirme sunucusu: bir ders/harf örneğinde dokun → Ses testi raporunda `recording (anında)`; konsolda hata yok.
- [ ] Commit (tasarım + plan + kod + İspanyolca paket), push; GitHub Actions başarılı; canlı sürümde yeni paket adı.
