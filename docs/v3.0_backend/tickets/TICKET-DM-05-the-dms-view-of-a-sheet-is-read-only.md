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

## Acceptance criteria

- [ ] A DM opening a player's sheet sees no stat spend, no skill spend, no pool editor, no focus
      picker, no Spellbook control and no roll button — **absent, not present and disabled** — and a
      test enumerates the six surfaces rather than spot-checking two.
- [ ] A Player's own sheet is unchanged, locally and at a table: every control they had before this
      ticket is still drawn and still writes.
- [ ] Each surface reads *which actor is asking* from a hook on `useIsDungeonMaster`, never from a
      prop threaded through the sheet — the pattern `usePurseControls`, `useInventoryActs`,
      `usePassiveHandout` and `useQuickActions` already set, with no fifth spelling of the predicate.
- [ ] Where a number was editable and is now read, the surface still **shows** it (the purse's
      precedent: a display is not the present-and-disabled control the rule rejects), and says who
      changes it where that is not obvious.
- [ ] The sections still compose `components/ui/` primitives on theme tokens; an optional handler
      adds no layout to a base component and no raw `<button>`/`<input>` anywhere.
- [ ] Unit tests cover: *should draw no spend control on a stat for the table's DM*; *should draw no
      roll button for the table's DM, because the server refuses a DM's roll*; *should draw every
      control for a Player on their own sheet at a table*; *should draw every control on a local
      sheet, where there is no DM*; and one case per remaining surface asserting the display survives
      the control's removal.
- [ ] `fallow audit --base main` reports `complexity_introduced: 0` — `CharacterSheet` is already
      measured and must not be made worse by six more conditionals; if the honest fix pushes it over,
      the surface's decision moves into the surface, as TICKET-DM-03's sidebar did.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts (ask the User first).

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
