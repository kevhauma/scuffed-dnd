# TICKET-UI-01 — Base component library: remove parent-layout constraints, hardcoded colors, and barrel drift

- **Area:** Base component library
- **Type:** Refactor
- **Traceability:** Requirements 21.2, 21.3, 21.6, 21.7, 22.1, 22.4
- **Relates to plan items:** §17.6 (component-library compliance check) — this closes most of it early

## User story

As a Developer, I want the base components to actually obey the library's own rules, so that a
feature component can lay them out without fighting them and the medieval theme can be changed in
one place.

## Description

Task §10 shipped the library and §11 consumed it, but a handful of base components took on
constraints that belong to their callers, five hardcode `bg-white` and two hardcode hex hover
shades, `FormField` never got a `.style.ts`, and the library barrel is both non-conforming and
unused. Each is small; together they are the difference between a component library and a folder
of components.

## Current situation (as-is)

**Parent-layout constraints on the outermost element** — [`ui/index.ts`](../../../src/components/ui/index.ts)
lists "Width/height constraints imposed by parent layout" as forbidden, and Requirement 21.3
repeats it, yet the root element is hard-set to `w-full` in:

- [Input.style.ts:3](../../../src/components/ui/Input/Input.style.ts)
- [Select.style.ts:3](../../../src/components/ui/Select/Select.style.ts)
- [Textarea.style.ts:3](../../../src/components/ui/Textarea/Textarea.style.ts)
- [FormulaEditor.style.ts:3](../../../src/components/ui/FormulaEditor/FormulaEditor.style.ts) (`containerStyles`)
- [ValidationReport.style.ts:3](../../../src/components/ui/ValidationReport/ValidationReport.style.ts) (`containerStyles`)

A caller that wants an inline, intrinsically-sized input currently cannot have one — `className`
arrives *after* but Tailwind class order doesn't guarantee the override, so callers work around it
by wrapping.

**Hardcoded colors**, contrary to the theme-token rule (Req 22.1, 22.4):

- `bg-white` in [Checkbox.style.ts:5](../../../src/components/ui/Checkbox/Checkbox.style.ts),
  [Input.style.ts:7](../../../src/components/ui/Input/Input.style.ts),
  [Select.style.ts:7](../../../src/components/ui/Select/Select.style.ts),
  [Textarea.style.ts:7](../../../src/components/ui/Textarea/Textarea.style.ts),
  [FormulaEditor.style.ts:21](../../../src/components/ui/FormulaEditor/FormulaEditor.style.ts) —
  pure white against a parchment page, where `--color-parchment-50` (`#fdfbf7`) is the theme's
  intended "paper" tone.
- Hex literals in [Button.style.ts:17,18,31,32](../../../src/components/ui/Button/Button.style.ts)
  (`#243447`, `#1a2633`, `#6b2424`, `#4a1919`) and
  [Checkbox.style.ts:13](../../../src/components/ui/Checkbox/Checkbox.style.ts) (`#243447`) —
  hand-darkened shades of `royal` and `crimson` that exist nowhere in
  [styles.css](../../../src/styles.css), so changing the accent colors silently leaves the
  hover/active states behind.

**`FormField` has no `.style.ts`** — [FormField.tsx:40](../../../src/components/ui/FormField/FormField.tsx)
puts `className="w-full mt-2"` and two `className="mt-1"` inline. It is the only base component
missing the `Name.tsx` / `Name.style.ts` / `Name.test.tsx` triad.

**Barrel drift** — [`ui/index.ts`](../../../src/components/ui/index.ts) enumerates 12 named
exports instead of `export *` (design.md, "Code Organization Standards"), and **nothing imports
it**: every one of the ~100 call sites uses a deep path (`../../ui/Button/Button`). The same
pattern has already produced a real gap next door —
[`config/index.ts`](../../../src/components/config/index.ts) is missing `ConversionCalculator`,
`EquipmentSlotCard`, `EquipmentSlotsConfigPanel`, and `useEquipmentSlotManager`.

## Desired result (to-be)

- No base component sets `w-full` (or any other parent-layout constraint) on its outermost
  element. Callers that want full width pass `className="w-full"` — which is what the
  `className` prop is for (Req 21.6). Every existing call site that relied on the implicit
  full-width keeps looking the same after the change.
- `bg-white` becomes the theme's paper token; the five hex literals become theme tokens. If a
  darker `royal`/`crimson` step is genuinely needed for hover/active, it is **added to the
  `@theme` block in `styles.css`** as a named token and referenced by name — not inlined.
- `FormField` gains `FormField.style.ts` holding its class strings, matching every sibling.
- `ui/index.ts` uses `export *` per folder. Decide and apply one import convention for base
  components — barrel or deep path — and make the codebase consistent with it; leaving both is
  what produced the unused barrel.
- `config/index.ts` re-exports its four missing modules (or is restructured so it cannot miss
  them again).

## Acceptance criteria

- [x] No `.style.ts` or `.tsx` under `src/components/ui/` sets `w-full`, `max-w-*`, `min-w-*`, or a margin on its outermost element; a grep for those on root elements comes back empty. (`w-full` removed from `Input`, `Select`, `Textarea` `baseStyles`; `FormulaEditor` and `ValidationReport` `containerStyles` are now `''`. Enforced by the new `src/components/ui/libraryConventions.test.ts` → *"should not impose parent-layout width on an outermost element"*, which parses each root-element constant (`baseStyles` / `containerStyles` / `checkboxStyles`) and asserts no `w-full`, `max-w-*` or margin. **Deliberately untouched**, per the ticket's own Notes: `Dialog`'s inner panel `max-w-2xl w-full` (a modal owns its placement) and `FormulaEditor`'s `w-full` suggestion *item* (a component laying out its own popover contents).)
- [x] Every previously-full-width usage in `src/components/config/` still renders full width, via an explicit `className` at the call site. (Audited all 29 primitive call sites. Most already carried an explicit width — `w-24`, `w-48`, `flex-1`. Only `FocusStatConfig`'s bonus-level `Input` genuinely relied on the implicit width and now reads `className="w-full mt-2"`; `StatFormDialog`'s `FormulaEditor` became `"w-full mb-2"`. `FormField` was already passing `w-full` to its `Input`, so every field built through it was unaffected. Browser: in the Item dialog all five controls measure exactly their parent's width, 605px of 605px.)
- [x] No `bg-white` / `text-white` / `border-white` remains under `src/components/ui/`. (Five occurrences swapped to `bg-parchment-50`, the theme's paper tone; the four base-component tests asserting `bg-white` updated to match. Enforced by *"should use theme tokens rather than white or raw hex colours"*.)
- [x] No hex color literal remains under `src/components/ui/`; any new shade exists as a named token in `styles.css`'s `@theme` block. (Five literals replaced. `--color-royal-dark`, `--color-royal-darker`, `--color-crimson-dark`, `--color-crimson-darker` added to the `@theme` block with the **exact** previous values, so the rendering is unchanged while the shades are now named. The same convention test guards it, ignoring the `%23`-encoded `#` inside the Select's inline SVG arrow, which is a data URI rather than a class.)
- [x] Hover and active states on Button and Checkbox remain visibly distinct from their rest state after the token swap (checked in the browser, both variants). (Browser: the generated rules exist — `.hover\:bg-royal-dark`, `.active\:bg-royal-darker`, `.checked\:hover\:bg-royal-dark`, `.hover\:bg-crimson-dark`, `.active\:bg-crimson-darker` — each resolving to its `var(--color-…)`. The six values read back as `#2e4057 / #243447 / #1a2633` and `#8b2e2e / #6b2424 / #4a1919`, all distinct and identical to the old literals. *Worth knowing:* the first check showed no rules at all — Tailwind v4's HMR had served a stale CSS bundle that had not re-scanned for the new class names. A hard reload fixed it; nothing was wrong with the code, but a warm dev server will lie about a new theme token until it is reloaded.)
- [x] `FormField.style.ts` exists and holds FormField's class strings; no class strings remain inline in `FormField.tsx`. (New file exporting `inputStyles` and `messageStyles`; the three inline strings in `FormField.tsx` now reference them. Enforced by *"should have a .style.ts beside every component"*, which walks the folder rather than trusting a list.)
- [x] `components/ui/index.ts` uses `export *` only. (All 12 enumerated named exports replaced. Enforced by *"should export every component from the barrel with export \*"*, which also asserts every `.tsx` in the folder actually appears — so a new primitive cannot be silently left out.)
- [x] One import convention for base components is applied consistently across `src/components/`, and stated in the ~~react-conventions~~ **coding-conventions** skill in this same change. **Decision: deep paths** (`../../ui/Button/Button`), which is what all ~100 existing call sites already use; the barrel stays as the folder's public listing. Converting every call site to the barrel would be a large mechanical diff for no gain and would risk re-export cycles. Stated in the skill's *Files and naming* section and in `ui/index.ts`'s own header.
- [x] `components/config/index.ts` exports `ConversionCalculator`, `EquipmentSlotCard`, `EquipmentSlotsConfigPanel`, and `useEquipmentSlotManager`. (All four were **already** present — the gap the ticket recorded had been closed since it was written. But the drift it predicted had recurred: `MainSkillPointBudget`, added by TICKET-SKL-01 earlier today, was missing. Added.)
- [x] No behaviour change: the existing base-component tests still pass, and the config panels' tests fail no more than the baseline in [TEST_STATUS.md](../../../TEST_STATUS.md). (543 passing, 0 failing, 0 skipped — the 539 before this ticket plus its 4 convention tests. `npx tsc --noEmit` and `yarn run lint` are both back at the documented baseline: 9 errors, and 35 errors / 23 warnings.)
- [x] Verified via the fallow skill and the ~~react-conventions~~ **coding-conventions** skill *(renamed since the ticket was written)*. (`fallow audit --base HEAD` → `"verdict": "pass"`, 0 introduced findings. An intermediate state had 3 new `tsc` errors and 3 new lint errors — the scripted patch added a second `className` to three elements that already had one; caught by the verification step and fixed by merging the values rather than by relaxing anything.)
- [x] Verified live in the browser: on `/config/items` with the Item dialog open, every `Input`, `Select` and `Textarea` still measured its parent's full width (605px of 605px) and all read `rgb(253, 251, 247)` = `#fdfbf7` = `--color-parchment-50` — the intended paper-tone shift and nothing else. The hover/active token check above covers Button and Checkbox.

## Notes

- **Deliberately out of scope: internal spacing.** Margins *between a component's own
  sub-elements* — `Label`'s `ml-1` on the required asterisk, `FormulaEditor`'s `mt-2` error
  message, `ValidationReport`'s `mb-4` header rule, `FormField`'s label→input gap, the `m-0`
  browser-default resets — are the component composing itself, not positioning itself in a parent.
  Stripping them would make the components worse. Requirement 21.3's "no margin" is about the
  outermost element; the criteria above are scoped that way on purpose.
- Also out of scope and correct as-is: `Dialog`'s `fixed inset-0 z-50` and `FormulaEditor`'s
  `absolute z-10` suggestion list — a modal and a popover own their own positioning — and
  internal `flex items-center` used to lay out a component's own contents.
- Pure refactor: no new props, no API changes beyond removing an implicit width. If a call site
  turns out to depend on the implicit `w-full` in a way `className` can't express, that is worth
  raising rather than reinstating the class.
- The route-layer theme violations (stock greys/blues in every `src/routes/*` file and the unused
  `src/components/Header.tsx`) are **not** in this ticket — `__root.tsx` belongs to
  [TICKET-NAV-01](./TICKET-NAV-01-root-layout-and-mode-switching.md) and the rest to the §17.5
  polish pass.
