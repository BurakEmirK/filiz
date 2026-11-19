---
name: filiz-usability
description: Usability, copy and visual-design rules for Filiz, the owner's Turkish-language language-learning PWA (React + Vite + Dexie, iPhone and iPad). Use this whenever you change or add anything a learner sees in Filiz — a screen, an exercise, the word card, navigation, the Today/daily-session flow, lesson steps, settings or Profile pages, Demo Mode, CSS/theme, or any Turkish UI text — even for a "small tweak" and even when the request never says usability or design.
---

# Filiz usability rules

Filiz is used by one non-technical learner, every day, mostly on an iPhone 15 Pro, sometimes on an iPad Air.
The interface language is Turkish. The 2026-11-20 update existed because the app "felt complicated": too many panels,
21–23-step lessons, development notes on the main screen. Every rule below protects against sliding back there.
The rules live only in this file. Specs in `docs/superpowers/specs/` record decisions and point here.

## 1. Navigation: three places, nothing else at the top level

| Tab | Route | What belongs there |
|---|---|---|
| Bugün | `#/today` | The recommended daily session; resuming it; the "done for today" state. |
| Keşfet | `#/explore` | Everything optional: lesson library `#/learn`, Sesler ve Harfler `#/sounds`, sectors `#/industries`, words/collection/error notebook `#/words`, extra practice (`#/review`, `#/wod`). |
| Profil | `#/profile` | Short summary, then focused sub-pages: `#/profile/{learning,appearance,backup,help,sources,progress,goal}`. |

- A new feature goes under Keşfet or a Profil sub-page, never as a fourth tab or as a card on Today.
- Old routes keep working through `tabFor()` in `src/app/App.tsx`: `#/me` → Profil, `#/career` → Profil › Hedef.
  Add a redirect there rather than breaking a link.
- Sub-pages start with a `BackLink`. Full-screen activities (`#/session`, `#/lesson`, `#/review`…) have a close button
  that saves progress.

## 2. Today: one dominant action

- Exactly one primary button.
  - Default label: **"Bugünkü çalışmama başla"**.
  - With an unfinished session or lesson: **"Kaldığım yerden devam et"**.
  - When a session is already done today and more work is due: "Sıradaki kısa oturuma başla".
- Supporting facts are only:
  - active language,
  - approximate duration (marked as an estimate),
  - review count,
  - new-word count.

  The Word of the Day appears as the headword at the top of the card and is the first new word of the session.
- When there is nothing left, show "Bugünlük tamam" with a one-line summary and an optional **"Biraz daha çalış"**.
  "Biraz daha çalış" is the only way to go past the daily new-word target, and it says so.
- Keep these off Today:
  - career reports,
  - source or coverage statistics,
  - feature-status lists,
  - evaluation queues.

  They live in Profil (Hedef, Kaynaklar, Yardım).

## 3. Sessions: short, resumable, honest about the budget

The logic is in `src/screens/daily.ts` and `src/screens/steps.ts`. Keep the numbers there; do not repeat them in
components.

- **Session size is a product choice, not a scientific rule.**
  - A normal session is about 8–12 steps (`SESSION_TARGET = 12`).
  - At most 4 new words (`SESSION_MAX_NEW`).
  - Each new word gets an introduction and then a recognition check, asked after the next word's introduction.
- **Writing, cloze and free sentences come later**, in review sessions. A word meets writing once its recognition is
  solid (`readyToWrite`). Free sentences are optional and offered on the summary screen.
- **Repeat what the learner struggled with.** A wrong answer on a new word appends one more recognition step at the end
  (`appendRetry`, at most `MAX_RETRIES`). Spacing across days is FSRS's job.
- **Daily new-word budget.**
  - Count only the unique meanings whose *first-ever* review falls on the local day (`introducedToday`).
  - Letters (`snd:`), personal phrases (`user:`) and placement/"biliyorum" checks (`source: 'placement'`) never count.
  - Any new flow that records recognitions of words the learner already knows must use `source: 'placement'`.
- **Let the day end.** Items already studied today whose short FSRS learning step falls later the same day wait until
  tomorrow in the daily flow (`dailyDue`). Keşfet › Tekrar still shows them.
- **Persist sessions as step descriptors** (`StepDesc`, `toDesc`/`fromDesc`) in the `sessions` table, so a reload or app
  restart resumes on the exact step.
- **Never** resume at an unrelated step, erase progress, or mark unfinished work as complete. A lesson saved without
  `seq: 2` keeps its old long sequence (`lessonStepsFor`) and shows a one-line note.

## 4. Word card and exercises

**The default word card** (`IntroStep`, `SenseDetail`) shows:
- the target-language spelling (`Headword`, serif);
- an obvious labelled "Dinle" button;
- **one** meaning in the explanation language, plus the part of speech;
- grammar needed to use the word (e.g. Russian gender, via `essentialGrammar`);
- one short example;
- the picture, if there is one.

**Everything else goes behind "Okunuş ve ayrıntılar"** (`WordDetails`):
- transliteration, approximate pronunciation, IPA;
- English gloss and source;
- other meanings (deduplicated by Turkish gloss), synonyms, collocations;
- source and licence;
- the "Bu içerikte sorun var" report.

**Each exercise has:**
- one short instruction line (`Instruction`, e.g. "Dinle ve anlamını seç.");
- one primary action in the sticky `action-bar` (it stays above the keyboard and long content);
- brief feedback ("Doğru.", "Doğrusu: …", "Neredeyse.") that scrolls itself into view;
- explanations only behind "Neden?".

Keep confirmation steps and paragraphs out of the default path.

**Audio:**
- The audio source is always stated: human recording or device voice.
- A failure says so plainly and offers "Okuyarak devam et", which switches the same question to reading.
- Never autoplay.

**Synonyms:** two words with the same Turkish gloss are *not* interchangeable. Answer with `relatedForWord`: "benzer
olabilir, ama burada istenen…". Do not accept it as correct.

## 5. Honesty

**Sentence evaluation has three states** (`evaluatorState`):
- **unconfigured:** say before writing that nothing evaluates sentences. The button is "Pratik cümlesini kaydet", the
  confirmation is "Cümlen kaydedildi.", and nothing is queued (`evalStatus: 'local'`).
- **offline:** say it will be evaluated when online (queued as `pending`).
- **ready:** state what is sent.

In all three states:
- The four evaluation axes stay behind "Ayrıntılı kontrol".
- Never promise "sonraki aşamada" features in the learner's path.
- Never show success that was not checked.

**Content:**
- Content is AI-drafted or automatically processed open data.
- Label machine and corrected translations: "(makine çevirisi)", "(çeviri düzeltildi)".
- Never describe AI review as expert validation.
- Content fixes go through `scripts/content/corrections.json`:
  - keep stable sense ids;
  - hide a bad meaning instead of deleting it;
  - take new examples from Tatoeba with their `tatoeba:<id>`.
- Content reports stay on the device (`reports` table). The UI says so.

**Device testing:** only the person with the device can confirm iPhone or iPad behaviour (audio, Pencil, Safari
install). Report it as untested until they do.

## 6. Data, Demo, backups

- Learning records stay separate per language. General progress and industry progress stay separate.
- The guest runs in its own database, and the owner database is closed during Demo.
- Ending a demo, or reloading during one, shows the neutral handover screen ("Telefonu sahibine ver"). No owner data
  is visible until the owner taps through.
- **Schema changes:**
  - add a new Dexie version;
  - keep older backups importable;
  - after an import, call `reloadProfile()`.

## 7. Visual identity: "Çivit"

The default theme `civit` is indigo dye on undyed cloth, a nod to the textile context. The other themes stay
selectable. Tokens are in `src/styles.css` `:root`:

| Token | Light | Role |
|---|---|---|
| `--bg` | `#f1f2ee` | raw-cloth background (cool, not cream) |
| `--surface` | `#ffffff` | cards, rows |
| `--text` | `#1b2230` | ink |
| `--accent` | `#2b4a8b` | indigo: primary button, links, focus |
| `--good` | `#38763a` | sprout green: correct |
| `--bad` | `#a3392a` | madder red: wrong |

- Spend boldness in one place: the target-language **headword** set in `--font-word`. The stack is ui-serif → New York
  on Apple devices → Cambria. Cambria is the fallback because Georgia misplaces the Russian stress accent.
  Interface text is system sans.
- Avoid template tells:
  - ALL-CAPS eyebrow labels;
  - "A · B" meta strings (write a sentence or a small definition list);
  - "→" appended to buttons;
  - identical shadowed cards for everything.

  Prefer grouped list rows (`.rows` + `LinkRow`).
- **Layout:**
  - Left-aligned.
  - iPhone: one column with bottom tabs.
  - iPad (≥768px): sidebar. Today and Explore use two columns from 900px.
  - Lesson content max 640px wide.

## 8. Turkish copy

- Sentence case, plain verbs, from the learner's side.
- An action keeps its name through the flow: "Pratik cümlesini kaydet" → "Cümlen kaydedildi".
- Errors say what happened and what to do next, without apologising.
- Estimates are labelled as estimates ("yaklaşık", "bir tahmindir").
- No scientific claims for design choices.

## 9. Accessibility checklist (every UI change)

- [ ] Tap targets ≥44px; visible focus ring (`:focus-visible`); a skip link exists in the shell.
- [ ] Respects reduced motion (`data-motion='reduce'`) and the text-scale setting; long translations wrap, never truncate meaning.
- [ ] Target-language text carries `lang`; audio buttons have an `aria-label` naming the source; feedback uses `role="status"`.
- [ ] Works at 375×812 (phone) and 1180×820 (iPad landscape), light and dark.

## 10. Verifying a change

1. `npx vitest run`, `npx tsc --noEmit -p tsconfig.json`, `npm run build`.
2. Browser pane, phone size: Today → start (≤2 taps) → finish or leave → reload → resume.
3. Do destructive checks (Demo, import, broken audio) on the preview server (port 4173). Its data is separate from the
   dev server the owner may be using.
