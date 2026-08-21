# CR-42 — Naming drift around the retired skill-code concept and the `Id` suffix convention

**Severity:** Low · **Area:** config + play components · **Type:** naming / convention drift

## Summary

Two naming leftovers in a codebase where the id-vs-code distinction is load-bearing (CLAUDE.md
hard rules):

1. `SkillAllocationStep`'s callback parameter is named `code` but receives `skill.id` — stale
   naming from before TICKET-SKL-02 retired skill codes.
2. `useSkillManager` holds the editing id in `editingSkill`, dropping the `Id` suffix every
   sibling uses (`editingStatId`, `editingRaceId`, `editingConstantId`, …), so the name reads as
   holding the entity.

## Evidence

- `src/components/play/creation/SkillAllocationStep.tsx:42`
  (`onChangeInvestedSkillPoints: (code: string, level: number)`) vs `:182` (passes `skill.id`).
- `src/components/config/skills/skill/useSkillManager.ts:38` (`editingSkill`).

## Impact

Pure readability — but this specific confusion (id vs code vs slug) is the one the project's hard
rules exist to prevent, so the misnamed parameter is worth more than a typical rename.

## Suggested direction

Rename `code` → `skillId` and `editingSkill` → `editingSkillId`. Mechanical, type-checked.
