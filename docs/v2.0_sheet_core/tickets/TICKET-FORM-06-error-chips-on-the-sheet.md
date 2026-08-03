# TICKET-FORM-06 — Error chips on the character sheet

- **Area:** Formula engine (UI surface)
- **Type:** Feature (closes the v1.0 known bug's user-visible half)
- **Traceability:** Concept [00 · Field model §7](../../excel%20export%20summary/concepts/00-field-model.md)

## User story

As a Player, I want a broken value to show as a small red chip explaining what's wrong, while
everything else on my sheet stays usable.

## Description

TICKET-FORM-05 made errors values with provenance; this ticket renders them. One chip primitive,
used wherever a computed value appears.

## Current situation (as-is)

- [`useCharacterSheet`](../../../src/components/play/sheet/useCharacterSheet.ts) has the one
  `calculateCharacter` call; pre-FORM-05 a throw took the whole sheet down. Post-FORM-05 the data
  is there, but nothing renders an error entry.
- The v1.0 bug scenario (add a main skill → every existing character's sheet breaks with
  `Undefined variable`) is the acceptance regression for this pair of tickets.

## Desired result (to-be)

- An errored value renders as a compact **error chip** (crimson theme tokens, `ui/` primitive
  composition) whose detail shows the FORM-05 provenance chain in plain words.
- Healthy values render exactly as before; a sheet with mixed results is fully navigable and
  every non-broken section works.
- Regression pinned: adding a new skill/stat to a config with existing characters leaves every
  character's sheet rendering — worst case, chips on affected values, never a blank page.

## Acceptance criteria

- [ ] The chip is one small component in `components/ui/` (intrinsic styling only, crimson family tokens); feature components place it.
- [ ] Sheet component test: one broken stat formula → one chip with the provenance text, all other sections render their numbers.
- [ ] The v1.0 bug regression test passes and is kept green through STAT-01's model change.
- [ ] No raw markup, no stock palette classes; chip text uses the `Text` primitive.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: break a formula in config mode, open a character, see one chip and an otherwise working sheet. (Ask the User first per CLAUDE.md.)

## Notes

- Keep it per-value rendering only — config-wide reporting stays with VAL-01's
  `ValidationReport`.
- The chip survives the STAT-03 sheet rework; write it as a primitive, not sheet-specific markup.
