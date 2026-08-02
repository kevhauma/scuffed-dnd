# Onboarding — Custom DnD Builder

Welcome! This document gets you from "just cloned the repo" to "confidently shipping a ticket".
Read it top to bottom once; after that, the [Where knowledge lives](#where-knowledge-lives) table
tells you which document answers which question, so you never have to re-read everything.

---

## 1. What is this app, and who is it for?

**Custom DnD Builder** is a browser-only React app for people who play tabletop RPGs (like
Dungeons & Dragons) but want to play with **their own homebrew ruleset** instead of an official
one.

It serves two personas, and the whole app is split along that line:

- **The User** (think: game designer / dungeon master) works in **Configuration mode**. They
  define the ruleset: which skills exist, how stats like health are calculated, what items and
  materials there are, which races give which bonuses, how the currency works.
- **The Player** works in **Play mode**. They create a character *on* that ruleset, allocate
  skill points, equip items, track their current health/mana, and roll dice for combat skills.

### The problem it solves

Homebrew rulesets normally live in spreadsheets, note apps, or on paper. Every derived number —
"your max health is `10 + CON * 2`", "this iron sword gives +2 melee" — has to be recalculated by
hand every time something changes. That is slow and error-prone, and sharing the ruleset with the
rest of the table means emailing a spreadsheet around.

This app makes the ruleset *executable*: the User writes the formulas once, the app validates them
(syntax, unknown references, circular definitions) and computes every derived value automatically.
Equip a different sword and your combat bonus updates; level up a main skill and your max health
follows. The ruleset is shared as a single JSON file via export/import.

### Deliberate constraint: no backend

There is **no server, no database, no account system**. Everything lives in the browser's
LocalStorage, and rulesets travel between browsers as exported JSON files. This is a feature, not
a shortcut — it keeps the app free to host, private by default, and usable offline. It also shapes
the code: "persistence" here means two JSON blobs in LocalStorage, and the TypeScript types in
`src/types/` *are* the schema.

---

## 2. The domain in ten minutes

These terms come from the spec glossary
([requirements.md](docs/v1.0_foundation/requirements.md#glossary)) and are used consistently in
code, docs, and tickets. Capitalised **User** and **Player** always mean the personas above.

| Concept | What it is |
|---|---|
| **Configuration** | The complete ruleset. The app holds exactly **one** at a time (a settled spec decision — spares live as exported JSON files). |
| **Main Skill** | A foundational skill with a unique **3-letter code** (`STR`, `WIS`, …), a level, and a max level. The building block everything else references. |
| **Stat** | A derived value (health, mana, speed) computed from main skills via a User-written **formula**, e.g. `10 + CON * 2`. Max is derived; the Player tracks the *current* value separately. |
| **Speciality Skill** | A skill with a Player-allocated base level **plus** a formula bonus derived from main skills. Also keyed by a 3-letter code. |
| **Combat Skill** | A rollable skill: a dice pool (`2d6 + 1d20`) plus a formula bonus. Also keyed by a 3-letter code. |
| **Formula** | A User-authored arithmetic expression referencing skill codes. Parsed and evaluated by our own formula engine — never `eval`. |
| **Material / Material Level** | A substance (iron, mithril) with tiers; each tier carries skill bonuses/penalties and a monetary value. |
| **Item / Equipment Slot** | An item optionally has a material and a slot type (helmet, main hand). Equipping it applies the material's bonuses. |
| **Race** | A lineage giving bonuses/penalties to main skills. Characters can have multiple. |
| **Focus Stat** | The one skill a character specialises in, granting bonus levels. |
| **Currency Tier** | A level in the money system (copper/silver/gold) with conversion rates. |
| **Character** | A Player's persona: chosen races, allocated skill levels, focus stat, inventory, and current stat values. Everything else about it is computed. |

One rule to burn in early: **skill codes are unique across all three skill kinds** (main,
speciality, combat), because they all share one formula namespace — a formula just says `MEL` and
the engine resolves it.

---

## 3. Setting up

### Prerequisites

- **Node.js 20.19+ (or 22+)** — Vite 7 requires it
- **Yarn v1 (classic)** — the repo uses a `yarn.lock` from Yarn 1

### Steps

```bash
git clone <repo-url>
cd scuffed-dnd
yarn install
git config core.hooksPath .githooks   # enables the pre-commit lint/format gate — do not skip
yarn dev                              # dev server on http://localhost:3000
```

Then verify your setup by running the checks the project lives by:

```bash
yarn run test        # Vitest, single pass — expect all green (660 passing as of this writing)
npx tsc --noEmit     # expect exactly 4 known errors (documented in TEST_STATUS.md)
yarn run check       # Biome lint + format + import sorting — expect zero findings
```

### ⚠️ The one command trap

`yarn check` (without `run`) does **not** run our check script — Yarn v1 has a builtin `check`
that shadows it and only verifies the lockfile, exiting green while telling you nothing. Always
type **`yarn run check`**. Same caution applies generally: prefer `yarn run <script>`.

### Everyday commands

```bash
yarn dev                 # dev server on :3000
yarn run test            # full test suite, single pass
npx vitest run <path>    # one test file
npx tsc --noEmit         # typecheck
yarn run lint            # biome lint only
yarn run check           # biome lint + format + import sorting
yarn build               # production build
```

---

## 4. How the code works

### The layer cake

`src/` is layered bottom-up, and **imports only ever point upward** in this list — engine code
never imports a store, a store never imports a component:

```
types/       Pure TypeScript type definitions. No runtime code. This is the "schema".
engine/      Pure functions: the formula parser/evaluator/validator, the derived-value
             calculators, dice rolling, config validation. No React, no storage.
services/    LocalStorage persistence (storage.ts) and JSON import/export (importExport.ts).
stores/      Zustand state: configStore, characterStore, uiStore. The ONLY layer that
             calls the storage service.
components/  ui/ (base primitives) → config/, play/, shared/ (feature components).
routes/      TanStack Router file-based routes. Thin: render a feature component, pass params.
```

### Data flow, end to end

1. **App start** — `RootLayout` (in `src/routes/__root.tsx`) calls `useAppHydration()`, which
   restores both persisted stores from LocalStorage once per page load. Nothing else reads
   storage at startup.
2. **The User edits the ruleset** — a config panel's hook calls a `useConfigStore` action → the
   action patches state **and** calls `saveConfiguration()` in the same action.
3. **The Player edits a character** — same shape via `useCharacterStore` → `saveCharacters()`.
4. **Anything shown as a number** — the component calls
   `calculateCharacter(character, config)` from `src/engine/calculator.ts` at render time. That
   one entry point composes all the calculators (equipment → main skills → stats → speciality →
   combat) and returns a `CalculatedCharacter`.
5. **Sharing** — export writes the `Configuration` to a JSON file; import validates the file's
   *structure* (`services/importExport.ts`) before applying, then validates its *references*
   (`engine/validator.ts`) and reports problems so the User can repair them in-app.

Two LocalStorage keys hold everything: `dnd_builder_config` (one `Configuration`) and
`dnd_builder_characters` (`Character[]`). All access goes through `src/services/storage.ts`.

### The formula engine

Every piece of User-authored math flows through `src/engine/formula/`:
`parseFormula` (string → AST) → `validateFormula` (syntax, referenced variables) →
`evaluateFormula` (AST + variables → number). It supports `+ - * /`, parentheses, unary
negation, numbers, and 3-letter skill-code variables. When a formula is about to be *saved*,
`validateFormulaChange(config, change)` additionally checks for circular dependencies and
undefined codes, and refuses the save with a user-facing message.

**Never** `eval`, **never** `new Function`, **never** hand-rolled arithmetic or scanning a
formula with `String.includes` — ask the parser.

### The component system

- **Base components** (`src/components/ui/` — Button, Input, Dialog, FormulaEditor, …) carry
  *intrinsic styling only*: colors, typography, padding, borders, focus states. They never set
  margin, flex/grid, `position`, z-index, or their own width — layout is always the **caller's**
  job, passed via `className`. A test (`libraryConventions.test.ts`) enforces this mechanically.
- **Feature components** (`components/config/`, `components/play/`) own all layout and compose
  the primitives. Never a raw `<button>` or `<input>` in a feature component.
- Each configuration domain follows the same **four-part shape** — copy it for new domains:
  - `XConfigPanel.tsx` — layout and composition only, no logic
  - `XCard.tsx` — renders one entity
  - `XFormDialog.tsx` — add/edit form (`react-hook-form`) in a `Dialog`
  - `useXManager.ts` — the hook holding store selectors, form state, and handlers
  - Exemplar to copy: `src/components/config/races/` (`useRaceManager.ts`).
- **Styling** is Tailwind v4 with a custom **medieval theme** defined in `src/styles.css`. Use
  theme tokens only: `parchment-*`, `ink-*`, `stone-*`, `crimson`, `forest`, `royal`, `amber`,
  `font-heading` / `font-body` / `font-mono`, `shadow-parchment*`. A `bg-blue-500` or a raw hex
  is a bug, full stop. Class strings live in a sibling `Name.style.ts` file, not inline in JSX.

### Routing

TanStack Router, file-based: files in `src/routes/` become routes. `/config/*` is Configuration
mode (dashboard, skills, stats, materials, items, races, currency, focus stat); `/play/*` is Play
mode (character list, creation wizard, character sheet).
**`src/routeTree.gen.ts` is generated — never edit it by hand.**

---

## 5. The hard rules

These are the project's non-negotiables (from [CLAUDE.md](CLAUDE.md)). Reviews will hold the line
on every one of them, so internalise them before writing code:

1. **Persistence belongs to the store action.** A component, hook, or engine module never calls
   `localStorage` or the storage service — it calls a Zustand action, which patches state *and*
   persists in one place. This is why a rule like "current stat values are clamped to the
   calculated maximum" can live in exactly one spot no caller can bypass.
2. **Derived values are computed, never stored.** If you feel the urge to save a computed number
   onto `Character`, the answer is a `calculateCharacter()` call at read time instead. The one
   sanctioned exception is `Character.currentStatValues` — current HP/mana is *player state*
   (its maximum is derived; its current value is a choice the Player made).
3. **All user-authored math goes through the formula engine.** See above.
4. **Base components carry intrinsic styling only; feature components own layout.** See above.
5. **Medieval theme tokens only.** No stock Tailwind palette, no hex literals. A new shade gets a
   named token in `styles.css`'s `@theme` block first.
6. **`src/routeTree.gen.ts` is generated** — never hand-edit.
7. **Skill codes are 3 letters and unique across all skill kinds.**
8. **Imports are relative**; new barrels use `export *`. (A `#/*` alias exists in `package.json`
   but is deliberately unused — don't half-adopt it.)
9. **No new runtime dependencies without asking.** The app stays browser-only.
10. **Never fix a failure by weakening the check** — no skipping tests, no suppressing lint to
    get green.

---

## 6. Where knowledge lives

The project keeps its knowledge in dedicated documents so nobody has to rediscover it by reading
code. **Check here before exploring manually:**

| Question | Read |
|---|---|
| What are the coding conventions in detail? | [.claude/skills/coding-conventions/SKILL.md](.claude/skills/coding-conventions/SKILL.md) |
| What are the data shapes / storage keys / migration rules? | [.claude/skills/data-model/SKILL.md](.claude/skills/data-model/SKILL.md) |
| Which route / store / engine module / component lives where? | [.claude/skills/project-map/SKILL.md](.claude/skills/project-map/SKILL.md) |
| What exactly is the app supposed to do? (numbered requirements) | [docs/v1.0_foundation/requirements.md](docs/v1.0_foundation/requirements.md) |
| Why is the architecture shaped this way? Theme contracts? | [docs/v1.0_foundation/design.md](docs/v1.0_foundation/design.md) |
| What's built, what's next, in what order? | [docs/v1.0_foundation/overview.md](docs/v1.0_foundation/overview.md) |
| What's the current test/typecheck/lint baseline? | [TEST_STATUS.md](TEST_STATUS.md) |
| How is `docs/` organised? Ticket prefixes? | [docs/README.md](docs/README.md) |

The `.claude/skills/` files double as instructions for Claude Code (the AI tooling this repo is
set up for), but they are written as ordinary developer documentation — read them as such. They
are **kept up to date by the ticket that changes the thing they describe**, so treat them as
authoritative; if you change behaviour they describe, update them in the same change.

### Requirements traceability

Almost every non-test module opens with a JSDoc block containing a line like
`**Validates: Requirements 8.1, 8.2, 21.1-21.5**`. Those numbers point into
[requirements.md](docs/v1.0_foundation/requirements.md). Two rules: only cite numbers you have
actually checked against that document, and if a file implements nothing on its own (barrels,
`types/`), leave the line out rather than inventing one.

---

## 7. How work happens

Work is **ticketed**. `docs/v1.0_foundation/overview.md` is the index in recommended build order;
each line links to a ticket file (`docs/v1.0_foundation/tickets/TICKET-<PREFIX>-<NN>-*.md`)
carrying a user story, the as-is / to-be, and acceptance criteria.

- New bug, refactor, or feature → write a ticket first (there's a `story-ticket` skill for this
  if you're working with Claude Code; otherwise mirror an existing ticket file's structure).
- Building a ticket → plan against its acceptance criteria, implement, tick each criterion **with
  evidence**, then check the line off in `overview.md`.
- Never implement straight from a plan line — expand it into a ticket first.
- **Commit messages**: ticket ID + title, e.g. `TICKET-CHAR-01 Create CharacterList component`.
  (Older commits use task numbers from the original plan, e.g. `11.8 Create FocusStatConfig
  component` — that's history, not the current convention.)

### Definition of done — every change

1. `npx vitest run` — **fully green**: 0 failures, 0 skips. The suite passes today; any failing
   or newly-skipped test is a regression you introduced.
2. `npx tsc --noEmit` — no errors beyond the **4 known ones** listed in
   [TEST_STATUS.md](TEST_STATUS.md).
3. `yarn run check` — **completely clean**. There is no lint baseline to subtract; anything it
   reports is yours. The pre-commit hook enforces this (that's why the `core.hooksPath` setup
   step matters).
4. A live browser check for anything UI-visible (`yarn dev`, port 3000).

---

## 8. Testing

- **Vitest + Testing Library**, tests colocated beside the source as `Name.test.ts(x)`, written
  as `describe('<Unit>')` / `it('should …')`.
- **Engine logic is tested directly** — pure functions, no React. `fast-check` property tests
  are used where numeric invariants matter (calculators, the parser); prefer them there.
- **Component tests mock the store module**
  (`vi.mock('../../../stores/configStore')` + `vi.mocked(useConfigStore).mockReturnValue(...)`)
  so components are isolated from persistence. Note: the mock must respect the *selector* —
  components subscribe with `useConfigStore((s) => s.config)`, and mocks that ignore the selector
  have caused broken tests before.
- **Randomness is injectable.** Dice code takes an optional `rng` argument — tests pass a
  deterministic one; never spy on `Math.random`.
- Tests run from **`vitest.config.ts`**, which is deliberately separate from `vite.config.ts`:
  the `tanstackStart()` plugin double-instantiates React under Vitest and breaks every hook.
  Don't merge the two configs — [TEST_STATUS.md](TEST_STATUS.md) has the full forensic story.

---

## 9. Gotchas and current known issues

- **`yarn check` ≠ `yarn run check`** — worth repeating; it will bite you exactly once.
- **Tailwind v4 stale CSS**: after adding a new theme token to `styles.css`, the dev server can
  serve a stale CSS bundle. Hard-reload the browser before concluding your token doesn't work.
- **`npx tsc --noEmit` is expected to show 4 errors.** They're enumerated in
  [TEST_STATUS.md](TEST_STATUS.md). New errors = your problem; those 4 = known baseline.
- **One known open bug** (found by integration testing, ticketed separately): a main skill that a
  character never allocated is missing from the formula context, so *adding* a main skill to a
  ruleset breaks every existing character's sheet with an `Undefined variable` error.
- **Some shipped tickets still carry an open in-browser verification criterion** (the User chose
  to defer those checks) — see "What is not done" in
  [overview.md](docs/v1.0_foundation/overview.md). Don't mistake the ticked lines for "verified
  in a browser".
- **Name collision to be aware of**: there are two functions called `validateConfiguration` —
  `services/importExport.ts`'s checks the *structure* of untrusted imported JSON;
  `engine/validator.ts`'s checks the *referential integrity* of a loaded config. They are not
  interchangeable.

---

## 10. A suggested first day

1. Set up per [section 3](#3-setting-up) and confirm the three checks pass.
2. **Use the app as the User**: `yarn dev`, open Configuration mode, and build a tiny ruleset —
   two main skills, one stat with a formula (`10 + STR * 2`), one combat skill with a dice pool,
   an item with a material bonus, a race.
3. **Use the app as the Player**: switch to Play mode, run the character creation wizard, open
   the character sheet, equip the item, watch the numbers move, roll the combat skill.
4. Skim [requirements.md](docs/v1.0_foundation/requirements.md)'s glossary and headings — you
   now recognise everything in it from step 2–3.
5. Read the three skill docs in `.claude/skills/` (conventions, data model, project map).
6. Pick one config domain (races is the exemplar) and read its four files top to bottom:
   panel → card → dialog → hook. Then read `src/engine/calculator.ts` and follow
   `calculateCharacter` down into one calculator.
7. Read one closed ticket file end to end to see what "done with evidence" looks like.

After that you're ready to pick up a ticket. Welcome aboard — and remember: `yarn *run* check`. 🗡️
