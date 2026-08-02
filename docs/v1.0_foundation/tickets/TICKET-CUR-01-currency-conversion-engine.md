# TICKET-CUR-01 — Currency conversion in the engine, and values shown in the right tier

- **Area:** Currency
- **Type:** Refactor + feature
- **Traceability:** Requirements 10.4, 10.5, 10.2, 10.3, 21.1-21.5
- **Replaces plan items:** tasks.md §16.1

## User story

As a User, I want item and material values shown in a currency tier that reads naturally, so that
a price means something at a glance instead of being "1400 copper".

## Description

Currency conversion exists in the app, but as a loop inside a preview component — the one piece of
user-authored arithmetic that never went through the engine. This ticket moves it into a pure
module, and uses it to show a material's value in the tier that suits its size.

## Current situation (as-is)

- Conversion is implemented **inline in a component**:
  [`ConversionCalculator.tsx`](../../../src/components/config/currency/ConversionCalculator.tsx)
  walks `tiers` in a `for` loop, dividing or multiplying by `conversionToNext` depending on
  direction. Nothing else can reuse it, and it sits directly against the repo's rule that derived
  numbers come from the engine.
- There is **no currency module** in `src/engine/` — `ls src/engine` shows calculators, dice,
  formula, validator and characterSummary, and nothing for money. `src/utils/` does not exist.
- [`MaterialCard.tsx:150`](../../../src/components/config/materials/MaterialCard.tsx) is the only
  place a value is displayed: `{level.value.amount} {getCurrencyTierName(level.value.tierId)}` —
  the raw stored amount in the raw stored tier, never converted. This is Requirement 10.4's
  "display values in the appropriate Currency_Tiers", unmet.
- `CurrencyTier` is `{ id, name, order, conversionToNext }` where `order: 0` is the lowest tier and
  `conversionToNext` is how many of this tier make one of the next
  ([`config.ts`](../../../src/types/config.ts)). `CurrencyValue` is `{ tierId, amount }`.
- Items have no value of their own — an `Item` gets its worth from its material level, so "item
  values" in Requirement 10.4 resolves through `materialId` + `materialLevel`.

## Desired result (to-be)

- A pure `src/engine/currency.ts` owns conversion:
  - `convertCurrency(value, toTierId, tiers): CurrencyValue` — convert an amount between any two
    tiers using the configured rates (Req 10.5).
  - `normalizeCurrency(value, tiers): CurrencyValue` — express a value in the highest tier where it
    is still at least 1, which is what "the appropriate tier" means (Req 10.4).
  - `formatCurrency(value, tiers): string` — the display string, so every screen shows money the
    same way.
- `ConversionCalculator` consumes the module and keeps no arithmetic of its own.
- `MaterialCard` shows each level's value in its normalized tier, with the stored amount still
  visible when the two differ, so the User can see what was actually entered.
- Conversion is defined for tiers that are missing, out of order, or have a zero/negative rate,
  rather than producing `Infinity` or `NaN` silently.

## Acceptance criteria

- [x] `src/engine/currency.ts` exports `convertCurrency`, `normalizeCurrency` and `formatCurrency`,
      pure and free of React and storage. ([`currency.ts`](../../../src/engine/currency.ts) — no React import, no storage import, every function total over its inputs.)
- [x] `convertCurrency` converts up and down the tier ladder using `conversionToNext` (Req 10.5),
      covering multi-step conversions in both directions. (Tests *"should convert one step up"* (250 copper → 2.5 silver), *"should convert one step down"* (3 silver → 300 copper) and *"should convert across several tiers"* (1000 copper ↔ 1 gold, both directions). Also *"should sort by order rather than trusting the array order"* — the stored array is not assumed sorted.)
- [x] `normalizeCurrency` returns the highest tier in which the amount is still at least 1, and
      leaves a value already in its right tier alone (Req 10.4). (Tests *"should lift a value to the highest tier where it is still at least one"* (1400 copper → 1.4 gold), *"should leave a value already in its natural tier alone"*, and *"should stop at the highest tier that still reads as one or more"* — 50 copper stays copper, 150 copper becomes silver, neither reaches gold.)
- [x] A value smaller than one unit of the lowest tier stays in the lowest tier rather than
      disappearing. (Test *"should keep a value too small for any higher tier in the lowest tier"* — 0.5 copper stays 0.5 copper.)
- [x] `ConversionCalculator` renders the same conversions as before and contains no arithmetic of
      its own. ([`ConversionCalculator.tsx`](../../../src/components/config/currency/ConversionCalculator.tsx) — the 20-line hand-rolled loop is now a single `convertCurrency` call per tier. No `/`, `*` or `conversionToNext` remains in the file.)
- [x] `MaterialCard` displays each material level's value in its normalized tier (Req 10.4), and
      shows the stored amount alongside when normalization changed the tier. ([`MaterialCard.tsx`](../../../src/components/config/materials/MaterialCard.tsx) renders `formatCurrency(normalizeCurrency(...))`, plus an "entered as …" caption only when the tier moved. The stored `CurrencyValue` is never rewritten — conversion happens at read time.)
- [x] Unknown tier ids, an empty tier list, and a non-positive `conversionToNext` are handled
      without `NaN` or `Infinity` reaching the screen — one test per case. (Tests *"should leave the value alone when a tier is unknown"* (both directions), *"should leave the value alone with no tiers configured or an unknown tier"*, and *"should stay finite when a conversion rate is zero or negative"* — which asserts `Number.isFinite` and `!Number.isNaN` on conversions in both directions through a rate of `0` and one of `-5`. A non-positive rate degrades to 1, so that step leaves the amount unchanged instead of poisoning everything downstream.)
- [x] A property test asserts conversion round-trips: converting a value to another tier and back
      returns the original amount within floating-point tolerance. (`fast-check` test *"should round-trip through any other tier"* over amounts `0.01…1_000_000` across every tier pair, asserting `toBeCloseTo(amount, 6)`. A second property, *"should preserve worth, whatever tier it lands in"*, converts a normalized value back to copper and asserts the worth is unchanged.)
- [x] Feature components compose `components/ui` primitives and own their layout; no base component
      gains layout styling (Req 21.1-21.5). (Both touched components already composed `Card`/`Text`/`Input`/`Select`/`Label`; this ticket removed logic from them and added no markup beyond one `Text`. No file under `components/ui/` was touched.)
- [x] Unit tests cover: single-step conversion up and down; multi-step conversion; normalization
      choosing the right tier; formatting; each degenerate input; the round-trip property. (+17 tests in [`currency.test.ts`](../../../src/engine/currency.test.ts). Suite: **641 passing, 0 failing, 0 skipped** (was 624).)
- [x] Verified via the fallow skill and the coding-conventions skill. (`fallow audit --base HEAD` → `"verdict": "pass"`, 0 introduced findings. One was fixed rather than suppressed: `convertCurrency` came in at 11 cyclomatic / 17 cognitive, over the 15 cognitive threshold, because the up and down cases were two mirrored loops. They collapsed into one `reduce` over a shared `rungsBetween` helper — the directions differ only in the operator. All 17 tests passed unchanged against the simpler version, which is the useful signal. `npx tsc --noEmit` at the documented 9; `yarn run lint` at the documented 35 / 23.)
- [ ] Verified live in the browser: with a copper/silver/gold ladder configured, a material level
      priced in copper shows in gold once it is large enough. — **left open at the User's request**
      (2026-08-01: "don't browser check"). The conversion and normalization behaviour is covered by
      the engine tests; what is unverified is only that `MaterialCard` renders it as intended.

## Notes

- **This does not go through the formula engine.** Conversion is arithmetic over a configured
  numeric rate, not a user-authored expression, so `parseFormula` has nothing to parse here. The
  hard rule is about *user-authored math*; a conversion rate is a number the User typed into a
  field, and the engine module is where the rule about derived values is honoured.
- Money is held as a plain `number`, so repeated conversion accumulates floating-point error. The
  round-trip property test uses a tolerance rather than exact equality, and `formatCurrency` rounds
  for display. Exact decimal arithmetic is out of scope for v1.0 — note it rather than reaching for
  a big-decimal dependency.
- `normalizeCurrency`'s "highest tier where the amount is at least 1" is a choice, not a
  requirement: Requirement 10.4 says "appropriate" without defining it. The alternative — a
  compound rendering like "1 gold 4 silver" — is more work and more display surface. **Say so if
  you want compound values**; the module can grow a `formatCompound` without changing the rest.
- `CurrencyValue` is persisted inside `MaterialLevel`. Nothing here changes that shape: conversion
  happens at read time, and the stored value stays exactly as the User entered it.
