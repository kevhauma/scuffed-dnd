# TICKET-CHAR-01 — Character list at `/play`

- **Area:** Characters
- **Type:** Feature
- **Traceability:** Requirements 11.1, 17.4, 21.1-21.5
- **Replaces plan items:** tasks.md §12.1

## User story

As a Player, I want to see all my characters and pick one to play, so that I can get back into a
character I created earlier instead of starting over each session.

## Description

Play mode has no UI at all yet — `/play` is a placeholder heading. This ticket builds the entry
point: a list of the Player's saved characters with a summary line each, a way into a character
sheet, a create button, and a confirmed delete. It is the first component in
`src/components/play/`, so it also sets the folder's shape for everything after it.

## Current situation (as-is)

- [`src/routes/play/index.tsx`](../../../src/routes/play/index.tsx) renders a hardcoded
  "Your characters will appear here." paragraph with stock Tailwind classes
  (`text-gray-600`) — not the medieval theme, no store access.
- [`src/components/play/`](../../../src/components/play/) is an empty directory.
- The data and actions already exist:
  [`useCharacterStore`](../../../src/stores/characterStore.ts) holds `characters: Character[]`
  with `loadCharacters()`, `deleteCharacter(id)`, and `getCharacter(id)`, and persists through
  `saveCharacters()` on every mutation.
- [`CharacterSummary`](../../../src/types/character.ts) (`id`, `name`, `raceIds`, `level`,
  `createdAt`) is declared for exactly this screen and currently unused — nothing derives `level`
  yet.
- The primitives to build with are in [`components/ui/`](../../../src/components/ui/index.ts):
  `Card`, `Button`, `Text`, `Dialog`.
- The pattern to copy is the config side, e.g.
  [`RacesConfigPanel`](../../../src/components/config/races/RacesConfigPanel.tsx) +
  [`useRaceManager`](../../../src/components/config/races/useRaceManager.ts) — panel renders,
  hook holds store selectors and handlers.

## Desired result (to-be)

- `src/components/play/characters/CharacterList.tsx` renders every saved character as a `Card`
  showing name, races (resolved from the configuration's `races`, by name not id), and a level
  summary derived from the character's total main-skill levels.
- A `useCharacterListManager` hook owns the store selectors, the delete-confirmation state, and
  the handlers; the component is layout and composition only.
- Selecting a character navigates to `/play/character/$id`; a "Create Character" button navigates
  to `/play/create`.
- Deleting asks for confirmation in a `Dialog` first, and only then calls
  `deleteCharacter()` — which persists via the store, not by touching storage directly.
- With no characters saved, an empty state explains what to do and offers the create action.
- With no configuration loaded, the screen says so and does not offer character creation — a
  character cannot exist without a ruleset.
- `/play` renders this component instead of its placeholder markup.

## Acceptance criteria

- [x] `/play` lists every character in `useCharacterStore`, each showing name, race names (not ids), and a derived level summary. (`CharacterList` + `CharacterCard` in `src/components/play/characters/`. Tests *"should render one card per character, with race names and a derived level"* and *"should show race names rather than ids, degrading gracefully for a deleted race"* — a `raceId` with no matching race renders "Unknown race" rather than the id or a crash. Browser: two seeded characters rendered as "Aria Swiftfoot / Level 11" and "Borin Stonefist / Level 11".)
- [x] Characters survive a page reload — the list renders from restored LocalStorage state (Req 17.4). (Restoration is TICKET-IO-01's root-layout hydration; this screen just reads the store. Browser: characters were written straight into `dnd_builder_characters` and appeared on a **fresh load** of `/play`, with no prior visit to any other route.)
- [x] "Create Character" navigates to `/play/create`; selecting a character navigates to `/play/character/$id`. (Tests *"should navigate to the creation wizard"* and *"should navigate to the character sheet when a character is opened"* assert the exact `navigate()` arguments. Browser: pressing Open on Aria moved the URL to `/play/character/char-a`, which still renders the task-12.3 placeholder sheet.)
- [x] Deleting requires an explicit confirmation step in a `Dialog`; cancelling leaves the character intact. (Tests *"should require confirmation before deleting, and delete the right character"* — asserts both characters are still present after the Delete button, before confirming — and *"should leave the character intact when the confirmation is cancelled"*. Browser: pressing Delete on the second card opened a dialog reading "Delete Borin Stonefist? This cannot be undone." with LocalStorage still holding 2 characters.)
- [x] Deletion goes through `useCharacterStore.deleteCharacter()`; no component calls `saveCharacters()` or `localStorage` directly. (`useCharacterListManager.handleConfirmDelete` calls the store action and nothing else; `grep` finds no `localStorage` or `saveCharacters` under `src/components/`. Browser: confirming reduced `dnd_builder_characters` to `["Aria Swiftfoot"]` and it stayed that way through a full reload.)
- [x] Empty state (no characters) and no-configuration state both render meaningful copy instead of an empty page. (Tests *"should show an empty state offering creation when there are no characters"* ("No Characters Yet") and *"should say there is no ruleset, and not offer creation, without a configuration"* ("No Ruleset Yet", and it asserts the Create button is **absent** — a character cannot exist without a ruleset).)
- [x] The component composes `Card` / `Button` / `Text` / `Dialog` from `components/ui`; no raw `<button>` in the new code, and no base component gains margin or positioning classes. (No raw `<button>`/`<input>` in `src/components/play/`. Layout classes — `flex`, `gap-*`, `max-w-4xl`, `space-y-3` — are passed by the feature components through `className`; no base component was edited.)
- [x] Styling uses medieval theme tokens only — no `text-gray-*` or other stock palette classes survive in `src/routes/play/index.tsx`. (The route is now four lines rendering `<CharacterList />`. Test *"should carry no stock Tailwind palette classes"* in `src/routes/play/playRoutes.test.tsx` reads the route source and asserts no `(text|bg|border)-(gray|slate|zinc|blue|green|red)-NNN` class remains, so a regression fails the suite rather than passing review.)
- [x] Store selectors, confirmation state, and handlers live in a `useCharacterListManager` hook, not in the component body. (`CharacterList.tsx` contains no `useState` and no store import; it destructures the hook and renders. The hook owns `pendingDeleteId`, both store selectors, race-name resolution and the five handlers.)
- [x] Unit tests cover: renders one card per character; empty state with zero characters; no-configuration state; delete confirmation calls `deleteCharacter` with the right id; cancelling the dialog does not. (+15 tests: `CharacterList.test.tsx` (8), `src/engine/characterSummary.test.ts` (4), `src/routes/play/playRoutes.test.tsx` (3). Suite: 512 passing, 0 failing, 0 skipped. **The ticket's note about new `useState` components landing in the known-failing bucket is stale** — TICKET-DX-01 fixed the React 19 hooks-dispatcher issue, so these render and pass normally.)
- [x] Verified via the fallow skill and the ~~react-conventions~~ **coding-conventions** skill *(renamed since the ticket was written)*. (`fallow audit --base HEAD` → `"verdict": "pass"`, 0 introduced findings. Its one initial finding — `PlayIndex` exported but never imported — is what prompted `playRoutes.test.tsx`, matching the config side's convention of exporting page components by name so tests can render them. Conventions: `components/play/` now mirrors `components/config/`'s domain-folder shape (card + list + `useXManager`), with an `export *` barrel at `src/components/play/index.ts`.)
- [x] Verified live in the browser: on `localhost:5173`, two characters seeded straight into LocalStorage appeared on a fresh `/play` load with correct derived levels; Open navigated to `/play/character/char-a`; Delete on Borin opened the confirmation naming him with both characters still stored; confirming removed him from the list and from `dnd_builder_characters`; and a full reload showed Aria alone. *(Seeded directly rather than through the wizard, which is TICKET-CHAR-02.)*

## Notes

- The level summary needs a definition. Simplest defensible one: the sum of the character's
  `mainSkillLevels` — say so in the code and keep it in one place, since `CharacterSummary.level`
  implies a single notion of "level" that later screens will reuse. If a richer definition is
  wanted, that is a requirements question for the User, not an implementation choice — ask.
  If it should reflect racial and equipment modifiers rather than raw allocation, it depends on
  [TICKET-CALC-01](./TICKET-CALC-01-calculated-character-assembly.md) and should wait for it.
- Race names come from the configuration's `races` array; a character whose `raceIds` reference a
  deleted race should degrade gracefully (show the id or "Unknown race"), not crash.
- This is the first component under `src/components/play/`, so it establishes the domain-folder
  shape there — panel + card + hook, mirroring `components/config/`. Add a `components/play/index.ts`
  barrel using `export *`.
- Components using `useState` currently hit the documented React 19 + Vitest hooks issue
  ([TEST_STATUS.md](../../../TEST_STATUS.md)); expect the new component tests to land in that same
  known-failing bucket, and say so rather than skipping them.
