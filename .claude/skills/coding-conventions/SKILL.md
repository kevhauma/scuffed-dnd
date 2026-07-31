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
the code→requirements traceability link, keep adding it.

**Barrels use `export *`** (design.md, "Code Organization Standards") — never enumerate named
exports. `components/ui/index.ts` predates the rule and enumerates; don't copy it, and don't
rewrite it as drive-by work either.

Imports are relative (`../../ui/Button/Button`). The `#/*` → `./src/*` alias exists in
`package.json` but nothing uses it — don't introduce it in one file and leave the codebase split.

## Components

- **Function components, named exports**, typed props interface exported alongside
  (`export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>`).
- **Base components (`components/ui/`) carry intrinsic styling only** — colors, typography,
  padding, borders, radius, hover/focus/disabled states, transitions, shadows, intrinsic sizing.
  They must never contain margin, flex/grid, `position`, z-index, or parent-imposed width/height.
  Every one accepts `className` so the caller can position it.
- **Feature components own all layout** and compose base components — never a raw `<button>`,
  `<input>`, `<select>`, or `<textarea>` in `components/config/` or `components/play/`.
- Class strings live in the sibling `.style.ts` as `baseStyles` / `variantStyles` / `sizeStyles`
  constants joined from arrays, not inline template literals in the JSX.
- A domain folder in `components/config/` follows the four-part shape: `XConfigPanel` (layout and
  composition only) + `XCard` (one entity) + `XFormDialog` (add/edit) + `useXManager` (the hook).
  Follow it for new domains, including in `components/play/`.
- **Panels don't hold logic.** Store selectors, `react-hook-form` state, and handlers live in the
  `useXManager` hook; the panel destructures the hook and renders. Copy
  [useRaceManager.ts](../../../src/components/config/races/useRaceManager.ts) as the exemplar.
- Forms use `react-hook-form` (`useForm`, `form.reset(...)` on open) — no hand-rolled field state.

## State

- **Zustand, one store per concern**, created with `create<State>((set, get) => ({...}))`; the
  state type declares the actions alongside the data. Subscribe with a selector
  (`useConfigStore((s) => s.config)`), never the whole store, so panels don't re-render on
  unrelated changes.
- **Persistence belongs to the store action**: patch state, then call the storage service in the
  same action. Components never call `saveConfiguration`/`saveCharacters`/`localStorage`.
- **Derived values are computed, never stored.** Anything downstream of a formula comes from
  `calculateCharacter()` (the one composed entry point) at read time — see the **data-model**
  skill for why `currentStatValues` is the one exception.
- Session-only UI state (open dialogs, roll history, active mode) lives in `useUIStore`, not in
  the persisted stores.

## Formulas

Every user-authored expression goes through the engine: `parseFormula` → `validateFormula` →
`evaluateFormula`. Never `eval`, never `new Function`, never a hand-rolled arithmetic pass.
Validation errors are shown to the user (the `FormulaEditor` primitive already does this) rather
than thrown away; a formula referencing an unknown 3-letter code is a user-visible error, not a
crash.

## Styling

- **Tailwind v4 utilities in the JSX**, no CSS modules, no CSS-in-JS. The only stylesheet is
  `src/styles.css`, which defines the medieval theme in an `@theme` block.
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
- **The suite is not currently green** — see [TEST_STATUS.md](../../../TEST_STATUS.md). All
  failures are one React 19 + Vitest hooks-dispatcher issue affecting components that call
  `useState`. "Tests pass" means *no new failures beyond that documented set*. Do not skip a test
  to make a run look clean; if you add a component that hits the same issue, say so.

## Verification

Before calling any change done:

1. `npx vitest run` (or the affected files) — no new failures vs. TEST_STATUS.md
2. `npx tsc --noEmit` — clean
3. `yarn run lint` — no new errors (the repo has 35 pre-existing lint errors and formatting drift;
   don't mass-reformat, match the file you're in)
4. The **fallow** skill for code-quality review, if available in the session — if it isn't, say so
   rather than skipping silently
5. A live browser check for anything UI-visible (`yarn dev`, port 3000)
