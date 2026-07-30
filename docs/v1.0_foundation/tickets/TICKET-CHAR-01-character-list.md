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

- [ ] `/play` lists every character in `useCharacterStore`, each showing name, race names (not ids), and a derived level summary.
- [ ] Characters survive a page reload — the list renders from restored LocalStorage state (Req 17.4).
- [ ] "Create Character" navigates to `/play/create`; selecting a character navigates to `/play/character/$id`.
- [ ] Deleting requires an explicit confirmation step in a `Dialog`; cancelling leaves the character intact.
- [ ] Deletion goes through `useCharacterStore.deleteCharacter()`; no component calls `saveCharacters()` or `localStorage` directly.
- [ ] Empty state (no characters) and no-configuration state both render meaningful copy instead of an empty page.
- [ ] The component composes `Card` / `Button` / `Text` / `Dialog` from `components/ui`; no raw `<button>` in the new code, and no base component gains margin or positioning classes.
- [ ] Styling uses medieval theme tokens only — no `text-gray-*` or other stock palette classes survive in `src/routes/play/index.tsx`.
- [ ] Store selectors, confirmation state, and handlers live in a `useCharacterListManager` hook, not in the component body.
- [ ] Unit tests cover: renders one card per character; empty state with zero characters; no-configuration state; delete confirmation calls `deleteCharacter` with the right id; cancelling the dialog does not.
- [ ] Verified via the fallow skill and the react-conventions skill.
- [ ] Verified live in the browser: create a character in LocalStorage (or via the wizard once TICKET-CHAR-02 lands), reload `/play`, confirm it appears, navigate into it, then delete it and confirm it disappears and stays gone after a reload.

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
