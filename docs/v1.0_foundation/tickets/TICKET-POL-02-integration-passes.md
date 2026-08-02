# TICKET-POL-02 — Integration passes: persistence round-trip, multi-race, recalculation flows

- **Area:** Polish / integration
- **Type:** Refactor (verification)
- **Traceability:** Requirements 17.1, 17.2, 17.3, 17.4, 8.3, 8.4, 3.6, 13.3
- **Replaces plan items:** tasks.md §17.1, §17.3, §17.4

## User story

As a Developer, I want the flows that cross module boundaries proven end to end, so that "the units
all pass" cannot hide a break in how they fit together.

## Description

Three plan items are verification rather than construction: stores wired to components, multi-race
bonuses, and formula recalculation. Two are already covered by tests written along the way. This
ticket audits all three honestly and writes tests only for what is genuinely unproven.

## Current situation (as-is)

Audited at implementation time rather than assumed:

- **§17.3 multi-race — already covered.** `calculator.test.ts` has *"should calculate stats with
  multiple races"* and *"should combine racial modifiers from multiple races additively and keep
  them separable"*; `CharacterSheet.test.tsx` has *"should combine racial modifiers additively
  across multiple races"*, which also proves the sheet displays them. Nothing to add.
- **§17.1 stores wired — partly covered.** Each store's own test asserts its actions persist, and
  `__root.test.tsx` asserts the root layout is the single hydration point. What is **not** proven is
  a genuine round trip: state written by an action, read back by the loader, and restored intact.
  The storage service and the stores are always tested with each other mocked out.
- **§17.4 recalculation — partly covered.** `InventoryPanel.test.tsx` proves equipment changes move
  main, stat and combat values on the sheet (Req 13.3). Nothing proves the other two flows the plan
  names: **stats recalculating when main skill levels change** (Req 3.6), and **speciality skills
  recalculating when their dependencies change**. `grep -rln "recalc" --include=*.test.*` returns
  nothing.

## Desired result (to-be)

- One integration test module covering the flows that cross boundaries, distinct from the unit
  tests that mock those boundaries away.
- A real persistence round trip: a store action writes, `localStorage` genuinely holds it, a fresh
  store instance loads it back, and the restored state matches.
- The two unproven recalculation flows asserted through `calculateCharacter`, since that is what
  every screen reads.
- The already-covered items recorded as covered, with the test names, rather than re-tested for the
  sake of a tick.

## Acceptance criteria

- [x] A persistence round trip is proven without mocking the storage service: an action writes,
      `localStorage` holds the serialised value, and a fresh load restores an equal object
      (Req 17.1, 17.2, 17.3, 17.4). ([`src/integration.test.ts`](../../../src/integration.test.ts), 4 tests. Configuration and characters each go store → `localStorage` → fresh load → deep-equal. *"should survive an edit made after a reload"* goes further: create, reload, edit, reload again, and the edit is still there — the flow a Player actually performs across sessions. *"should read back what the service wrote, with no store involved"* pins the service directly, since every store test mocks it out.)
- [x] Changing a character's main skill levels changes the stats derived from them (Req 3.6),
      asserted through `calculateCharacter`. (Test *"should move stats when main skill levels change"* — `STR 5 → 9` moves Health `50 → 90` on the `STR * 10` formula.)
- [x] Changing a speciality skill's inputs changes its total (Req 4.4), and changing a combat
      skill's inputs changes its bonus (Req 5.4). (Tests *"should move a speciality skill when its formula inputs change"* (`DEX 4 → 10` moves Stealth by exactly 6) and *"should move a combat bonus when the skills it names change"*. The combat fixture is `STR + STL` where Stealth itself reads `DEX`, so it proves the **chain** re-derives, not just one hop.)
- [x] The multi-race and equipment-recalculation items are recorded as already covered, naming the
      existing tests, rather than duplicated. (In the as-is above. Multi-race: `calculator.test.ts`'s *"should calculate stats with multiple races"* and *"should combine racial modifiers from multiple races additively and keep them separable"*, plus `CharacterSheet.test.tsx`'s *"should combine racial modifiers additively across multiple races"*. Equipment recalculation: `InventoryPanel.test.tsx`'s three equipment-bonus tests. One new multi-race test was added anyway — *"should combine multiple races additively through the whole chain"* — because none of the existing ones prove the extra racial point carries **through** into a speciality skill.)
- [x] Tests are integration-level — they exercise the real store, the real engine and the real
      storage service together, and say so in the module header. (No `vi.mock` anywhere in the file; the header states why that is the point, since a test that mocks the storage service cannot prove persistence.)
- [x] No production code changes: this ticket adds tests. If it finds a genuine bug, that becomes
      its own ticket rather than being fixed quietly here. (`git diff --stat` for this ticket touches only `src/integration.test.ts` and docs. **It did find one**, and it was not fixed here: a main skill the character never allocated is absent from the formula context, so `calculateCharacter` throws `Undefined variable: DEX` for any formula naming it. That breaks every existing character's sheet the moment a main skill is added to the ruleset. Raised as its own ticket; the fixtures here allocate every main skill, with a comment saying why.)
- [x] Verified via the fallow skill and the coding-conventions skill. (`fallow audit --base HEAD` → `"verdict": "pass"`, 0 introduced findings. 660 passing, 0 failing, 0 skipped. `yarn run check` clean; `npx tsc --noEmit` at 4.)

## Notes

- The value of these tests is precisely that they **do not** mock the seam under test. A test that
  mocks the storage service cannot prove persistence, which is why the existing store tests do not
  close §17.1 on their own.
- `localStorage` is available in the jsdom environment, so the round trip needs no fake — clearing
  it between tests is enough.
- Derived values are computed at read time, so "recalculation" is not an event to observe: it is
  the absence of stale state. The tests assert that a second `calculateCharacter` call over changed
  inputs returns changed outputs, which is what the requirement actually means here.
