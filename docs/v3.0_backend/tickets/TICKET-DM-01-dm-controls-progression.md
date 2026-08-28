# TICKET-DM-01 — DM controls: experience, point grants, resources

- **Area:** Dungeon Master controls (new area)
- **Type:** Feature
- **Traceability:** v3 [Req 42.1–42.4](../requirements.md#requirement-42-dungeon-master-controls);
  overview [D9](../overview.md#d9--level-stays-derived-points-to-spend-becomes-a-grant)

## User story

As a DM, I want to award experience, hand out extra points and set a player's health, so that what
happened at the table is reflected on their sheet.

## Description

The DM's powers over a Character they do not own. Its substance is **D9**: the User asked for a DM
who can edit a player's *level* and their *points to spend*, and neither is a field. Making them
fields would break the rule the whole engine rests on — that derived values are computed, never
stored. So:

- **Level** stays derived from experience. The DM sets experience; the level follows.
- **Points to spend** becomes a **grant** — a new piece of stored player state — so the budget is
  `derived pool + grants` rather than a stored number that could disagree with the level.

## Current situation (as-is)

- `calculateCharacterLevel` reads level backwards out of the `xp_thresholds` curve from accumulated
  XP (TICKET-RES-01); `validateStatAllocation` prices the pool as `level × const.points_per_level`
  (TICKET-RES-02). Both return `FormulaResult`s, so an unreadable curve chips rather than claiming 1.
- `awardExperience`/`deductExperience` are the only writers of `experience`, and a deduction below 0
  is **refused**, not clamped.
- The sanctioned stored player state is exactly `currentResourceValues`, `experience`, invested
  points, and — since CUR-02 — `purse`. [CLAUDE.md](../../../CLAUDE.md) enumerates them.
- PLY-01 moved the player's own writes to the server and established the Event log with before/after
  values.

## Desired result (to-be)

- `Character.grantedStatPoints?: number` — the DM's extra points, absent meaning none — and
  `validateStatAllocation` pricing the pool as `derived pool + grants`. It is the **third**
  sanctioned exception to derived-values-are-never-stored, and CLAUDE.md plus the **data-model**
  skill say so in the same change.
- DM routes behind `requireDM`: award/deduct experience, grant/revoke points, set current resource
  values — each on any Character in their session, each under the same Kernel rules a Player's own
  action obeys, each writing an Event naming the DM and the before and after values.
- A DM panel on a player's sheet exposing exactly those three, with a "set level to N" affordance
  that computes and writes the threshold experience — never a stored level.

## Acceptance criteria

- [x] Awarding experience moves the derived level with nothing else stored; there is no writable
      level field anywhere, asserted by a test that greps the persisted shape.
      (`POST /api/characters/:id/dm-award-experience` →
      [dmAwardExperience.ts](../../../src/server/routes/dm/dmAwardExperience.ts), whose rule is
      `addExperience` in [dmActions.ts](../../../src/shared/services/dmActions.ts). `dm.test.ts` —
      *moves the derived level with nothing else stored — there is no level on the document*, which
      reads the row back off disk, asserts `calculateCharacterLevel` went 1 → 3 on a pinned XP
      ladder, and then greps the persisted JSON for `"level"`.)
- [x] "Set level to N" writes the `xp_thresholds` threshold XP for N and is refused, with the reason,
      when the curve cannot price N — never falling back to a guess.
      (`experienceForLevel` in [characterSummary.ts](../../../src/shared/engine/characterSummary.ts)
      reads the **same** curve forwards, then feeds its own answer back through
      `calculateCharacterLevel` and refuses anything that does not read back as the level asked for.
      `dm.test.ts` — *writes the threshold experience for that level, never a level* and *is refused
      with the reason when the curve cannot price that level*, the second run against the corpus's
      own single-row placeholder, which would otherwise extrapolate a confident **0 XP** for level 7.
      `characterSummary.test.ts` adds the round-trip over every rung and the extrapolating case.)
- [x] A grant raises the budget `validateStatAllocation` reports, and the Player can then spend it
      through PLY-01's unchanged route.
      (`Character.grantedStatPoints`, priced in
      [skillAllocation.ts](../../../src/shared/engine/skillAllocation.ts) as `derived pool + grants`.
      `dm.test.ts` — *raises the budget, and the Player then spends it through their own unchanged
      route*, which grants 5, asserts the budget moved by exactly 5, and then calls
      `investStatPoints` **as the player** for a total the derived pool alone could not cover.)
- [x] Revoking a grant that would leave the Character having overspent is **refused**, naming the
      overspend (v3 Req 42.4) — the same refuse-don't-clamp discipline as RES-02's spend.
      (`setGrantedPoints` asks `validateStatAllocation` rather than doing arithmetic — points are
      priced through the `point_buy` curve. `dm.test.ts` — *refuses a revocation that would leave the
      character overspent, and names the overspend* (`"5 points overspent"`), plus *allows a
      revocation the character can still afford*. `dmActions.test.ts` adds the singular/plural case
      and *never refuses a raise, even on an allocation that is already invalid*.)
- [x] A deduction below zero experience is refused, not clamped — the existing rule, now server-side.
      (`removeExperience`, which is the rule `characterStore.deductExperience` now calls too — it
      **moved** to the Kernel rather than being copied, so there is one implementation for both
      roots. `dm.test.ts` — *refuses a deduction below zero rather than clamping it, and writes
      nothing*, which also asserts the log has one row rather than two.)
- [x] Every DM adjustment writes one Event naming the DM, the Character, and before/after; a Player
      reads the Events that changed their own sheet.
      (The routes reuse `applyPlayerAction`, which writes the character and its Event in one
      transaction; `DM_ACTION`'s values are the `event.type` column's.
      `GET /api/characters/:id/adjustments` →
      [listAdjustments.ts](../../../src/server/routes/dm/listAdjustments.ts), rendered by
      [AdjustmentLog.tsx](../../../src/client/components/play/dm/AdjustmentLog.tsx) on the sheet.
      `dm.test.ts` — *writes one Event naming the DM, the character and the before and after* and
      *lets the Player read back the adjustments that changed their own sheet, newest first*, plus
      *shows a Player nothing of another character's history*. `describeAdjustment.test.ts` proves a
      `dm-set-level` reads back as the **experience** it wrote and never as a level.)
- [x] A `player` Member calling any DM route is refused; the DM's own character gets no special path.
      (`requireCharacterDM` in [guards.ts](../../../src/server/auth/guards.ts) — the writer rule minus
      the *owner*, exactly as `requireCharacterPlayer` is that rule minus the DM. `dm.test.ts` —
      *refuses a `player` Member with the same 404 a stranger gets*, which asserts the owner's
      refusal is **byte-identical** to the one an id nobody minted gets, and *gives the DM's own
      character no special path — it is adjusted as a DM adjustment*, which checks the Event is
      written with the DM as actor. `dmRules.test.ts` adds the claim `routeGuards.test.ts` cannot
      make: every write module calls the **DM** guard, not the writer guard a Player also passes.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts (ask the User first).

      **`verifier`**: `npx vitest run` **3037 passed / 0 failed / 0 skipped** across 190 files
      (3033 across 189 at the time of the run below; the review pass added four);
      `npx tsc --noEmit` at the documented 2-error baseline and nothing else; `yarn run lint` clean
      over 656 files; `yarn run arch` clean over 677 modules. It also caught that this file's first
      draft recorded **3031** — a count taken before the last two `CharacterSheet.test.tsx` cases
      landed — and [TEST_STATUS.md](../../../TEST_STATUS.md) now carries the measured 3033 and a
      per-file delta measured against `main` rather than counted by eye.

      **`fallow audit --base main`**: the gate passes. Zero dead code introduced. Complexity: the
      three remaining findings are all inherited (`useCharacterSheet`, `validateStatAllocation`,
      `SkillAllocationStep`); `CharacterSheet` was *introduced* at 18 cyclomatic and taken back off
      the list at 12 by splitting `SheetStatusNotice` and `SheetRefusalBanner` out of it in this same
      change. Duplication: one deliberate 13-line clone, reasoned about above. Hotspots: the touched
      *Accelerating* files are recorded in TEST_STATUS.md, and `guards.ts`, `characterRepository.ts`
      and `SessionList.tsx` all **cooled**.

      **Browser, two accounts, one table** (`DM-01 check`, a DM and a player who is not the DM):
      - The DM's row for a character they do not own reads ***Adjust as DM*** and opens the sheet;
        the player's own row still reads *Open sheet* and no row opens somebody else's for them.
      - **Award 300 XP** → header moved to *300 XP*, `Experience: 300`, and the log gained
        *"Awarded 300 experience — 0 → 300 · dm01-player@example.com"*.
      - **Set grant 5** → the sheet tally went **0/3 → 0/8, "INCL. 5 GRANTED"**, and the log gained
        *"Granted stat points — 0 → 5"*.
      - **Deduct 500 from 300** → refused in the banner with *"That would take Nibbles below zero
        experience — they have 300. Nothing was deducted."*, and `Experience: 300` unchanged.
      - **Set level to 4** on a ruleset whose `xp_thresholds` is CRV-03's single-row placeholder →
        refused with *"This ruleset cannot price level 4: curve.xp_thresholds cannot price level 4 —
        0 experience reads back as level 1"*, and nothing written. That is the round-trip guard
        firing in a real browser against the exact ruleset that would otherwise have written a
        confident **0 XP**.
      - **Signed in as the player**, on their own sheet: **no** DM controls panel (v3 Req 42.7's
        first half), the header reading *Level 1 · 300 XP*, the tally reading *0/8 incl. 5 granted*,
        and both adjustments in the log with the DM's address and before/after.
      - Network trace clean: `GET /api/characters/:id/adjustments` → 200,
        `POST /api/characters/:id/dm-set-level` → 400 for the refusal, no unexpected console errors.

      **One sub-case was not reachable in the browser and is left stated rather than implied**: the
      *accepted* path of "set level to N". Every ruleset on that dev server carries CRV-03's
      placeholder XP curve, which cannot price any level but 1 — so the browser could only ever show
      the refusal. Editing a curve and re-checking does not help: a session plays by its **Snapshot**
      (D7) and there is no *pull a new Snapshot* surface yet, so a real ladder cannot reach a running
      table. It is covered by four tests against a real four-rung ladder — `dm.test.ts`'s *writes the
      threshold experience for that level, never a level* and *records the experience it moved, not
      the level it was asked for*, plus `dmActions.test.ts` and `characterSummary.test.ts`'s
      round-trip over every rung — and the client half of that path is the same send-wait-adopt the
      award and the grant both exercised live.

## Implementation notes (2026-08-27)

Four things this built that the to-be did not say, and one it deliberately did not build.

- **The DM needed a way to *reach* a player's sheet, so the ticket gave them one.** `SessionCharacters`
  offered *Open sheet* only on your own character (PLY-01's note: "reading another player's is
  DM-04's roster"), which would have left this ticket's panel with no door. The row now offers
  *Adjust as DM* on every character when the reader is the DM — three lines and one prop through
  `SessionList`. The **roster** that acts on characters without opening them is still DM-04's.
- **A sixth route, `GET /api/characters/:id/adjustments`.** v3 Req 42.7's second half — *the Client
  shall show a Player the Events that changed their own sheet* — has no surface without one, and the
  criterion above asks for it. It narrows to the character **in the query** (`json_extract` on the
  payload) rather than after the cap, because `listRolls`' review found that filtering a table-wide
  window in the handler drops somebody's own history off a busy table with nothing saying so.
- **`applyPlayerAction` was widened rather than copied.** A DM adjustment is the same operation as a
  player action — run a Kernel rule, persist the answer, log what moved and who moved it — so
  `PlayerActionEvent.action` became `SheetAction` and the DM routes call PLY-01's pipeline. The
  `actor` parameter that pipeline already had was put there for exactly this.
- **`CharacterSheet` was split, because `fallow` said so.** The DM panel and the adjustment log took
  it from 13 to 18 cyclomatic; its six dead-end notices are now `SheetStatusNotice` and its refusal
  banner is `SheetRefusalBanner`. Recorded in [TEST_STATUS.md](../../../TEST_STATUS.md)'s hotspot
  table, which is where the rule says a touched *Accelerating* file goes.
- **A DM has no UI for adjusting their *own* table character, and the client cannot fix that on its
  own.** The server deliberately allows it — `requireCharacterDM` lets the owner through and then
  asks only about the table, and `dm.test.ts` asserts the Event is written with the DM as actor — but
  no surface reaches it: `SheetHeader` withholds the Player's experience control for *any* table
  character (D9), and `useDmControls` withholds the DM panel on a character that is the reader's own.
  The review proposed dropping that second term. **It would be wrong**, and the reason is worth
  writing down: the client deduces DM-ness from *this is at a table and it is not mine*, which is
  sound only because the server opens a character to its owner **or** its table's DM. For a character
  that **is** mine that deduction has nothing to say, so dropping the term would draw the DM's panel
  on every Player's own sheet — controls whose every write meets a 404. Answering it properly needs
  the *role*, which means a request the sheet does not make today. Left as a gap, on the same
  reasoning as the one below: TICKET-DM-03 and DM-04 own the DM's surfaces.
- **The DM's view of a player's sheet is *not* read-only, and that is a stated gap rather than an
  oversight.** The Player's own controls — the stat and skill spends, the pool editors, the pack —
  are still drawn on it and would meet the server's 404, because `requireCharacterPlayer` refuses a
  DM. The rule is enforced where it belongs (the server) and nothing can be corrupted through it; what
  is missing is the *affordance*. Hiding them means threading an optional handler through seven
  components, which is placement rather than mechanism — **TICKET-DM-03 is the sheet-sidebar ticket
  and is where it belongs.** Left visible rather than half-hidden so the gap is obvious.

`fallow` also reports a **13-line clone** between `dmAwardExperience` and `dmDeductExperience`. It is
deliberate: one module per route is what makes `routeGuards.test.ts` able to scan for a guard *call
site* at all, and merging them would trade a real check for eleven lines. PLY-01 accepted the same
shape eleven times over.

**What the `conventions-reviewer` pass changed**, beyond the two gaps recorded above:

- `CharacterSheetStatus` became a **const object**. Exporting it so `SheetStatusNotice` could take
  one put the same six literals in three modules, which is exactly where the house rule says a bare
  union stops being grandfathered.
- `ExperienceControl` gained `isBusy`. It is the one control on the DM panel that sends a **delta**,
  and the store swallows a second write while one is in flight — so a double-tap lost 300 experience
  with the box cleared as though it had landed. The other four controls send totals and were already
  guarded.
- `readableMoment` **moved** from `components/sessions/` to `components/shared/`. Its own docblock
  claims *"there is exactly one way this app writes a moment down"*, and the adjustment log had
  quietly written a second one — which is what happens when the only copy lives in a folder the
  caller has no business importing from.
- `grantedFrom` now reads `Number.isInteger`. `Number.isFinite` let a stored `2.5` price a budget
  that `setGrantedPoints` would never have granted, so the reader and the writer disagreed.
- `SheetStatusNotice` takes `characterName` rather than the whole `Character`; `AdjustmentField`'s
  `current` stopped being optional when all three callers pass it; and
  `useCharacterAdjustments.test.ts` now proves the out-of-order guard the hook's docblock describes —
  the case where the *pre*-adjustment answer lands after the post-adjustment one and would leave the
  log an entry short of the number beside it.
- Narrowing that prop put `CharacterSheet` **back over** the complexity threshold (12 → 15), because
  `character?.name ?? null` is two more branches in the one function `fallow` was measuring. So
  `useCharacterAdjustments` now takes the **character** rather than an id and an opaque stamp: both
  halves of *which sheet, as it now stands* come off the same object, the three null checks live in
  the hook that is about them, and the component is off the list again.

## Notes

- **Why a grant rather than a stored budget.** A stored budget is a derived value with a second
  writer: award XP and it silently disagrees with the level. A grant is genuinely new information —
  "the DM gave you three points" is not derivable from anything — so it is state by the same test
  that admitted `experience`. The pool stays derived; the grant is an input to it.
- `grantedStatPoints` is a single number rather than per-stat. Points are fungible in this system —
  the archetype decides what they *buy*, per stat, through the `point_buy` curve (TICKET-ARC-02) —
  so a per-stat grant would be a second, contradictory exchange rate.
- The affordability check after a revoke must use the Kernel's `validateStatAllocation`, not
  arithmetic. Points spent are priced through the point-buy curve, and re-deriving that here is
  exactly the duplication v3 Req 45.5 forbids.
