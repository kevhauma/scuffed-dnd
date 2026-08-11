# TICKET-DX-05 — One shell for every configuration panel

- **Area:** Developer experience / conventions
- **Type:** Refactor
- **Traceability:** Requirements 21.4, 21.5, 21.7 (feature components compose base components, own their layout, and stay visually consistent); Concept [00 §1.1](../../excel%20export%20summary/concepts/00-cross-cutting.md) (every configuration section reads the same way)

## User story

As a Developer, I want a configuration panel's frame to exist in one place, so that adding a
section is naming it rather than copying a neighbour — and so a change to how a section reads
happens once instead of eight times.

## Description

Every configuration domain opens the same way: refuse to render without a ruleset, then a header
Card carrying a title, a description and an "Add X" button, then either an empty-state Card or the
list. It is written out longhand in eight panels. The shell already exists for the two skill
panels — [`BaseSkillPanel`](../../../src/components/config/skills/shared/BaseSkillPanel.tsx) — and
has already drifted from the eight that don't use it, which is the cost this ticket is really
about.

## Current situation (as-is)

- **The same block, eight times.** `fallow dupes` reports it as the largest clone family in the
  codebase — three overlapping groups of 28–31 lines each, spanning
  [`ConstantsConfigPanel`](../../../src/components/config/constants/ConstantsConfigPanel.tsx),
  [`CurrencyConfigPanel`](../../../src/components/config/currency/CurrencyConfigPanel.tsx),
  [`CurvesConfigPanel`](../../../src/components/config/curves/CurvesConfigPanel.tsx),
  [`EquipmentSlotsConfigPanel`](../../../src/components/config/items/EquipmentSlotsConfigPanel.tsx),
  [`ItemsConfigPanel`](../../../src/components/config/items/ItemsConfigPanel.tsx),
  [`MaterialsConfigPanel`](../../../src/components/config/materials/MaterialsConfigPanel.tsx),
  [`RacesConfigPanel`](../../../src/components/config/races/RacesConfigPanel.tsx) and
  [`StatsConfigPanel`](../../../src/components/config/stats/StatsConfigPanel.tsx). The pieces are:
  1. the no-ruleset guard — a `Card` reading *"No configuration loaded. Please initialize a
     configuration first."*, byte-identical in all eight (plus
     [`FocusStatConfig`](../../../src/components/config/focus/FocusStatConfig.tsx), which has the
     guard but no add button);
  2. `<div className="space-y-6">` wrapping a header `Card` with
     `<div className="flex justify-between items-start mb-4">`, an `h4`-variant title, a
     `body-secondary` description and a primary "Add X" `Button`;
  3. an optional amber prerequisite warning (`bg-amber/10 border border-amber`, **7 occurrences**)
     saying which other section has to be filled in first;
  4. an empty-state `Card` reading *"No X configured yet. Click 'Add X' to create your first …"*.
- **The shell already exists, for two of ten panels.**
  [`BaseSkillPanel`](../../../src/components/config/skills/shared/BaseSkillPanel.tsx) takes
  `title` / `description` / `addButtonText` / `emptyMessage` / `blocked` plus two render props, and
  `SpecialitySkillsPanel` and `CombatSkillsPanel` use it. It is the proof the abstraction works —
  and the reason the drift is visible.
- **It has already drifted.** `BaseSkillPanel` renders `variant="h3"`, `flex flex-col gap-6` and
  `items-center`; all eight longhand panels render `variant="h4"`, `space-y-6` and `items-start`.
  Two configuration sections therefore have a visibly different heading size and spacing from the
  other eight, which is exactly what Requirement 21.7 exists to prevent. Nobody chose this; it is
  what happens when the frame is copied rather than shared.
- **It is a standing tax on the entity tickets.** RACE-01 changed one line of `RacesConfigPanel`'s
  header text and `fallow audit` reported three introduced clone groups, because touching any
  instance re-attributes the whole family. Every remaining v2.0 entity ticket will do the same.

## Desired result (to-be)

- A `ConfigPanelShell` in [`config/shared/`](../../../src/components/config/shared/) — the
  cross-domain home the `useGuardedDelete` / `BlockedDeleteDialog` pair already established — owns
  the frame: the no-ruleset guard, the header Card, the optional prerequisite warnings, the
  empty state, and the `BlockedDeleteDialog` every panel already mounts.
- **The shell is a feature component, not a base one.** It composes `Card` / `Text` / `Button` from
  `components/ui` and owns the layout classes; no base component gains a margin, a flex property or
  a heading size (Requirements 21.3, 21.5). It lives under `config/`, so `components/ui/` is
  untouched by this ticket.
- Each panel keeps owning what is genuinely its own — the list, the cards, the form dialog, and any
  section-specific affordance (the stats panel's reorder hint, the constants panel's `const.*` tip)
  — and passes them as children or render props rather than having the shell grow a flag per
  panel.
- `BaseSkillPanel` is rebuilt on the same shell rather than left beside it, so ten panels resolve
  to one frame and the h3/h4 divergence is settled by picking one.
- The **coding-conventions** skill records the shell as the way to add a configuration section, so
  the next domain composes it instead of copying a neighbour.

## Implementation notes

1. **The no-ruleset guard stayed an early return, rendering a shared `NoConfigurationNotice`.**
   The to-be says the shell owns the guard; it owns the *notice*, and each panel still writes
   `if (!config) return <NoConfigurationNotice />`. Two reasons, both hard: `children` is evaluated
   at the call site, so a shell that decided internally would still have run
   `config.materials.filter(…)` and thrown; and the early return is what narrows `config` from
   `Configuration | null` for TypeScript inside the panel. The duplicated six lines of JSX are gone,
   which is what the criterion was actually protecting — one line of control flow is not the clone.
2. **`ConfigEmptyState` is a sibling of the list, not a shell prop.** An `isEmpty`/`emptyMessage`
   pair on the shell could only ever speak for one list, and materials (categories) and items
   (slots *and* items) have more than one. `ItemsConfigPanel` keeps its own inline empty *text*
   because it sits inside the items Card and varies with the category filter — it is not an
   empty-state Card, so no panel writes one of those any more.
3. **`actions` is a `ReactNode`, not a label/handler pair.** Items offers two buttons; one slot
   that expresses both beats two props that express one each, and it keeps the shell from growing
   a prop per panel — the failure mode the ticket's own Notes warn about.
4. **`prerequisites` is `string[]`, not nodes.** The amber box around the sentence was itself
   copied seven times, so the shell owns the box and the caller owns only the sentence.

## Acceptance criteria

- [x] `ConfigPanelShell` exists in `components/config/shared/`, is exported from `config/index.ts`, and carries a `**Validates: Requirements 21.4, 21.5, 21.7**` header. ([`ConfigPanelShell.tsx`](../../../src/components/config/shared/ConfigPanelShell.tsx) exporting `ConfigPanelShell` + `NoConfigurationNotice`, and [`ConfigEmptyState.tsx`](../../../src/components/config/shared/ConfigEmptyState.tsx) beside it; both barrel lines added to `config/index.ts` in the same change.)
- [x] All ten configuration panels render through it — the eight longhand ones plus the two skill panels via a rebuilt `BaseSkillPanel`. No panel still writes the no-ruleset guard, the header Card or the empty-state Card inline. (**Eleven** components in the end: the eight, `BaseSkillPanel` for the two skill panels, and `FocusStatConfig` — the partial case the Notes flagged, which takes the shell with `actions` omitted. `git grep -l "No configuration loaded" -- 'src/components/**'` now matches **no component** — only `ConfigPanelShell.tsx` itself, two test files asserting the message, and the two skill manager hooks where it is a `react-hook-form` validation string, which is a different thing. The final AC↔diff pass caught the two skill panels still writing the guard Card inline behind `BaseSkillPanel`; they were fixed before this box was ticked. See implementation notes 1 and 2 for what the shell does *not* own.)
- [x] The h3/h4, `space-y-6`/`flex gap-6` and `items-start`/`items-center` divergences are resolved to one set of values, and the choice is stated in the ticket rather than left implicit. (**`h4` / `space-y-6` / `items-start`** — the eight longhand panels' values, so ten of eleven sections are unchanged and `BaseSkillPanel` is the one that moves. `items-start` is also the better of the two on its merits: with a two-line description, `items-center` floats the add button into the middle of it.)
- [x] The shell composes `components/ui` primitives only; no base component gains a layout, spacing or typography-size style, and `components/ui/` is not modified by this ticket (Requirements 21.3, 21.5). (The shell composes `Card` and `Text`; every layout class — `space-y-6`, `flex justify-between items-start mb-4`, `flex gap-2` — is on its own `div`s. `git diff --name-only` lists no file under `src/components/ui/`.)
- [x] Theme tokens only — `parchment-*`, `ink-*`, `stone-*`, `amber` — no raw hex and no stock Tailwind palette. (The shell's only colours are `bg-amber/10 border border-amber` and `text-ink-700`; `yarn run check` clean.)
- [x] Panel-specific content stays with the panel: the stats reorder hint, the constants `const.*` tip, the materials/items prerequisite warnings and each panel's list and dialog are passed in, not branched on inside the shell. (The shell has no panel name in it and no boolean beyond "is this slot filled". The stats reorder hint and the constants/curves/currency/equipment-slots/focus tips arrive as `headerExtra`; materials' and items' warnings as `prerequisites`; every list, card and dialog as `children`.)
- [x] Unit tests cover the shell directly: it renders the no-ruleset state instead of its children when no configuration is loaded; it renders the empty state when the list is empty and the children when it is not; the add button calls its handler; a prerequisite warning renders only when given one; and a blocked delete surfaces `BlockedDeleteDialog`. (New [`ConfigPanelShell.test.tsx`](../../../src/components/config/shared/ConfigPanelShell.test.tsx), 9 cases: the notice; title-as-`h2` plus description; the actions slot firing its handler; **no** action area when a section has nothing to add; one `role="note"` per prerequisite and none for `[]`; `headerExtra` rendering inside the header and before the children; a refused delete appearing and disappearing with `blocked`; children after the header; and `ConfigEmptyState`'s message.)
- [x] **No behaviour change.** Every existing config-panel test passes unchanged — that is the signal the extraction was faithful — and the suite is green at the [TEST_STATUS.md](../../../TEST_STATUS.md) baseline with `npx tsc --noEmit` no worse and `yarn run check` clean. (**1236 passing / 0 failing / 0 skipped**, exactly +9 — the new shell file — and the `verifier` confirmed `git diff --name-only` contains **no `*.test.ts(x)`**, so not one pre-existing assertion was edited to make this pass. Typecheck at the documented 2-error baseline; `yarn run check` clean.)
- [x] Nothing persisted changes, so no `docs/imports/` fragment is owed; say so in the report rather than leaving it ambiguous. (Pure component refactor — no type, store action, service or engine module is touched. `git diff --name-only` lists only `src/components/config/**`, the barrel, and docs.)
- [x] `fallow dupes` no longer reports the config-panel header family, and `fallow audit --base <ref>` introduces no new findings. (`fallow dupes` lists 14 clone groups and **none of them is a config panel header** — what remains is the speciality/combat skill pair, two form dialogs, the generated `routeTree.gen.ts` and `importExport.ts`. `fallow audit --base HEAD` → `"verdict": "pass"` with `duplication_introduced: 0, complexity_introduced: 0, dead_code_introduced: 0` — where the same audit on TICKET-RACE-01 returned `warn` with 3 introduced clone groups, all of them this family.)
- [x] The **coding-conventions** skill's configuration-domain section names `ConfigPanelShell` as the frame a new panel composes, and the **project-map** skill points at it under `config/shared/`.
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [x] Verified live in the browser: every `/config/*` route still renders — including a section with a prerequisite warning (items or materials) and one with a section-specific affordance (stats' reorder hint) — and the ten headings now read at one size. (Ducklets corpus on `localhost:3000`, all nine routes walked. **Every heading now computes to 20px**, including `Speciality Skills` and `Combat Skills` which were the h3 outliers — the divergence is gone on screen, not just in the source. Stats keeps its reorder hint and all 10 draggable cards; Items keeps *both* add buttons through the single `actions` slot; Currency, Constants and Curves keep their `const.*` / `curve.point_buy.main(9)` / ordering tips. Focus renders its explainer and its Save button with **zero** add buttons — the `actions`-omitted case. Emptying `stats`, `specialitySkills`, `combatSkills` and `currencyTiers` surfaced Materials' two prerequisite notes in order and Races' single one, then the corpus was restored. An unhydrated store still shows `NoConfigurationNotice`. No console errors across the sweep.)

## Notes

- ~~**Take this late in the milestone**, after the entity tickets stop reshaping panels~~ — **taken
  immediately instead, by the User's decision (2026-08-09)**, straight after RACE-01. The advice was
  written to avoid touching each panel twice; in practice the reverse held. Every entity ticket that
  edits a panel header re-attributes the whole clone family to itself — RACE-01 changed one line and
  `fallow audit` reported three introduced clone groups — so leaving it made each remaining ticket's
  audit noisier, not quieter. With the shell in place, MAT-01 and SKL-03 edit a `title` string
  instead of a header block, and their audits stay clean.
- Resist making the shell configurable enough to express every panel. If a panel needs a flag the
  others don't, that content belongs in the panel as a child. A shell with eight booleans is worse
  than eight copies, because it hides the differences instead of showing them.
- `FocusStatConfig` is the partial case: it has the no-ruleset guard but no list, no add button and
  no empty state. Either it takes the shell with those omitted, or it keeps the guard alone — worth
  deciding explicitly rather than leaving it as the one panel outside the rule.
- Out of scope: the per-component `Name.style.ts` convention, which only `CurveGrid` and
  `FormulaPreview` follow among feature components. That is a separate, repo-wide decision, and
  folding it in here would make a behaviour-neutral refactor unreviewable.
