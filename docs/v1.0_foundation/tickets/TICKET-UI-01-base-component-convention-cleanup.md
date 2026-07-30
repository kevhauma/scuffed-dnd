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

- [ ] No `.style.ts` or `.tsx` under `src/components/ui/` sets `w-full`, `max-w-*`, `min-w-*`, or a margin on its outermost element; a grep for those on root elements comes back empty.
- [ ] Every previously-full-width usage in `src/components/config/` still renders full width, via an explicit `className` at the call site.
- [ ] No `bg-white` / `text-white` / `border-white` remains under `src/components/ui/`.
- [ ] No hex color literal remains under `src/components/ui/`; any new shade exists as a named token in `styles.css`'s `@theme` block.
- [ ] Hover and active states on Button and Checkbox remain visibly distinct from their rest state after the token swap (checked in the browser, both variants).
- [ ] `FormField.style.ts` exists and holds FormField's class strings; no class strings remain inline in `FormField.tsx`.
- [ ] `components/ui/index.ts` uses `export *` only.
- [ ] One import convention for base components is applied consistently across `src/components/`, and stated in the **react-conventions** skill in this same change.
- [ ] `components/config/index.ts` exports `ConversionCalculator`, `EquipmentSlotCard`, `EquipmentSlotsConfigPanel`, and `useEquipmentSlotManager`.
- [ ] No behaviour change: the existing base-component tests still pass, and the config panels' tests fail no more than the baseline in [TEST_STATUS.md](../../../TEST_STATUS.md).
- [ ] Verified via the fallow skill and the react-conventions skill.
- [ ] Verified live in the browser: walk every config panel and confirm inputs, selects, textareas, checkboxes, the formula editor, and a validation report look unchanged apart from the intended paper-tone shift.

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
