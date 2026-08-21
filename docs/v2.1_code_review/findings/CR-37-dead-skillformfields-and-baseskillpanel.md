# CR-37 — `SkillFormFields.tsx` is dead code; `BaseSkillPanel` is a one-caller pass-through

**Severity:** Low · **Area:** config components (skills) · **Type:** dead code

## Summary

Two leftovers from the combat-skill removal (TICKET-ROLL-06) and the skill-code retirement
(TICKET-SKL-02):

1. `SkillFormFields.tsx` is confirmed unreachable — its only references are barrel lines. It
   registers a `code` field that `Skill` lost in TICKET-SKL-02 and whose other consumer (combat
   skills) was removed in TICKET-ROLL-06. Its header comment ("used by all skill types") is
   fiction.
2. `BaseSkillPanel.tsx` is down to one caller (`SkillsPanel.tsx`) since combat skills were
   removed; it is now a thin pass-through over `ConfigPanelShell` plus a three-column grid, with
   render-prop indirection that costs more than it shares.

## Evidence

- `src/components/config/skills/shared/SkillFormFields.tsx` — fallow reports it as an unreachable
  file; manual check confirms only `config/index.ts:66` barrel references.
- `src/components/config/skills/shared/BaseSkillPanel.tsx` — single caller.

## Impact

Dead weight, plus a trap: the dead form fields still register a retired `code` field, so reviving
them by accident would reintroduce a removed concept.

## Suggested direction

Delete `SkillFormFields.tsx` and its barrel lines; inline `BaseSkillPanel` into `SkillsPanel` and
delete it. Pure deletion, test suite as safety net.
