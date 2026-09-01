# TICKET-DM-05 — The DM's view of a player's sheet is read-only

- **Area:** Dungeon Master controls
- **Type:** Bug fix
- **Traceability:** v3
  [Req 42.7](../requirements.md#requirement-42-dungeon-master-controls),
  [Req 41.1](../requirements.md#requirement-41-player-actions),
  [Req 49.10](../requirements.md#requirement-49-dungeon-master-quick-actions);
  v1.0 [Req 21](../../v1.0_foundation/requirements.md#requirement-21-component-library-architecture)

## User story

As a DM looking at a player's sheet, I want to see only the controls I can actually use, so that I
do not press a button that silently fails and then wonder whether the table's numbers are right.

## Description

The gap TICKET-DM-01 recorded and deliberately deferred, and TICKET-DM-02 half-closed. **A DM opening
somebody else's sheet is shown the Player's own controls** — the stat and skill spends, the pool
editors, the focus picker, the Spellbook and the roll buttons — and every one of those writes meets a
404, because `requireCharacterPlayer` is `requireCharacterWriter` **minus the DM**.

Nothing can be corrupted through them; the rule is enforced where it belongs. What is missing is the
*affordance*, and an affordance that never works is worse than an absent one — it invites a DM to
believe a change landed and to stop looking.

## Current situation (as-is)

- [`guards.ts`](../../../src/server/auth/guards.ts)'s `requireCharacterPlayer` is the writer rule
  minus the DM, and **every module in [`routes/play/`](../../../src/server/routes/play/) uses it**.
  So does [`rollDice.ts`](../../../src/server/routes/rolls/rollDice.ts), whose own docblock says *a
  DM rolling for a player is out of scope* — which means even the roll buttons are dead on a DM's
  view, a detail found while planning TICKET-DM-03 and easy to rediscover expensively.
- **Two of the surfaces are already closed, and they set the pattern.** TICKET-DM-02 gave the pack
  [`useInventoryActs`](../../../src/client/components/play/inventory/useInventoryActs.ts) and the
  purse [`usePurseControls`](../../../src/client/components/play/sheet/usePurseControls.ts): a hook
  answers *which actor's store actions this card calls*, returning `null` for a reader who may not
  write, and the card draws a **display** rather than a disabled control. TICKET-PAS-01's
  `usePassiveHandout` is the same shape a third time, and TICKET-DM-03's `useQuickActions` a fourth.
  What the four share is the predicate,
  [`useIsDungeonMaster`](../../../src/client/components/play/dm/useIsDungeonMaster.ts).
- **Six surfaces are still open**, all reached from
  [`CharacterSheet.tsx`](../../../src/client/components/play/sheet/CharacterSheet.tsx) with handlers
  from [`useSheetActions.ts`](../../../src/client/components/play/sheet/useSheetActions.ts):

  | Surface | Handlers drawn | Route they meet |
  |---|---|---|
  | [`ResourcesSection`](../../../src/client/components/play/sheet/ResourcesSection.tsx) | `onChangeStatValue`, `onAdjustStatValue`, `onResetStatValueToMax`, `onChangeInvestedPoints` | `set-resource`, `adjust-resource`, `reset-resource`, `invest-stat-points` |
  | [`StatsSection`](../../../src/client/components/play/sheet/StatsSection.tsx) | `onChangeInvestedPoints` | `invest-stat-points` |
  | [`SkillsSection`](../../../src/client/components/play/sheet/SkillsSection.tsx) | `onChangeInvestedPoints` | `invest-skill-points` |
  | [`FocusSkillsSection`](../../../src/client/components/play/sheet/FocusSkillsSection.tsx) | `onSelectFocusSkill` | `set-focus-skills` |
  | [`SpellbookPanel`](../../../src/client/components/play/spells/SpellbookPanel.tsx) | learn, unlearn, cast (inside `useSpellbook`) | `learn-spell`, `unlearn-spell`, `cast-spell` |
  | [`RollsSection`](../../../src/client/components/play/sheet/RollsSection.tsx) | `canRoll`, `onRoll` (from `useRoller`) | `roll` |

- `SheetHeader` already withholds the experience and dream-level controls at a table, so the
  optional-handler shape exists on this sheet and is not being invented here.
- DM-01's note is the standing record of the decision: *"Left visible rather than half-hidden so the
  gap is obvious."* This ticket closes it.

## Desired result (to-be)

- **Each of the six surfaces takes its handlers as optional and draws a display when it has none**,
  reached by a hook that answers *which actor is asking* — `usePurseControls`' shape, on the shared
  `useIsDungeonMaster` predicate, not a `isDungeonMaster` prop threaded down through the tree.
- **Absent, not disabled** (v3 Req 49.10's discipline, applied to the Player's controls this time): a
  DM reads the numbers and reaches for `DmControlsPanel` and `QuickActionsSidebar` for anything they
  may change. A Player's own sheet is untouched.
- **The roll buttons are absent for the DM too**, with the panel saying whose roll it is — `rollDice`
  refuses a DM by design, so a live-looking roll button is the most misleading control on the page.

## Decided while building (2026-09-01)

**The hook answers with absent *fields*, not with `null`** — `usePlayerControls` returns a
`PlayerControls` whose six members are each optional, where `usePurseControls`, `useInventoryActs`,
`usePassiveHandout` and `useQuickActions` each return `X | null`. The precedent is **extended rather
than broken**, and the User approved the deviation before the build: those four each feed **one**
surface, where `null` is the whole answer; this one feeds **five**, and optional fields let
`useCharacterSheet` spread it exactly where it already spreads `...actions`. Two things follow that
matter more than the shape — `CharacterSheet.tsx` changes in **comments only**, so DM-03's 9.7 and the
first recorded fall stand; and absence is modelled *as absence*, which is the same thing the sections
are asked to render. The strict shape would have cost a `controls?.x` at each of seven handler props —
a new conditional per prop, which is exactly what criterion 7 forbids. The reasoning is in
[`usePlayerControls`](../../../src/client/components/play/sheet/usePlayerControls.ts)' own docblock so
the next reader does not "correct" it back.

**Six handlers left `useSheetActions` rather than being wrapped in place**, TICKET-DM-02's recorded
move for the purse pair and its reasoning: a write whose *actor depends on the reader* is a different
subject from *what the Player can do*. That hook is four handlers and no `Configuration` now.

**`useRoller` took the predicate directly** rather than growing a `useRollControls` wrapper. It *is*
the rolls surface's hook and `handleRoll` has one consumer, so a wrapper would be an abstraction with
no second caller.

**[v3 Req 42.7](../requirements.md#requirement-42-dungeon-master-controls) is amended in this same
change, and a requirement change outranks a ticket.** The review found that both of 42.7's clauses ran
DM-ward — *who may see the DM's controls*, and *what Events a Player may read* — and that 49.10's
*absent, not present and disabled* is explicitly scoped to Quick_Actions and also runs DM-ward. So
**neither text, read literally, required what this ticket builds**: withholding a **Player's own**
controls from a DM. Sixteen `**Validates: … v3 Req 42.7, 49.10**` lines would have cited a requirement
by analogy, and once written an analogy is indistinguishable from a citation. The third clause —
*"and SHALL present a Player's own controls only to that Player — absent for any other reader, not
present and disabled"* — is added in 42.7's own style with a dated, attributed note, following DM-03's
amendment of 49.3. The code was right; only the spec was short.

## Acceptance criteria

- [x] A DM opening a player's sheet sees no stat spend, no skill spend, no pool editor, no focus
      picker, no Spellbook control and no roll button — **absent, not present and disabled** — and a
      test enumerates the six surfaces rather than spot-checking two.
      (`sheet/CharacterSheet.dmView.test.tsx`: `SURFACES` is the six, each named by the control that
      goes and the reading that stays, driven through `it.each` as *should draw no $surface* — plus
      *should draw no spend control on a stat, present-and-disabled being the thing rejected*, which
      asserts both buttons are absent rather than merely unpressable.)
- [x] A Player's own sheet is unchanged, locally and at a table: every control they had before this
      ticket is still drawn and still writes.
      (`CharacterSheet.dmView.test.tsx`'s two closing blocks run the same six `SURFACES` for *a Player
      on their own sheet at a table* and *a character in this browser*; `usePlayerControls.test.ts`
      asserts all six handlers are bound in both cases and reach the Player's own store actions. The
      82 pre-existing cases in `CharacterSheet.test.tsx` are untouched and pass.)
- [x] Each surface reads *which actor is asking* from a hook on `useIsDungeonMaster`, never from a
      prop threaded through the sheet — the pattern `usePurseControls`, `useInventoryActs`,
      `usePassiveHandout` and `useQuickActions` already set, with no fifth spelling of the predicate.
      (Three hooks call the shared predicate and nothing else derives it:
      `sheet/usePlayerControls.ts` for the five sheet sections, `rolls/useRoller.ts` for the roll
      buttons, `spells/useSpellbook.ts` for the book. No component takes an `isDungeonMaster` prop —
      `grep -rn "isDungeonMaster" src/client/components` finds it only inside hooks — these three plus
      DM-01's and DM-02's — and in `CharacterSheet`'s pre-existing `dm.isDungeonMaster &&` around the
      DM panel.)
- [x] Where a number was editable and is now read, the surface still **shows** it (the purse's
      precedent: a display is not the present-and-disabled control the rule rejects), and says who
      changes it where that is not obvious.
      (`CharacterSheet.dmView.test.tsx`'s *should still show what $surface sat beside* — 39 points
      spent, 3 points spent, `of 390 max`, the focus pick, the spell's name, `1D20 + 1D12 + 1D6 + 1`.
      `CountRow` gained the reading-without-buttons branch, so a DM keeps *6 points spent*
      (`StatsSection.test.tsx`), and `RollsSection` moved the ladder off the button label into text.
      Each of the five surfaces says who acts instead — asserted in `ResourcesSection.test.tsx`,
      `StatsSection.test.tsx`, `SkillsSection.test.tsx`, `FocusSkillsSection.test.tsx`,
      `RollsSection.test.tsx` and `SpellbookPanel.test.tsx`.)
- [x] The sections still compose `components/ui/` primitives on theme tokens; an optional handler
      adds no layout to a base component and no raw `<button>`/`<input>` anywhere.
      (Every read-only branch is `Text` and `Card` only; `StatEditor`'s reading is two `Text`s where
      the editor's `Label`/`Input`/`Button` were, and the `Label` moved *inside* the editable branch
      so `htmlFor` never names a box that is not rendered. No file in the diff adds a class to a
      `components/ui/` component and none introduces a raw element or a colour —
      `yarn run lint` and `yarn run check` are clean.)
- [x] Unit tests cover: *should draw no spend control on a stat for the table's DM*; *should draw no
      roll button for the table's DM, because the server refuses a DM's roll*; *should draw every
      control for a Player on their own sheet at a table*; *should draw every control on a local
      sheet, where there is no DM*; and one case per remaining surface asserting the display survives
      the control's removal.
      (The first four are named cases in `CharacterSheet.dmView.test.tsx`. The per-surface displays
      are pure-prop cases added by omitting the handler: `ResourcesSection.test.tsx` +3,
      `StatsSection.test.tsx` +4, `RollsSection.test.tsx` +5, `SpellbookPanel.test.tsx` +5, plus three
      new files for the components that had none — `SkillsSection.test.tsx` (5),
      `FocusSkillsSection.test.tsx` (7) and `StatEditor.test.tsx` (9), the last added in the review
      pass for the **two-of-three-handlers** case, which no caller passes today and nothing proved
      degrades to the reading rather than crashing.)
- [x] `fallow audit --base main` reports `complexity_introduced: 0` — `CharacterSheet` is already
      measured and must not be made worse by six more conditionals; if the honest fix pushes it over,
      the surface's decision moves into the surface, as TICKET-DM-03's sidebar did.
      (`complexity_introduced: 0`, `dead_code_introduced: 0`, `duplication_introduced: 0`.
      `CharacterSheet.tsx` never entered the list — its diff is comments only. **`useSpellbook` did**,
      at 13 cyclomatic / 17 cognitive on the first measurement — the **cognitive** threshold alone,
      fallow's pair being 20 / 15 — and was split rather than suppressed: `bindActs`, `choosePool` and
      `searchUnlearned` are now module-level, and the hook is off the list. The one remaining finding,
      `useCharacterSheet` at 16/19, comes back `introduced: false`. **Unit size is a separate list and
      the review caught it**: `StatEditor` had grown to 108 lines on the very-high-risk (>60) list, so
      the read-only half is now a module-level `PoolReading` and the row's one decision has its own
      test file.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts (ask the User first).
      **Left open deliberately, and only the live half is missing.** The verification itself ran in
      full — `npx vitest run` 3952 passed across 237 files with 0 failing and 0 skipped,
      `npx tsc --noEmit` at the documented 2-error baseline, `yarn run check` clean (biome lint +
      format + import sorting, then dependency-cruiser: no violations across 795 modules), and all
      three `fallow` commands. What did not run: **the User declined interactive browser checks for
      the rest of the v3.0 milestone on 2026-09-01**, so no two-account check was attempted or asked
      for; and the `conventions-reviewer` pass is the User's own to run on the diff.

## Notes

- **Nothing in `docs/imports/` is owed.** No `Configuration` entity is added or reshaped and no
  persisted `Character` field is touched — this is affordance work over routes that already exist.
- **This is not a server change.** Every one of the six routes already refuses correctly, and none of
  them should start allowing a DM: a DM who wants a player's points spent differently has
  `dm-grant-points`, and a DM who wants a roll made asks the Player to make it. If a case turns up
  where the DM genuinely needs one of these acts, that is a new `dm-` route with its own Event type
  and its own ticket, not a relaxed guard.
- **Six surfaces is the size of it, and that is why this is its own ticket.** DM-03 measured the work
  during planning and the User split it out rather than making it a ninth criterion there, on the
  three-to-be-items rule.
- The `SpellbookPanel` case has a wrinkle worth stating: `castSpell` spends a pool, so a DM who wants
  a cast recorded uses the quick actions to move the pool and the Player casts. Say that on the panel
  rather than leaving the reader to work it out.

## Changed in the review pass (2026-09-01)

Eleven findings, five of them blocking. What moved the code rather than the prose:

- **v3 Req 42.7 gained its third clause** — see *Decided while building* above. The spec was short, not
  the code.
- **Two `Validates:` citations were wrong and are gone.** `usePlayerControls` had inherited v1.0 Req
  12.5 (moving items between slots and the Backpack — `useInventoryActs`' subject, not this hook's),
  and `useSheetActions` kept 14.5 (persisting current stat values) after every handler that touches
  one had left it. Traceability is checked by grep, so a wrong citation is indistinguishable from a
  right one; `useSheetActions` now cites no v1.0 requirement at all rather than a plausible one.
- **`StatEditor` had grown to 108 lines on `fallow`'s very-high-risk unit-size list** — a separate list
  from the complexity one, so `complexity_introduced: 0` said nothing about it — while gaining its
  first decision and no test. The read-only half is now a module-level `PoolReading` and
  `StatEditor.test.tsx` covers three → controls, none → reading, and **two of three → reading**. That
  last case is unreachable through `ResourcesSection` and not forbidden by the type system, and
  nothing proved the row degraded rather than calling an `onAdjust` that is not there.
- **Six copies of the no-controls notice became `play/shared/NoControlsNotice`**, two of them
  byte-identical; the shared sentence is `POINTS_ARE_THE_PLAYERS`, because stats and skills spend one
  pool. `fallow`'s clone detector missed all six — each copy is shorter than its window.
- **`SpellbookPanel` no longer infers *not yours* from an absent handler.** `handleLearn === undefined`
  is also true before a character resolves, so the panel would have told a **Player** that only the
  Player may act. `useSpellbook` returns an explicit `isReadOnly`. The contrast is worth keeping:
  in `usePlayerControls` absence means *exactly* the DM, its handlers being bound whatever the
  character and ruleset are.
- **Three claims about the `useSpellbook` split were wrong and are corrected in all three places**
  (TEST_STATUS, `project-map`, the `bindActs` docblock). 13/17 exceeded the **cognitive** threshold
  only — fallow's pair is 20 / 15 — not both. `bindActs`' docblock and TEST_STATUS contradicted each
  other about why it helped; the honest answer is that it deduplicates one guard across three handlers
  and is *not* what moved the number. And the generalised rule now carries its scope: *in fallow's
  per-function accounting* a nested arrow's guards are not in the enclosing count. SonarSource-style
  cognitive complexity aggregates nested functions upward, so the reading does not travel.
- Smaller: a `new Response(...)` nested inside `Promise.resolve(...)` in the DM-view test's fetch stub;
  the focus-picker row asserting `Stealth`, which the skills grid also renders, so it would have passed
  with `FocusSkillsSection` drawing nothing — it asserts `Focus 1` now; `useIsDungeonMaster`'s docblock
  still saying *"three readers"* when it has seven; `CountRow`'s comment explaining only half of what
  `invested !== 0` suppresses; `SpellbookRow`'s empty flex container when a reader has neither button;
  an `sr-only` phrase on `StatEditor`'s reading to match `CountRow`'s; and `it('should …')` in
  `usePlayerControls.test.ts`.

**And a cost of the shape that is now written down.** All-optional fields mean a dropped or mistyped
handler name compiles **silently to the DM's view**. `usePlayerControls`' docblock says so and names
the mitigation as load-bearing rather than incidental: `HANDLERS` and `SURFACES` enumerate the six by
name across three readers, so a name that stops arriving fails a case instead of quietly hiding a
control.

## Found while building, and deliberately not fixed here (2026-09-01)

- **`docs/imports/` is owed nothing, as predicted.** No `Configuration` entity was added or reshaped,
  no persisted `Character` field was touched, and no `schemaVersion` bump is owed — this is affordance
  work over routes that already exist. Stated explicitly here as TICKET-GAM-04, TICKET-DM-02 and
  TICKET-DM-03 each did.
- **On a DM's view the roll history reads empty**, and that is a real gap left standing.
  [`useRoller`](../../../src/client/components/play/rolls/useRoller.ts) fetches the session's roll log
  filtered to the *reader's own* `accountId` (`?rolledBy=`), which was right while the only reader was
  the character's Player — it is what stops a Player's own rolls falling off a busy table's capped
  window. A DM opening somebody else's sheet therefore asks for **their own** rolls against that
  character and gets none. **Not fixed here**: the table-wide feed is
  [TICKET-DM-04](./TICKET-DM-04-session-roster-with-quick-actions.md)'s roster and
  [TICKET-LIVE-02](./TICKET-LIVE-02-event-fan-out-and-reconciliation.md)'s event fan-out, and building
  half of it now means building it twice. Noted on DM-04 as well, so it does not live only in a closed
  ticket's prose.
- **`RulesetHomeKind` in `client/services/rulesetSync.ts` is an unused exported type**, reported by
  `fallow dead-code` and `introduced: false` — it predates this ticket and nothing here touches that
  module. Left for whoever next opens `rulesetSync.ts`.
