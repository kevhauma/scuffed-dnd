# TICKET-DX-03 — Requirement traceability headers and the panel/hook shape

- **Area:** Developer experience / conventions
- **Type:** Refactor
- **Traceability:** Requirements 21.4, 21.5 (component shape); the header convention itself serves 18.x traceability
- **Replaces plan items:** part of tasks.md §17.6

## User story

As a Developer, I want to know which requirement a module implements and to find every domain
folder shaped the same way, so that changing a requirement tells me exactly which files to open.

## Description

Two conventions are declared and half-adopted. The `**Validates: Requirements …**` JSDoc header —
the only link from code back to the spec — is on 10 of 108 modules. And every configuration domain
follows the panel + card + form-dialog + `useXManager` shape except one. Both are cheap to close
and both get harder the more code lands on top.

## Current situation (as-is)

- **Traceability headers**: 10 of 108 non-test modules carry `**Validates: Requirements …**`,
  concentrated in `src/services/`, `src/engine/`, and the top-level config panels. Every card,
  form dialog, manager hook, store, and route is missing one, so grepping a requirement number
  finds a fraction of the code that implements it. The `spec-navigator` subagent leans on this
  grep.
- **Panel/hook shape**:
  [`FocusStatConfig`](../../../src/components/config/focus/FocusStatConfig.tsx) reads
  `useConfigStore` and holds two `useState` values inline — the only config domain with no
  `useXManager` hook. Every other domain (`skills/main`, `skills/speciality`, `skills/combat`,
  `stats`, `materials`, `items`, `races`, `currency`) separates them.
- **Barrel gaps** (also listed in [TICKET-UI-01](./TICKET-UI-01-base-component-convention-cleanup.md)
  — whichever lands first fixes them): `config/index.ts` omits `ConversionCalculator`,
  `EquipmentSlotCard`, `EquipmentSlotsConfigPanel`, `useEquipmentSlotManager`.

## Desired result (to-be)

- Every module that implements a requirement carries the header naming the requirement numbers it
  satisfies — components, hooks, stores, services, engine modules, and routes alike. Modules that
  genuinely implement no requirement (pure plumbing, generated files, test fixtures) don't get a
  fake one; the convention is "if you can name the requirement, name it", not "every file gets a
  line".
- The numbers are **verified against [requirements.md](../requirements.md)**, not guessed from the
  file name — a wrong traceability line is worse than none, because `spec-navigator` will quote it.
- `FocusStatConfig` gets a `useFocusStatManager` hook holding the store selectors and local state,
  matching its siblings; the component renders.
- The react-conventions skill states the rule for both, so the next module follows it by default.

## Acceptance criteria

- [ ] Every file in `src/components/config/`, `src/stores/`, `src/services/`, `src/engine/`, and `src/routes/` that implements a named requirement carries a `**Validates: Requirements …**` line in its JSDoc header.
- [ ] Each added line cites requirement numbers that actually cover what the module does — spot-checkable against `requirements.md`, with no invented numbers.
- [ ] Files implementing no requirement are left without a header rather than given a filler one.
- [ ] `FocusStatConfig` no longer calls `useConfigStore` or `useState` directly; a `useFocusStatManager` hook does, and the component consumes it (Req 21.4, 21.5).
- [ ] `FocusStatConfig`'s existing tests still pass at the [TEST_STATUS.md](../../../TEST_STATUS.md) baseline, and the hook is covered by its own test cases.
- [ ] `components/config/index.ts` exports the four missing modules (skip if TICKET-UI-01 already did it).
- [ ] The react-conventions skill documents both conventions explicitly.
- [ ] No behaviour change: this is comments plus one hook extraction.
- [ ] Verified via the fallow skill and the react-conventions skill.

## Notes

- Take this **late** — after the play-mode tickets land, so the sweep covers the whole codebase
  once instead of being redone. Newly written modules should carry their header from the start
  regardless; that is the react-conventions rule, not this ticket's job.
- Worth a `git grep "Validates: Requirements" | wc -l` before and after in the ticket report, so
  the coverage change is visible.
- Don't turn this into a documentation-comment sweep. The header is the deliverable; rewriting
  every module's description is out of scope.
