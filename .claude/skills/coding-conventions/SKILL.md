---
name: react-conventions
description: Component, store, and styling conventions for Custom DnD Builder's React/TypeScript code. Use when writing or reviewing any code in src/.
paths: "**/*.ts,**/*.tsx,**/*.css"
---

# Coding conventions

## Commands

```bash
yarn dev            # dev server on :3000
yarn run test       # vitest, single pass
npx vitest run <path>   # one file
npx tsc --noEmit    # typecheck
yarn run lint       # biome lint
yarn run check      # biome lint + format + import sorting
```

`yarn check` is **not** the check script — Yarn v1's builtin shadows it and only verifies the
lockfile. Always `yarn run check`.

## Layering

`types → engine → services → stores → components → routes`. Imports only ever point up that
list. Concretely: engine code is pure (no React, no `localStorage`), services own persistence,
stores own state + persistence calls, components own rendering, routes own params and composition.

## Files and naming

| Thing | Convention | Example |
|---|---|---|
| Component file | PascalCase `.tsx`, in its own folder | `ui/Button/Button.tsx` |
| Component styles | `Name.style.ts` beside it, exporting class-string constants | `Button.style.ts` |
| Component test | `Name.test.tsx` beside it | `Button.test.tsx` |
| Feature hook | `useXManager.ts` in the domain folder | `useRaceManager.ts` |
| Engine/service module | camelCase `.ts` | `statCalculator.ts` |
| Types | PascalCase `interface`, one domain per file in `types/` | `Configuration`, `Character` |
| Barrel | `index.ts` per folder | `components/config/index.ts` |

Every module opens with a short JSDoc block naming what it is. Modules that implement spec
requirements add a `**Validates: Requirements 8.1, 8.2, 21.1-21.5**` line to that block — this is
the code→requirements traceability link, and `spec-navigator` greps for it.

**The sweep is done** (TICKET-DX-03): 146 of 154 non-test modules carry one. Write the line when
you create the module, not later. Two rules on it:

- **Cite numbers you have checked** against `docs/v1.0_foundation/requirements.md`. A wrong line is
  worse than none, because `spec-navigator` will quote it as fact.
- **Not every file gets one.** The eight without a header implement nothing on their own — barrels
  (pure re-exports) and `types/` (declarations). If you cannot name the requirement, leave it out
  rather than inventing a plausible number.

**Barrels use `export *`** (design.md, "Code Organization Standards") — never enumerate named
exports. `components/ui/index.ts` predates the rule and enumerates; don't copy it, and don't
rewrite it as drive-by work either.

**Imports are relative within a root and aliased across one** (TICKET-DX-07). `src/` has three
roots — `shared/`, `client/`, `server/` — and inside one, an import stays relative
(`../../ui/Button/Button`). A crossing is spelled `#shared/engine/calculator`, never
`../../shared/engine/calculator`, so the boundary is legible at the import line and checkable by
prefix. `.dependency-cruiser.mjs` refuses the rest: `client/` and `server/` may each import
`shared/` and nothing of each other, and `shared/` imports neither. This reverses the old "the
`#/*` alias exists but nothing uses it" line — the three aliases are fully adopted, in the one
change where every import was being rewritten anyway.

**Base components are imported by deep path, not through the barrel** (TICKET-UI-01) — every call
site does, so match it. `components/ui/index.ts` is the folder's public listing; keep it complete
(a test asserts every primitive appears in it) but don't import from it. Feature barrels
(`config/index.ts`, `play/index.ts`, `shared/index.ts`) are the same: `export *`, kept complete,
and adding a component means adding its barrel line in the same change.

## Types and constants

**No bare string-union types.** A closed set of string values is declared once as a frozen const
object, and the type is derived from it:

```ts
export const STAT_ROUNDING = {
  NONE: 'none',
  NEAREST: 'nearest',
  UP: 'up',
  DOWN: 'down',
} as const;

export type StatRounding = (typeof STAT_ROUNDING)[keyof typeof STAT_ROUNDING];
```

Call sites then say `STAT_ROUNDING.NEAREST` — never `'nearest'` — in components, engine code,
fixtures and tests. Three things follow, and they are the reason for the rule:

- A rename is **one edit**, and a typo is a compile error rather than a value that silently never
  matches.
- The set **exists at runtime**. `Object.values(STAT_ROUNDING)` is the list a `<Select>` maps over
  and the array a shape validator checks against, instead of a second hand-written copy of the same
  four strings drifting beside the first — `CURVE_MODES` in
  [importExport.ts](../../../src/shared/services/importExport.ts) is that pattern already.
- Grepping the constant finds every use; grepping a bare literal finds every *coincidence*.

Two things stay unions. A union of **non-string members or object shapes** is a discriminated
union and is already the right tool (`FormulaAST`, `NumericEntry`). And a **base component's own
variant prop** may stay inline (`size?: 'sm' | 'md'`) — its `.style.ts` map is the const object
already, and the values never leave that component's props. The moment a second module names one
of those strings, it becomes a const object like everything else.

The rule applies to **new and reshaped** sets. Roughly a dozen bare unions predate it
(`StatRounding`, `RollCategory`, `StatAffinity`, `CurveInterpolation`, `FormulaOwner`,
`ValidationSeverity`, …); convert one when you are already changing it, not as drive-by work, and
don't report the untouched ones as findings.

## Design principles

Two families of judgement, both concrete here rather than generic.

**SOLID**, as this codebase already spells it:

- **Single responsibility** — the panel / card / form-dialog / `useXManager` split, one Zustand
  store per concern, one calculator per derived value. If a name needs "and" in it, it is two
  modules.
- **Open/closed** — `ConfigPanelShell` is extended through `headerExtra` and children, **never a
  prop per panel**; a new formula operator is a new AST node plus an arm in `applyBinary`, not a
  special case at the caller. A boolean named after one caller is the smell this rule catches.
- **Liskov** — every `components/ui` primitive forwards its native props and accepts `className`,
  so it is substitutable for the raw element it wraps. A primitive that swallows `onBlur` or
  refuses a `className` breaks this and breaks its callers.
- **Interface segregation** — props interfaces stay narrow: pass the three fields a card renders,
  not the whole `Configuration`. Subscribing with a selector rather than the whole store is the
  same rule applied to state.
- **Dependency inversion** — the layering rule *is* DIP. `engine/` knows nothing about React,
  `localStorage`, or any store; the direction of the arrow is the invariant, and a "small"
  upward import is the violation.

**KISS**, with the tie-breaks that matter:

- Prefer the boring construction. A `map` over a declared table beat thirteen hand-written
  checkers in CR-22 and is the shape to reach for again.
- **Abstract on the third instance, not the second** — and only when the instances differ in
  *data* rather than in *behaviour*. Two similar things are cheaper duplicated than wrongly shared.
- **No option, prop, or config flag that nothing uses yet.** Speculative generality is the most
  expensive kind, because it also has to be tested and explained.
- **Delete rather than deprecate.** There is no external consumer; a compatibility shim here is
  dead code with a polite name.
- When KISS and open/closed disagree, **KISS wins until a third caller exists**. The shell earned
  its extension points from eight copies of the same frame, not from anticipating them.
- A shorter diff a reader can hold in their head beats a cleverer one they have to reconstruct.

## Components

- **Function components, named exports**, typed props interface exported alongside
  (`export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>`).
- **Base components (`components/ui/`) carry intrinsic styling only** — colors, typography,
  padding, borders, radius, hover/focus/disabled states, transitions, shadows, intrinsic sizing.
  They must never contain margin, flex/grid, `position`, z-index, or parent-imposed width/height
  **on their outermost element — including `w-full`** (TICKET-UI-01: width is the caller's
  decision, passed as `className="w-full"`). Laying out a component's *own* sub-elements is fine,
  as is a modal or popover owning its placement. Every one accepts `className` so the caller can
  position it. `src/client/components/ui/libraryConventions.test.ts` asserts all of this, plus that each
  component has a `.style.ts` and appears in the barrel — run it before hand-auditing.
- **Theme tokens only inside `components/ui/`** — no `bg-white` (use `parchment-50`, the paper
  tone) and no hex literals. A new shade goes in `styles.css`'s `@theme` block as a named token
  first (`--color-royal-dark`, `--color-crimson-dark`, …). Note: Tailwind v4's dev server serves a
  stale CSS bundle after a new token is added — hard-reload before concluding it doesn't work.
- **Feature components own all layout** and compose base components — never a raw `<button>`,
  `<input>`, `<select>`, or `<textarea>` in `components/config/` or `components/play/`.
- Class strings live in the sibling `.style.ts` as `baseStyles` / `variantStyles` / `sizeStyles`
  constants joined from arrays, not inline template literals in the JSX.
- A domain folder in `components/config/` follows the four-part shape: `XConfigPanel` (layout and
  composition only) + `XCard` (one entity) + `XFormDialog` (add/edit) + `useXManager` (the hook).
  Follow it for new domains, including in `components/play/`.
- **A config panel's frame is `ConfigPanelShell`** (`config/shared/`, TICKET-DX-05), not
  hand-written. A new section is `if (!config) return <NoConfigurationNotice />` followed by one
  `<ConfigPanelShell title description actions prerequisites headerExtra blocked onCloseBlocked>`,
  with the list, cards and dialogs as children and `ConfigEmptyState` where a list is empty. All
  eleven config components compose it — copy
  [RacesConfigPanel.tsx](../../../src/client/components/config/races/RacesConfigPanel.tsx).
  If a panel needs something the shell doesn't offer, pass it as `headerExtra` or a child —
  **never add a prop per panel.** The shell exists because eight panels copied the frame and
  `BaseSkillPanel` had already drifted from them (h3 against h4); a shell with a boolean per caller
  would hide that kind of difference instead of sharing the frame.
- **Panels don't hold logic.** Store selectors, `react-hook-form` state, and handlers live in the
  `useXManager` hook; the panel destructures the hook and renders. **Every configuration domain now
  follows this** — the last exception, `FocusStatConfig`, was brought into line by TICKET-DX-03 and
  then deleted outright with the focus stat by TICKET-ARC-03, so there is no precedent left for
  putting store selectors or `useState` in a panel.
  Copy
  [useRaceManager.ts](../../../src/client/components/config/races/useRaceManager.ts) as the exemplar.
- Forms use `react-hook-form` (`useForm`, `form.reset(...)` on open) — no hand-rolled field state.

## State

- **Zustand, one store per concern**, created with `create<State>((set, get) => ({...}))`; the
  state type declares the actions alongside the data. Subscribe with a selector
  (`useConfigStore((s) => s.config)`), never the whole store, so panels don't re-render on
  unrelated changes.
- **Persistence belongs to the store action**: patch state, then call the storage service in the
  same action. Components never call `saveConfiguration`/`saveCharacters`/`localStorage`.
- **A store action with two destinations branches once, and the rule it applies is the Kernel's.**
  `rulesetSync.ts` and `characterSync.ts` are the two modules that know how the server is reached;
  `playerActions.ts` holds the rules both roots run. An action is then a line deciding *where* and a
  line saying *what* — see `characterStore.setInvestedStatPoints` (TICKET-PLY-01). A rule written in
  a store is a rule the server cannot call, which is how two implementations start.
- **Name a Kernel rule for what it does to the document, and the action for what the person did.**
  `equipToSlot` is the rule, `equip-item` is the `PLAYER_ACTION` the route and the Event log spell.
  Sharing one spelling across the two makes a duplicate export `fallow` will report and an
  `export *` can resolve ambiguously.
- **Named intents share one flat namespace, so who did something is part of the name.**
  `PLAYER_ACTION` and `DM_ACTION` (TICKET-DM-01) both supply the `event.type` column and the last
  segment of a route's path, so the DM's values carry a `dm-` prefix — `dm-set-resource` beside
  `set-resource`. Two identical spellings in one log is a reader six months later unable to tell a
  Player's own write from the DM's. The **pipeline** is shared for the same reason the names are not:
  `applyPlayerAction` runs either, and the guard above it is the whole difference.
- **Derived values are computed, never stored.** Anything downstream of a formula comes from
  `calculateCharacter()` (the one composed entry point) at read time — see the **data-model**
  skill for why `currentStatValues` is the one exception.
- Session-only UI state (open dialogs, roll history, active mode) lives in `useUIStore`, not in
  the persisted stores.

## Formulas

Every user-authored expression goes through the engine: `parseFormula` → `validateFormula` →
`evaluateFormula`. Never `eval`, never `new Function`, never a hand-rolled arithmetic pass.
A formula heading for the store goes through `validateFormulaChange(config, change)` first, in the
`useXManager` hook's save path — it refuses the save and returns the message to show. Never scan a
formula with `String.includes`; ask the parser via `validateFormula(f).referencedVariables`.
Validation errors are shown to the user (the `FormulaEditor` primitive already does this) rather
than thrown away; a formula referencing an unknown 3-letter code is a user-visible error, not a
crash. A field the User types a formula into also renders `FormulaPreview` beneath it — sample
values plus the level ladder — with the `FormulaOwner` for that attachment point, so scope and
resolvers match what the formula will see at play time (TICKET-FORM-08).

## Styling

- **Tailwind v4 utilities in the JSX**, no CSS modules, no CSS-in-JS. The only stylesheet is
  `src/client/styles.css`, which defines the medieval theme in an `@theme` block.
- **Use theme tokens, never raw hex or stock Tailwind colors**: `parchment-50…400`,
  `ink-600…900`, `stone-100…400`, `crimson`, `forest`, `royal`, `amber`, plus `font-heading`
  (Cinzel), `font-body` (Crimson Text), `font-mono`, and `shadow-parchment` /
  `shadow-parchment-lg`. A `bg-blue-500` or a `#8b2e2e` in a component is a bug.
- Keep contrast and focus rings intact — the theme is low-contrast by nature, so
  `focus:ring-2 focus:ring-amber` and friends are load-bearing, not decoration.

## Testing

- Vitest + Testing Library, `*.test.ts(x)` beside the source, `describe('<Unit>')` /
  `it('should …')`.
- Pure engine logic is tested directly with no React involved; `fast-check` property tests are
  available and used where numeric invariants matter — prefer them for calculators and the parser.
- Component tests mock the store module (`vi.mock('../../../stores/configStore')` +
  `vi.mocked(useConfigStore).mockReturnValue(...)`), so the component under test is isolated from
  persistence.
- **The suite is green** — 0 failing, 0 skipped (see [TEST_STATUS.md](../../../TEST_STATUS.md)).
  The React 19 + Vitest hooks-dispatcher failures were fixed by TICKET-DX-01; a failing or
  newly-skipped test is a regression, not background noise. Never skip a test to make a run look
  clean.

## Verification

Before calling any change done:

1. `npx vitest run` (or the affected files) — no new failures vs. TEST_STATUS.md
2. `npx tsc --noEmit` — no errors beyond the 2 in TEST_STATUS.md
3. `yarn run check` — **must be completely clean** (TICKET-DX-02 cleared it and a
   `.githooks/pre-commit` hook holds the line). `npx biome check --write .` fixes the mechanical
   ones; formatting is settled, so this is no longer a mass-reformat hazard
4. **fallow** — a check, not an optional review. If the skill isn't available in the session, say
   so rather than skipping silently.

   ```bash
   fallow audit --base main            # changed-code risk for this branch
   fallow dead-code                    # unused files, exports, types, dependencies
   fallow health --hotspots --since 6m # complexity, plus churn × complexity per file
   ```

   Three of its outputs are findings rather than noise:

   - **Dead code the change introduced** — an export nothing imports, a type nobody names, a file
     the refactor orphaned, a dependency that lost its last user. Delete it in the same change.
     The app has no external consumers, so nothing here is "kept for later"; an unused export is
     a claim that something uses it.
   - **Complexity** — a function `fallow health` flags on cyclomatic or cognitive score, or a new
     entry in its refactoring targets. Split it while you still remember what it does. A function
     that grew past the threshold *in your diff* is yours even if it was already large.
   - **Accelerating hotspots** — `fallow health --hotspots` scores each file by churn ×
     complexity and tags its velocity `Accelerating`, `Stable`, or `Cooling`. **Accelerating**
     means a file is being edited more often *and* getting harder to edit, which is the pair that
     precedes a rewrite. A file your change touched that comes back Accelerating gets recorded in
     [TEST_STATUS.md](../../../TEST_STATUS.md)'s hotspot table with the ticket that moved it, so
     the trend is visible across tickets instead of rediscovered every six months. Use
     `fallow health --save-snapshot` and `fallow health --trend` so the deltas are measured rather
     than remembered.

5. A live browser check for anything UI-visible (`yarn dev`, port 3000)
