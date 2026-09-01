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

**A term a surface renders is reported by the engine, factor *and* contribution** (TICKET-SKL-05).
When a derivation gains a multiplier or a scaler that a breakdown has to show, the calculator emits
both the factor (`×2.1`) and what it did to that particular value (`+5.7`), because only the
calculator holds the intermediate — a component given the factor alone must multiply to render the
row, and a component that multiplies can disagree with the total it sits beside. The corollary is a
display rule: a breakdown's rows must still **sum** to the number above them, so a multiplicative term
is spelled as the difference it made rather than as a bare factor in a column of addends.

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
(`StatRounding`, `RollCategory`, `StatAffinity`, `CurveInterpolation`, `ValidationSeverity`, …);
convert one when you are already changing it, not as drive-by work, and don't report the untouched
ones as findings.

**Two have since been paid, back to back, and both were paid for the same trigger — a ticket adding
a member.** `FormulaOwner` → `FORMULA_OWNER` (TICKET-SPL-03, adding `spell-effect`) and
`ReferenceTargetKind` → `REFERENCE_TARGET_KIND` (TICKET-PAS-01, adding `passive`). That is what
*converted when touched* means in practice: not *when you happen to read it*, but **when your diff
reshapes the set**. Two things the second conversion learned that the first did not have to:

- **Do the whole sweep in the same change.** Seventeen `guardedDelete` call sites, two
  `findReferences` ones and the walker table's keys all moved together; half a conversion is worse
  than none, because a grep for the constant then finds a subset and reads as complete.
- **A test that greps source is coupled to the source's punctuation.** `referenceArms.test.ts` reads
  `REFERENCE_WALKERS` as *text* to prove each arm was written; computed keys would have made every
  row of that guard pass by matching nothing. Converting a set means checking whether anything
  **scans** for its old spelling — the compiler will not tell you.

**Exhaust a set with a `Record`, not with a `never` default, once there are more than a handful of
arms.** A `switch` whose cases are a flat lookup pays a cyclomatic point per case and `fallow` will
eventually say so — `describeAdjustment` hit 23 at fourteen `DM_ACTION` cases (TICKET-DM-02), as
`findReferences` hit 24 before SPL-01 (see `REFERENCE_WALKERS`). `Record<TheUnion, (…) => T>` is the
same dispatch said properly, and its exhaustiveness is **stronger** than the `never` it replaces: a
missing key fails at the declaration, naming the key, and so does a key for a value that no longer
exists — where a `never` default catches only the first, at the bottom of a function. Keep a runtime
fallback when the input is *stored history* rather than a live type (an Event row written by a
version that named an action since retired is a true record, not a crash).

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
- **The third caller is a debt the ticket that creates it pays** — extract then, in the same change,
  never "later". TICKET-ITEM-01 is the worked example: two copies of a group-by-a-free-string mapper
  had been left standing on purpose (`Stat.group`, `Inlay.group`), and the ticket that added
  `Item.shop` moved all three onto `components/shared/labelledGroups.ts` rather than writing a third.
  **Check whether it really is a third instance first**: the same ticket declined to extract
  `modifiableStats`, because *the skills a bonus may target* is `config.skills` — not the
  sort-and-filter-out-derived-stats expression it superficially resembles. Two look-alikes that differ
  in *behaviour* stay duplicated.
- **A panel must never write a document its own importer refuses.** The identity gates are stated in
  two places on purpose (the hook's form and the import shape gate), and the failure mode is always
  the same: the writer's rule is *narrower* than the gate's. TICKET-ITEM-01's case is the one to
  remember, because it looks like a rounding detail — a number box registered
  `{ valueAsNumber: true }` yields **`NaN`** when cleared, not `0`, so a `!== 0` filter passes it, the
  value serialises as `null`, and the app's own gate then rejects the file on re-import. Filter on
  `Number.isFinite` in any writer that decides which rows are worth storing.
- **A shared component whose prop names the caller it was written for is a rename waiting to happen.**
  `StatValueRowsField` took `availableStats: Stat[]` for three stat callers; a fourth naming *skills*
  made the name false, so it became `ValueRowsField` over `options: RowOption[]` with
  `statRowOptions(stats)` beside it. Widen the parameter and rename in the same change — do not add a
  second component with the same markup.
- **A stored value that is exactly a function of two others is a bug with a schedule.** It is kept
  correct by discipline in every action that writes either input, and the first one that forgets is
  silent. TICKET-INV-06's `Inventory.miscItems` is the worked example: it held precisely
  `composedItems − worn`, five separate actions maintained it, and INV-05's review caught one of them
  leaving a build in neither place — invisible to every surface and still blocking the delete of the
  material it was made of. **Delete the field and derive it**, even when the sweep is wide (that one
  cost a one-line fixture edit in 40 files); the alternative is guarding an invariant forever.
- **When two named things become one implementation, retire a name — do not keep an alias.** INV-05
  left `equipToSlot` and `moveItemToEquipment` as one body with two names because the two *acts* were
  still distinct in the API's vocabulary; when INV-06 made *unequip* and *stow* the same act too, four
  intents for two acts was the answer to delete rather than to document. A wrapper that exists only so
  a second spelling keeps compiling is *Delete rather than deprecate* wearing a routing table.
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
  config components compose it — copy
  [RacesConfigPanel.tsx](../../../src/client/components/config/races/RacesConfigPanel.tsx).
  If a panel needs something the shell doesn't offer, pass it as `headerExtra` or a child —
  **never add a prop per panel.** The shell exists because eight panels copied the frame and
  `BaseSkillPanel` had already drifted from them (h3 against h4); a shell with a boolean per caller
  would hide that kind of difference instead of sharing the frame.
- **A panel whose entity arrives in the hundreds narrows before it draws** (TICKET-SPL-01). Most
  config sections list everything, because a ruleset has nine stats and a couple of dozen materials;
  the spell compendium has 418 rows, and a flat list of them is a section nobody can find anything
  in. The shape is a search box in `headerExtra` plus a page slice, both decided in the hook —
  **filter first, then page**, so the header counts the whole match rather than the page, and typing
  resets to page 1. Copy
  [useSpellManager.ts](../../../src/client/components/config/spells/useSpellManager.ts); a panel with
  four rows does not need it and should not grow it.
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
- **An optional stored field's default belongs to a named reader in the Kernel, not to its call
  sites.** `Character.dreamLevel` is optional and absent-means-1, and every consumer goes through
  `dreamLevelOf` (TICKET-RES-04) rather than spelling `?? 1` — the header, the setter's before/after
  and the gain formula that multiplies by it then cannot disagree about what an untouched character
  is, and the day the neutral value is questioned there is one line to argue about. The reader
  returns a stored number **as it stands**: the setter owns the floor, and a clamp in the reader
  would be a second, silent rule competing with a refusal the Player was shown.
  **The corollary, from TICKET-ARC-04: a Kernel function that needs such a value takes it as a
  *required* parameter and never re-derives it.** `statGain(pointsSpent, affinity, curve,
  dreamLevel)` has no default and no `Character` argument — the callers that hold a character read
  `dreamLevelOf` and pass the number. A defaulted parameter would have been the second rule the
  reader exists to prevent, one file further down.
- **When a surface's write depends on *who is reading*, that decision is a hook of its own — never a
  ternary in the component and never a prop threaded down.** Three instances now, which is what makes
  it a convention: `usePassiveHandout` (TICKET-PAS-01), then `usePurseControls` and
  `useInventoryActs` (TICKET-DM-02). Each returns the **bound pair** — the Player's own store actions
  or the DM's `dm-` ones — or `null` for a reader who may not act, so the component renders what it is
  given and the panel beneath it never learns a DM exists. Two reasons it keeps earning its place:
  *laying a surface out* and *deciding who may act on it* are different subjects, and the cost of
  mixing them has twice been a `fallow` measurement rather than a matter of taste — `CharacterSheet`
  at PAS-01, and `useDmControls` over the cognitive threshold mid-build at DM-02. At DM-02
  `useInventoryManager` was kept out of that by the same move **before** it was measured, and its
  hotspot density fell 0.24 → 0.22 for it; treat that one as the pattern paying off rather than as a
  third threshold breach. **`null` rather than a pair of no-ops** is the
  point: an absent control says *not yours* where a disabled one says *not now*. A read-only
  **display** of the same value is not a disabled control and is often the right thing to keep —
  `PurseSection` shows a Player at a table their coin with no box.

  **Scope such a hook to the actions its own surface calls, not to an actor's whole repertoire.**
  DM-02's first draft answered *which actor* with a bundle of all six of the DM's belongings actions;
  `usePurseControls` used two of them and `useInventoryActs` the other four, so each subscribed to
  writes it never made — the same defect as the fourteen-handler hook the bundle was extracted from,
  one size down. What the surfaces share is the **predicate** (`useIsDungeonMaster`), and that is what
  gets extracted; the handlers stay with whoever calls them. A shared bundle is worth having only once
  a caller genuinely wants the whole of it.
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

**System arithmetic rounds through the formula library's exports, not through `Math`.** A calculator
that mirrors one of the sheet's rounding functions imports `roundHalfAwayFromZero` (Excel `ROUND`) or
`roundAwayFromZero` (Excel `ROUNDUP`) from `engine/formula/functions.ts`, so the engine and a User
formula spelling `round`/`roundup` cannot answer differently — `Math.round(-0.5)` is `-0` and
`Math.ceil(-1.5)` is `-1`, where both sheet functions break away from zero. **`roundAwayFromZero`
settles binary noise to 15 significant digits before it rounds** (TICKET-SKL-04, Excel's own rule):
`0.2 × 12 + 0.1 × 6` is `3.0000000000000004` as a double, and rounding that up buys a whole extra
unit at every integer boundary. The settle lives **inside that one function**, so `FORMULA_FUNCTIONS`'
`roundup`, the race blend and the skill calculator cannot diverge; a settle written into a calculator
instead would have made the promise above false. `round` needs none (noise never crosses a `.5`
boundary), and `rounddown`/`floor`/`ceil` are deliberately left literal — see that function's JSDoc,
which is where the decision is recorded and where a ticket that gives one of them a system caller
should re-open it.

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
- **When a reshape puts a new id layer under an existing one, let the fixture's ids agree**
  (TICKET-INV-05). `equippedItems` came to hold a `ComposedItem.id` where it held an `Item.id`, and
  the fixtures that keep reading `{ main_hand: 'item-sword' }` — with a build whose `id` *is*
  `item-sword` — are the ones whose cases still say what they are about. Spell the new layer out only
  where it is the subject: the composition tests name `build-1` because the indirection is the point,
  and `calculator.test.ts` does not because equipment bonuses are. A `holding(...)` / `wielder(...)`
  builder that derives the ids is better than either when a case needs several.
- **A boundary suite is split per entity, not per layer** (TICKET-SPL-01). `importExport.test.ts`
  grew one per-entity `describe` per shape ticket until it was 1,522 lines and sixteen blocks; it is
  now `importExport.<collection>.test.ts` per entity, mirroring `ENTITY_SPECS`, with the service's
  own contract — required fields, the collection tables, the version gate, the configuration-level
  retired fields — left in the parent. Two rules make the split stay mechanical: **a whole
  `describe` moves and a loose `it` does not**, and **a field retired from an *entity* goes with
  that entity** rather than with the configuration's own retirements. A new `ENTITY_SPECS` row is a
  new file.
- **Test code is in scope for the no-nested-calls rule, all of it** (settled by the User at
  TICKET-DX-09). CLAUDE.md's *never call a function as the argument of another call* has no test
  exemption and no assertion exemption — **arrangement, act and assert alike**:

  ```ts
  // assert
  const level = skillLevelOf(character, skill, config);
  expect(level).toBe(12);

  // arrange — the same rule, and the half that is easiest to forget
  const bytes = JSON.stringify(config);
  localStorage.setItem(CONFIG_KEY, bytes);
  ```

  rather than `expect(skillLevelOf(character, skill, config)).toBe(12)` or
  `localStorage.setItem(CONFIG_KEY, JSON.stringify(config))`. A matcher's argument counts too — bind
  the expected value rather than passing a call into `toEqual(…)`.

  **Three things are not nesting**, here or anywhere else, and they cover most of what a test does:

  1. a **method chain** — `vi.mocked(useConfigStore).mockReturnValue(…)`, an awaited
     `screen.findByRole(…)`, `items.filter(…).map(…)`;
  2. a **function passed by reference or as an inline callback** — `expect(fn).toHaveBeenCalled()`,
     `expect(() => cast(…)).toThrow()`, `it.each(rows)`, `useMemo(() => …, [])`;
  3. **JSX as an argument** — `render(<Component … />)`, which is an element rather than a call.

  **This was being half-applied, which is why it is written down**: RACE-04, SKL-05 and INV-04 each
  converted a handful of sites while adding ten to thirty more, because `expect(f(x))` is the suite's
  pervasive existing form. The existing sites are swept in **one mechanical change under
  TICKET-DX-10**, never opportunistically per ticket — a file half-converted disagrees with its own
  neighbours and settles nothing. **That sweep is scoped to the assertion forms**, which are the
  measurable and dominant bulk; an arrangement site in a file the sweep touches is converted in the
  same pass rather than left as a second debt. Until it lands: **new test code follows the whole
  rule, old test code is left alone**, and pre-existing nesting is not a review finding.

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
