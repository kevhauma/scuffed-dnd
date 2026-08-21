# CR-27 — The "Level N | errors | races" line is duplicated in `SheetHeader` and `CharacterCard`

**Severity:** Low · **Area:** play components · **Type:** duplicate code

## Summary

The character summary line — level, error chip, race list — is implemented near-verbatim in two
places with the same conditional structure and the same chip label.

## Evidence

- `src/components/play/sheet/SheetHeader.tsx:50-55`
- `src/components/play/characters/CharacterCard.tsx:36-40`

## Impact

Purely a drift risk: a change to how level errors or race lists render must be found twice.

## Suggested direction

Extract a small shared `LevelLine` (or `CharacterSummaryLine`) in `play/shared/` and use it from
both. Trivial, safe, and the play/shared folder already exists for exactly this
(`SkillBreakdownRow` is precedent).
