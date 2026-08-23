# TICKET-CUR-02 — A character carries a purse

- **Area:** Currency
- **Type:** Feature
- **Traceability:** v3 [Req 43](../requirements.md#requirement-43-character-purse);
  v1.0 [Req 10](../../v1.0_foundation/requirements.md#requirement-10-currency-system-configuration);
  Concept [16 · Currency](../../excel%20export%20summary/concepts/16-currency.md)

## User story

As a Player, I want my character to carry money, so that the currency system my ruleset defines has
somewhere to land and the DM can pay me for the job.

## Description

A gap that predates the backend: the ruleset has had currency tiers and a conversion engine since
v1.0, and no character has ever held a coin. DM-02 wants to set a wallet and there is nothing to
set. Small ticket, real persisted-shape change.

**Before DM-02 deliberately** — the field must exist before the power to edit it does.

## Current situation (as-is)

- `Configuration.currencyTiers` and [`engine/currency.ts`](../../../src/engine/currency.ts) exist:
  `convertCurrency`, `normalizeCurrency` (the highest tier where the amount is still ≥ 1 — what
  Req 10.4's "appropriate tier" means) and `formatCurrency`. Conversion is arithmetic over a
  configured rate and deliberately does **not** go through the formula engine.
- `Character` holds no money. The only currency surface is `ConversionCalculator` in the config
  panel — a calculator, attached to nobody.
- Adding a field to `Character` is an established procedure: additive-optional needs no
  `SUPPORTED_SCHEMA_VERSION` bump (the rule ARC-01 refined), but the sheet corpus and the store
  action rules apply either way.

## Desired result (to-be)

- `Character.purse?: number` — a single amount in the ruleset's **base** tier, never a per-tier
  breakdown, absent meaning zero and staying absent on a character that has none (the
  `constants?` pattern).
- Store actions `setPurse` / `adjustPurse` that **refuse** a change taking the balance negative
  rather than clamping it, matching `deductExperience`'s precedent.
- A purse row on the character sheet showing the amount through `formatCurrency`, so the tier
  displayed follows the ruleset's rates, with `useNumericDraft`'s commit-on-blur and relative entry.

## Acceptance criteria

- [ ] `purse` round-trips through storage, export/import and the server document; absent stays
      absent and a ruleset written before this ticket is unchanged by a round trip.
- [ ] A change taking the balance below zero is refused with the shortfall named, not clamped to 0.
- [ ] The sheet renders the purse through `formatCurrency`, and changing the ruleset's conversion
      rates changes the displayed tier with no stored value changing.
- [ ] Relative entry works — `+12` and `-7` adjust rather than replace — reusing `useNumericDraft`'s
      `allowRelative` rather than a second parser (TICKET-RES-03's decision).
- [ ] A ruleset with **no** currency tiers renders the purse as a bare number rather than erroring or
      hiding it; a ruleset may define no currency, as it may define no races.
- [ ] The `docs/imports/` currency fragment is updated and `yarn run sheet:import` rerun; the
      `schemaVersion` decision (bump or not) is stated with its reason in the implementation notes.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

## Notes

- **One number in the base tier, not a per-tier purse**, is the decision to defend. A per-tier
  breakdown makes every payment a change-making problem, makes "do I have 3 gold" a conversion, and
  makes two representations of the same wealth possible. `normalizeCurrency` already answers "what
  tier should I show this in" — the display question is the only one worth asking.
- The purse is **player state**, like `currentResourceValues` and `experience`: money is spent at the
  table and derived from nothing. It joins that list in the **data-model** skill and in
  [CLAUDE.md](../../../CLAUDE.md)'s sanctioned-exceptions rule, alongside DM-01's
  `grantedStatPoints`.
- Non-integer amounts are allowed — a tier rate may be fractional and the engine already degrades
  rather than producing `NaN`/`Infinity`. Do not round in the store; round for display only.
