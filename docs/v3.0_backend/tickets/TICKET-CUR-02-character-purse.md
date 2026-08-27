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

## Implementation notes (2026-08-27)

### The as-is was wrong, and the ticket won anyway

*"`Character` holds no money"* had stopped being true: a `wallet?: Record<tierId, number>` — a
**per-tier** purse, with a `WalletSection` and a `setWalletAmount` — had arrived in an unrelated
commit (`feat(styles): enhance medieval theme`), named in no ticket and contradicting
[D9](../overview.md#d9--level-stays-derived-points-to-spend-becomes-a-grant), which calls
`Character.purse` the sanctioned fourth stored value. Taken to the User, who chose to **replace it**.

So this ticket is a removal as well as an addition, and its Notes are what settled it: a per-tier
breakdown makes every payment a change-making problem and lets one amount of wealth have two
representations. `wallet`, `WalletSection` and `CoinRow` are gone; `PurseSection` is what replaced
them.

**No money is lost.** `characterStore.adoptStoredWallets(tiers)` converts a stored wallet into a
base-tier purse through `convertCurrency` and drops the retired key, so it runs at most once per
character. It lives in `useAppHydration` because it needs the ruleset's **rates**, which
`loadCharacters` has no access to and which the store cannot reach without the cycle `no-circular`
refuses — the same constraint `createCharacterHere` works around by taking its argument.

### `SUPPORTED_SCHEMA_VERSION` is **not** bumped, and the reason is the migration

The data-model skill says to bump when a field *moves or is removed*, and `wallet` is removed — so
this needs stating rather than assuming.

- `purse` is **additive-optional**, which by the rule ARC-01 refined needs no bump on its own.
- Removing `wallet` breaks no build: nothing reads it, and `isReadableCharacter` never required it.
  The failure a bump protects against is *a build crashing on a field that moved*, and there is no
  such field here.
- Most of all, **a bump and the conversion are mutually exclusive.** Bumping makes every stored
  roster unreadable behind `IncompatibleDataNotice` — which would destroy the exact wallet data the
  migration exists to keep. One of the two had to go, and refusing to read the data in order to
  avoid reading it wrongly is the worse trade.

`isReadableCharacter` therefore still **accepts** a character carrying the retired `wallet`, and a
test says so: if it refused one, the migration could never run.

### A known limitation, stated rather than discovered

**The purse *box* takes whole numbers, though the stored purse need not.** `useNumericDraft` parses
with `Number.parseInt`, as every numeric entry on the sheet has since TICKET-RES-03, so a typed
`0.5` commits `0`. A fraction is still a perfectly good purse and arrives by the two paths that
produce one — a conversion across fractional rates, and the wallet migration — so the type, the
Kernel rule and this ticket's note about fractions all stay true. Widening the entry means changing
the shared draft hook and every editor that uses it, which is its own ticket rather than a line
here.

## What the review found

Five defects and a spec conflict, all fixed; the reviewer confirmed the conversion loses no money
and that a refusal never writes.

1. **v3 Req 43.5 mandated the `schemaVersion` bump this ticket declines**, and code that contradicts
   a numbered requirement is worse than either alone. The requirement is **amended in place** with
   the reasoning above, and a sixth clause added for the retained-`wallet` read. The same claim in
   the `data-model` skill is corrected; `src/server/README.md` and `db/schema.ts` only ever said
   *not a migration*, which is still true.
2. **The refusal was built and thrown away.** `applyLocally` drops a refusal by design — its docblock
   justifies that with *"the browser has a wizard and disabled controls in front of these"* — and
   that is false for a free-text purse box: `-40` against 5 snapped back in silence with *"7 short"*
   unreachable. `applyLocally` now takes `reportRefusal`, and the purse actions pass it.
3. **The migration rule lived where the server cannot call it.** `purseFromStoredWallet` moved from
   `client/stores/` to `shared/services/characterShape.ts` — it is a pure rule over a *document*, and
   the server holds documents that can carry a `wallet` (IO-04 uploads a browser roster verbatim).
4. **A wallet entry in a tier the ruleset no longer defines was added as if it were base-tier.**
   `convertCurrency` returns a value *unchanged* for an unknown tier, which is right for its contract
   and wrong as a summand — `{ gold: 3 }` would contribute 3 instead of 300, silently, in the
   direction that loses money. Unknown tiers and non-finite amounts are now filtered out.
5. **`useAppHydration` went over the complexity threshold**, and the cause was **hook density**
   rather than branching — so the fix was fewer hooks, not more functions: the migration reads both
   stores through `getState()` inside the effect that already runs. The restore's try/catch also came
   out as `restoreStores`. A guard was added while doing it: a **refused** load must not migrate.
6. Smaller: four miscited requirement numbers; `PurseSection` re-deriving `baseTier` it already
   imports; a stale prop docblock; and `setPurse` colliding with the Kernel's spelling, which forced
   an import alias — the Kernel's are `setPurseAmount` / `adjustPurseBy` now, following the
   `investInStat` / `setInvestedStatPoints` pattern.

The review also found the wiring untested on both sides of the seam: `useAppHydration.test.tsx` now
covers the conversion running with the ruleset's rates, writing nothing when there is nothing to
convert, and **not** running after a refused load, and `CharacterSheet.test.tsx` gained the positive
*purse renders off a table* case — its table counterpart had been vacuously true, since the heading
used to read *Wallet*.

## Acceptance criteria

- [x] `purse` round-trips through storage, export/import and the server document; absent stays
      absent and a ruleset written before this ticket is unchanged by a round trip.
      (`characterStore.test.ts` → *should open a purse on a character that has never had one*
      asserts the field is absent until written; `characterShape.test.ts` → *accepts one with no
      purse*. It rides in `character.data` as plain JSON, so the server document carries it with no
      code change — `toCharacterDocument` parses the whole object. **Verified live**: a character
      created in the browser has no `purse` key at all until one is set.)
- [x] A change taking the balance below zero is refused with the shortfall named, not clamped to 0.
      (`playerActions.test.ts` → *refuses to go below zero and names the shortfall* — `-12` against
      5 says *7 short* — and *leaves the purse alone when it refuses*;
      `characterStore.test.ts` → *should refuse a change below zero rather than clamping it*.
      **Verified live**: `-9999` against 378 left it at 378.)
- [x] The sheet renders the purse through `formatCurrency`, and changing the ruleset's conversion
      rates changes the displayed tier with no stored value changing.
      (`formatPurse` = base tier → `normalizeCurrency` → `formatCurrency`;
      `currency.test.ts` → *should follow the ruleset rather than the stored number* renders one
      stored number in two rulesets and gets `2.5 Gold` and `25 Gold`;
      `PurseSection.test.tsx` → *changes what it displays when the ruleset does, with the same stored
      number*. **Verified live**: a stored `378` read as a bare `378` with no tiers and as
      `3.78 Silver` once three were added — the stored number never moved.)
- [x] Relative entry works — `+12` and `-7` adjust rather than replace — reusing `useNumericDraft`'s
      `allowRelative` rather than a second parser (TICKET-RES-03's decision).
      (`PurseSection.test.tsx` → *reads a leading + or - as an amount to move by, not a number to
      become* and *commits nothing per keystroke, so typing 340 cannot persist a 3*.
      **Verified live**: `340` → 340, `-12` → 328, `+50` → 378, through the real component.)
- [x] A ruleset with **no** currency tiers renders the purse as a bare number rather than erroring or
      hiding it; a ruleset may define no currency, as it may define no races.
      (`currency.test.ts` → *should show a bare number when the ruleset defines no currency*;
      `PurseSection.test.tsx` → *shows a bare number for a ruleset that defines no currency*, with
      the box labelled *Amount* rather than an invented tier name. **Verified live** on a freshly
      created ruleset, which has no tiers.)
- [x] The `docs/imports/` currency fragment is updated and `yarn run sheet:import` rerun; the
      `schemaVersion` decision (bump or not) is stated with its reason in the implementation notes.
      (`docs/imports/currency-tiers.json` records that a character now holds **one** base-tier amount
      where the sheet's `Q18:S23` shows a five-row pouch, and why — the fragment carries ruleset data
      and a purse is player state no exported ruleset contains, which is itself worth saying.
      `yarn run sheet:import` rerun; `sheetImport.test.ts` green. The `schemaVersion` decision and
      its reasoning are above.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).
      (`npx vitest run` **2955 passing, 0 failing, 0 skipped** across 184 files; `npx tsc --noEmit`
      at the documented 2-error baseline; `yarn run check` clean. Browser, on a local ruleset:
      the purse renders, sets, spends, earns and refuses; adding tiers changes the reading and not
      the number; and a seeded `wallet: {gold: 3, copper: 40}` came back on the next load as
      `purse: 3040` reading *3.04 Gold*, with the retired key gone and no console errors.)

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
