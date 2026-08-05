# TICKET-REF-01 — Stable ids and rename-safe formulas

- **Area:** References & identity (new area)
- **Type:** Feature
- **Traceability:** Concept [00 · Field model §6](../../excel%20export%20summary/concepts/00-field-model.md); spec [§3.2](../../excel%20export%20summary/ttrpg-app-spec.md)

## User story

As a User, I want to rename anything — names, abbreviations, codes — without breaking a single
formula, so my ruleset's vocabulary is mine to change.

## Description

The spec's identity rule: references store stable ids and display current names; renaming can
never break anything. The app's formulas store mutable 3-letter codes as raw text with no rename
propagation. This is where the v2.0 decision "every name, abbreviation, formula configurable"
lands. Guarded deletes are the second half — TICKET-REF-02.

## Current situation (as-is)

- Skills have no `id`; the `code` **is** the identity ([`config.ts`](../../../src/types/config.ts)),
  the parser stores the raw token, the evaluator looks it up verbatim — renaming `STR` silently
  invalidates every formula naming it. No rename-propagation code exists anywhere.

## Desired result (to-be)

- Every referenceable entity carries a **stable `id`**; codes/abbreviations become freely
  renamable display data (uniqueness downgraded to a warning).
- **Stored formulas are id-resolved**: the editor reads/writes display syntax (FORM-03), the
  persisted form resolves references to ids; implementation (id-form string vs. stored AST) is the
  implementer's choice — the contract is the rename test.
- **Rename test:** rename any entity's name *and* abbreviation → every formula still validates
  and evaluates to the same numbers, and reopening it in the editor shows the new abbreviation.

## Implementation notes (2026-08-05)

Recorded while building, so the boxes below aren't read as more than they are.

1. **The storage answer is a display↔stored translation, not a stored AST.** A formula has two
   forms of the same expression: the **display form** the User writes and every layer above the
   services works in (`STR + DEX`, `stats.max_health`, `skills.STL.level`), and the **stored form**
   that persists, with each reference replaced by the entity's id (`[id-str] + [id-dex]`).
   [`engine/formula/references.ts`](../../../src/engine/formula/references.ts) translates both ways
   from the tokenizer, so everything outside a reference token — spacing, parens, the User's
   capitalisation — survives byte-identical. `services/storage.ts` and `services/importExport.ts`
   are the only two places that cross the boundary. A rename is therefore
   `toStoredConfiguration` → patch → `toDisplayConfiguration`, which is exactly what
   `configStore`'s `applyRenameSafely` does. The parser gained a bracketed id token (`[id]`,
   `stats.[id]`) so the stored form is still a valid formula; no new AST node kind was needed.
2. **Code uniqueness stays enforced — the to-be's "uniqueness downgraded to a warning" is
   deliberately not done.** The display form is a spelling, so two skills sharing a code would make
   `STR` ambiguous and unresolvable in both directions. CLAUDE.md's hard rule ("skill codes are 3
   letters and unique across main, speciality, and combat skills") stands, and `buildReferenceIndex`
   degrades safely if it is ever broken by hand: the first claimant keeps the spelling and the
   other stays in its unambiguous `[id]` form. Reopening this needs a different display syntax
   (qualified by kind), which belongs with TICKET-STAT-01's unified stat, not here.
3. **Constants and curves cannot be rename-tested yet** — CST-01 and CRV-01 have not landed, so
   `const.*` and `curve.*` have no members. Both namespaces are handled by the translator (a
   reference into them is left verbatim, pinned by a test) and will resolve the moment those
   entities exist. The criterion below is split accordingly rather than ticked whole.
4. **Stats gained a display spelling.** They have an id but no abbreviation, so
   `stats.<member>` now resolves against a slug of the stat's *name* (`Max Health` →
   `stats.max_health`), replacing FORM-04's raw-id members — which no User could write, since ids
   are UUIDs and do not parse. TICKET-STAT-01 gives the unified stat a real code and
   `statMemberName` retires with it.
5. **The character side is re-keyed too, which was not in the plan.** `Character.mainSkillLevels`,
   `specialitySkillBaseLevels` and `focusStatCode` are keyed by skill *code*, so re-spelling the
   configuration alone would have left a renamed skill reading as an unallocated 0 while the
   player's levels sat under an orphaned key — a silent wrong number where the pre-REF-01 behaviour
   was at least a loud error. `characterStore.renameSkillCode` closes it and the three skill
   managers call it alongside the config update (via `useSkillCodeRename`). Stores stay
   independent; the manager orchestrates. TICKET-STAT-01's new character shape retires both.

## Acceptance criteria

- [x] All referenceable entities have ids; abbreviation edits are plain data changes. (`id: string` on `MainSkill`/`SpecialitySkill`/`CombatSkill` in [`types/config.ts`](../../../src/types/config.ts) — stats, races, materials, items, categories and tiers already had one; `EquipmentSlot` is keyed by `type` and is not formula-referenceable. Ids are minted by `resolveSkillId` ([`skillIdentity.ts`](../../../src/components/config/skills/shared/skillIdentity.ts), tested in `skillIdentity.test.ts` — "keeps the id of the skill being edited", "mints an id when adding") and backfilled for older data by `ensureReferenceIds` (`references.test.ts` "mints an id for a skill that predates them and leaves the rest alone", `storage.test.ts` "completes a configuration written before skills had ids"). A code edit is now a plain data change: `configStore.test.ts` "rewrites every formula naming a main skill whose code changes" asserts `mainSkills[0].id` is unchanged across the rename.)
- [x] The rename test passes for: a stat in a formula ~~, a constant, a curve~~, and a link-shaped reference (race on a character, material on an item). (**Stat:** `references.test.ts` "re-spells a stat named in another formula when the stat is renamed" and `configStore.test.ts` "re-slugs a stat named in another formula when the stat is renamed" — `stats.max_health` becomes `stats.vitality` while the stored form keeps `[id-hp]`. **Skill codes:** `references.test.ts` "keeps every formula computing the same numbers when a code is renamed" and "re-spells a speciality skill named through both syntaxes"; end-to-end through both stores and real LocalStorage in `integration.test.ts` "keeps a character computing the same numbers after a skill is renamed (TICKET-REF-01)". **Link-shaped:** `references.test.ts` "leaves a link-shaped reference alone — it already points at an id" (race renamed, `race.id` and `item.materialId` unchanged) and "carries racial and material bonuses through a rename too" for the code-shaped `skillModifier.skillCode`. **Constant and curve: struck through** — CST-01/CRV-01 have not landed, so there is nothing to rename; the translator's handling of both is pinned by "keeps references it cannot resolve exactly as written". See implementation note 3.)
- [x] Persisted formulas survive renames (round-trip test on stored config JSON). (`references.test.ts` "survives a JSON round trip and comes back in display form" — `JSON.parse(JSON.stringify(stored))` → `toDisplayConfiguration` equals the original — and "spells a stored formula with the current codes, not the ones it was written with". At the real boundaries: `storage.test.ts` "writes formulas with references resolved to ids" / "hands back the display form on load" / "spells a stored formula with the code the skill has now", and `importExport.test.ts` "should create valid JSON content, with references resolved to ids (TICKET-REF-01)", which asserts the exported JSON holds `[STR] * 10` and that re-importing it returns the display form.)
- [x] Persistence via store actions only; any reference index is derived, never persisted. (No component, hook or engine module calls `localStorage` or the storage service — `applyRenameSafely` in [`configStore.ts`](../../../src/stores/configStore.ts) and `renameSkillCode` in [`characterStore.ts`](../../../src/stores/characterStore.ts) both persist through their store's existing `autoSave`. `buildReferenceIndex` is called fresh inside `translateConfiguration` on every translation and is never a field on `Configuration`; `conventions-reviewer` confirmed layering and store-owned persistence hold end-to-end.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (verifier: **852 passing, 0 failing, 0 skipped** (from 801), `npx tsc --noEmit` at exactly the documented 4-error baseline, `yarn run check` clean over 224 files. fallow: the first audit flagged `findReferenceSites` as an *introduced* critical complexity hotspot (cyclomatic 23) and one introduced clone across the speciality/combat managers — the function was split into `findReferenceSites`/`referenceAt`/`dottedReferenceAt` and the duplicated id lookup extracted to `resolveSkillId`, after which fallow reports **0 introduced complexity findings**; the remaining clone group is the pre-existing `validateFormulaChange` guard shared by the two managers, and every dead-code finding is inherited. conventions-reviewer: layering, store-owned persistence, engine-owned math, barrels, theme and traceability all clean, plus six findings — all fixed in this same change: the character-side rename gap (implementation note 5, now closed by `renameSkillCode` with its own tests), a missing test for `resolveSkillId` (added), the undocumented `id` exemption in `validateConfiguration` (JSDoc note added), `ensureReferenceIds` calling `crypto.randomUUID()` inside the pure engine (now takes a `newId` parameter the services supply), the ticket bookkeeping below, and a stale barrel comment.)
- [ ] Verified live in the browser: rename an abbreviation a formula uses; the dependent value holds and the formula editor shows the new spelling. (Ask the User first per CLAUDE.md.) — **open by the User's instruction to skip the browser check for this run.** The equivalent path is covered headlessly by `integration.test.ts` "keeps a character computing the same numbers after a skill is renamed (TICKET-REF-01)", which drives the real stores and real LocalStorage, but no live check was performed.

## Notes

- Before the entity tickets, so they build on id-references instead of retrofitting.
- Pairs with TICKET-REF-02 (guarded deletes) — same machinery, split for digestibility.
