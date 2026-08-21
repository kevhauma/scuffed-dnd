# CR-16 — `DiceLaddersConfigPanel` is the only panel missing the no-configuration guard

**Severity:** Medium · **Area:** config components (rolls) · **Type:** missed pattern

## Summary

Every config panel guards with `if (!config) return <NoConfigurationNotice />` — except
`DiceLaddersConfigPanel`. With no ruleset loaded, `/config/rolls` shows RollsConfigPanel's notice
followed by a fully interactive Dice Ladders panel whose "Add Ladder" flow silently no-ops.

## Evidence

- `src/components/config/rolls/DiceLaddersConfigPanel.tsx` — no guard;
  `useDiceLadderManager` doesn't even return `config` for the panel to check.
- `src/stores/configStore.ts` — `addDiceLadder` returns early on null config, so the dialog opens,
  the user fills the form, saves, and nothing happens.

## Impact

A confusing dead-end UI in the no-config state: an interactive panel that swallows input, sitting
directly under a notice explaining there's nothing to configure.

## Suggested direction

Return `config` from `useDiceLadderManager` and add the same guard every sibling panel has.
One-file fix plus a test mirroring the existing no-config panel tests.
