# TICKET-DM-03 — Quick actions derived from the ruleset, and the sheet sidebar

- **Area:** Dungeon Master controls
- **Type:** Feature
- **Traceability:** v3
  [Req 49.1–49.7, 49.10](../requirements.md#requirement-49-dungeon-master-quick-actions),
  [Req 42](../requirements.md#requirement-42-dungeon-master-controls);
  v1.0 [Req 20](../../v1.0_foundation/requirements.md#requirement-20-no-hardcoded-data)

## User story

As a DM with a character sheet open, I want *Damage*, *Restore* and *Give points* one press away in a
sidebar, so that adjusting a character does not mean hunting the right field on their sheet.

## Description

The quick-action **mechanism**, and the first of its two placements. TICKET-DM-04 puts the same
actions on the session roster; this ticket decides what the actions *are* and proves them on one
surface first — the ROLL-01/ROLL-02 precedent of mechanism before placement.

Its defining constraint: **this app has no notion of health or mana**. Those are `isResource` stats
in somebody's ruleset. So the action set is *derived from the Snapshot*, and a table playing a system
with *Vigor* and *Focus* gets *Damage Vigor* and *Restore Focus* for free.

## Current situation (as-is)

- DM-01 and DM-02 gave the DM every power this ticket presents: experience, point grants, resource
  values, inventory and purse — each behind `requireDM`, each Kernel-checked, each writing an Event
  with before/after values.
- Those controls live on a DM panel on the character sheet, one form per power. Nothing about them is
  quick: a DM taking 7 off someone finds the resource field and does the arithmetic.
- `adjustCurrentStatValue(…, delta, config)` already applies a **delta to what is stored** rather
  than to a clamped reading of it, and a fallen maximum leaves a stored current alone and flags it
  (TICKET-RES-03). That is exactly what "take damage" needs, and it already exists.
- `useNumericDraft`'s `allowRelative` already parses `+12` / `-7`, and every editable number on a
  play surface goes through it.
- `Stat.isResource` is the flag that says a stat is a pool spent against a maximum (TICKET-STAT-01).

## Desired result (to-be)

- A `quickActionsFor(snapshot)` derivation in `components/play/shared/` — a pure mapper beside
  `derivedValue.ts` and `pointBudgetView.ts` — returning one *damage* and one *restore* per
  `isResource` stat, labelled from that stat's own name, plus give/take points and award/deduct
  experience. **No stat name, and no word for a kind of resource, appears in the source.**
- Amount entry and safety: presets plus typed relative entry through `useNumericDraft`, an accepted
  action reporting before → after, a refused one reporting the server's reason and leaving the
  surface untouched, and an **undo** that applies the *inverse* through the same route.
- A DM-only sidebar on a Character's detail page rendering that set — absent entirely for a
  `player`, and calling **only** DM-01/DM-02's existing routes.

## Acceptance criteria

> **Implementation note (2026-09-01) — the fourth criterion named a route that did not exist.** It
> asks a resource quick action to apply as a **delta** through `adjustCurrentStatValue`. That is the
> *client* store action, and at a table it sends `PLAYER_ACTION.ADJUST_RESOURCE` — a route guarded by
> `requireCharacterPlayer`, which is `requireCharacterWriter` **minus the DM**, so a DM pressing it
> meets a 404. The DM's only pool route was `dm-set-resource`, which takes an absolute value. The
> ticket was stopped at the plan and the User chose: **add `dm-adjust-resource`**, the delta
> counterpart, running the *identical* `adjustResourceValue` the Player's own route runs. The
> criterion is ticked against `dmAdjustResource` rather than against a client action the DM cannot
> reach, and its second clause is read as TICKET-RES-03 states it — nothing rewrites a stranded
> current, and a write to that pool still clamps. See *Decided while building* for the correction this
> owed the overview line and v3 Req 49.3.

- [x] A Snapshot with three `isResource` stats produces six resource actions labelled from those
      stats; adding a fourth resource to the ruleset produces two more with no code change.
      (`quickActionsFor` in [quickActions.ts](../../../src/client/components/play/shared/quickActions.ts),
      a pure mapper that **imports nothing** — not even `StatBreakdown`, which would close a
      `shared/` → `sheet/` → `shared/` cycle. `quickActions.test.ts` — *should produce one damage and
      one restore per resource stat, labelled from that stat's own name* over pools named *Vigor*,
      *Focus* and *Grit*, and *should produce two more actions when the ruleset names a fourth
      resource, with nothing else changed*, which asserts the set grew by exactly 2 and gained
      *Damage Breath* / *Restore Breath*. Plus *should produce no resource action at all for a ruleset
      with no pools*, since a ruleset may flag nothing `isResource`.)
- [x] A grep of `src/` finds no `"health"`, `"hp"`, `"mana"` or equivalent as a stat identifier or
      label anywhere in the quick-action path (v1.0 Req 20, v3 Req 49.2).
      ([noResourceVocabulary.test.ts](../../../src/client/components/play/dm/noResourceVocabulary.test.ts)
      is that grep, as a test rather than as a promise. It scans **five regions** — the four modules of
      the path (`quickActions.ts`, `useQuickActions.ts`, `QuickActionsSidebar.tsx`,
      `QuickActionRow.tsx`) plus the slice of `sheet/useCharacterSheet.ts` holding `experienceStepFor`
      and `toQuickActions`, which is where the pools are actually derived — for `health`, `hp`, `mana`,
      `hit points` and `stamina`, asserts the region list is five so it cannot pass by scanning
      nothing, and adds the positive half: *should take every label it renders from the caller rather
      than from a list of its own*. **The patterns are bare substrings, and the review is why**: the
      first version's `\b…\b` shape passed `const HEALTH_ID`, `maxHealth` and `MANA_STAT`, so *should
      catch a resource named in any of the forms a stat id is actually written in* now pins eight
      disguises. **Comments are not exempt**, which the check earned on its first run — it went red on
      `quickActions.ts`'s own docblock quoting the requirement, and that docblock now talks around the
      words and says why.)
- [x] Every action issues a DM-01/DM-02 request and no other; a test enumerates the requests a
      sidebar can produce and asserts each maps to an existing route (v3 Req 49.3).
      ([quickActionRoutes.test.ts](../../../src/client/components/play/dm/quickActionRoutes.test.ts),
      which reads `QuickActionControls.requests` off the **hook the sidebar actually uses** — taken
      from the same table its sends come from, so a kind cannot be rebound without the test reading
      the new intent. Four cases: *should name a request for every kind of action*, *should reach only
      the DM's own named intents, never a player route*, *should map every request to a route the
      server already answers*, and *should reach the DM's resource delta rather than the DM's resource
      total*. It reads `apiRouter.ts` as **text** rather than importing it, so a `client/` test does
      not put a `#server/…` module in its graph — `dmRules.test.ts`'s idiom, for the same reason.)
- [x] A resource action applies as a **delta** through `adjustCurrentStatValue`, so it lands on the
      stored value rather than on a clamped reading, and a current above a fallen maximum is left
      flagged rather than rewritten (TICKET-RES-03's rule, unbroken).
      (Through `dmAdjustResource` — see the note above. `dm.test.ts` — *should apply each delta to
      what is stored, so two of them take twice as much*, which is the distinguishing evidence: a
      client computing `current − 7` and sending it twice off an unrefreshed reading would take 7 in
      total, and this asserts 14. *Should move a pool stranded above a fallen maximum exactly as the
      Player's own route does* seeds two identical characters at 9,999 and drives one through
      `dm-adjust-resource` and the other through the owner's own `adjust-resource`, asserting the two
      stored results are **equal** — the identical Kernel function said as code rather than as policy.
      Plus *should clamp a restore at the Snapshot's maximum, under the Player's own rule*.
      `useQuickActions.test.ts` — *should send a damage as a delta on the pool rather than as a value
      computed here* (`dmAdjustResource('char1', 'stat-vigor', -7)`);
      `characterStore.table.test.ts` posts `{ statId, delta }` to `dm-adjust-resource` by name.)
- [x] An accepted action reports before → after; a refused one — an unaffordable grant revocation, a
      deduction below zero XP — reports the server's reason with the surface unchanged.
      (`QuickActionControls.outcome` in
      [useQuickActions.ts](../../../src/client/components/play/dm/useQuickActions.ts), read off the
      **Event** through the existing `describeAdjustment` rather than computed on this side — so a
      restore that clamped reports the points it actually put back. `landedSince` is the pure half:
      it excludes a refusal rather than merely failing to match it, because `actionError` means the
      write did not happen. `useQuickActions.test.ts` — *should report before → after from the Event
      the action wrote* (`"Took 7 off Vigor — 30 → 23"`), *should ignore a row that was already there,
      so an older adjustment is not read as this one*, and *should report nothing and offer no undo
      when the server refuses*. `QuickActionsSidebar.test.tsx` — *should report what an accepted action
      did, and say that undo is not a rewind*.)
- [x] Undo applies the inverse and is itself refused when the inverse is refused; the surface states
      that undo is an inverse rather than a restoration wherever clamping makes them differ.
      (`inverseOf` is a `Record<QuickActionKind, QuickActionKind>` in `quickActions.ts`, so a seventh
      kind with no inverse fails to compile; `quickActions.test.ts` — *should pair every action with
      the action that undoes it* and *should undo an inverse back to the action it undid*, which
      proves the map is an involution. `useQuickActions.test.ts` — *should undo the most recent action
      by applying its inverse through the same store action* (`-7` then `+7` on `dmAdjustResource`)
      and *should undo an experience award as a deduction of the same amount*, which is refused
      exactly when any other below-zero deduction is because it **is** one. The sentence is in the UI,
      not only in a docblock: *"Undo applies the opposite action, not a rewind — a clamped pool does
      not come back."*, asserted by `QuickActionsSidebar.test.tsx`. **And undo is scoped to the sheet
      it was asked against**, which the review caught: *should offer no undo once a different character
      is open, even when a newer row has landed* — see *What the `conventions-reviewer` pass changed*.)
- [x] The sidebar is absent for a `player` — not present and disabled — and the server refuses the
      requests regardless of what is rendered.
      (`useQuickActions` returns `null` for anybody who is not the table's DM — `usePurseControls`'
      shape, on `useIsDungeonMaster`, which says *no* while the cookie is unresolved so the panel
      cannot flash onto a Player's sheet for a frame. `useQuickActions.test.ts` — *should give a Player
      at a table nothing at all, rather than a disabled set*, *…on their own local sheet…*, and
      *…while the browser has not resolved its cookie yet*. `QuickActionsSidebar.test.tsx` — *should
      draw nothing at all for a Player at a table, rather than dead controls*, which asserts **zero**
      buttons and no heading. Server side, `dm.test.ts` — *should refuse a `player` Member with the
      same 404 a stranger gets, and write nothing*, byte-identical refusals and zero Events;
      `dmRules.test.ts` scans the new module for `requireCharacterDM(` like the other fourteen.)
- [x] The sidebar composes `components/ui/` primitives on theme tokens; no raw `<button>`/`<input>`,
      no non-theme colour.
      ([QuickActionsSidebar.tsx](../../../src/client/components/play/dm/QuickActionsSidebar.tsx) is
      `Card` / `Text` / `Button` on `border-amber` and `border-stone-200`;
      [QuickActionRow.tsx](../../../src/client/components/play/dm/QuickActionRow.tsx) is `Label` /
      `Input` / `Button`. No raw element, no hex, no stock Tailwind palette; `yarn run check` clean and
      `libraryConventions.test.ts` unchanged.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts (ask the User first).

      **Left open: the User deferred interactive browser checks for the rest of the milestone on
      2026-09-01**, exactly as TICKET-GAM-04 and TICKET-DM-02 record. No live check was attempted and
      none was asked for. Everything else in the Definition of Done ran in full:

      **Tests**: `npx vitest run` **3863 passed / 0 failed / 0 skipped** across 232 files, up from the
      3808/227 baseline in [TEST_STATUS.md](../../../TEST_STATUS.md) (**+55, +5 files** — the per-file
      delta is recorded there). `npx tsc --noEmit` at the documented **2-error baseline** and nothing
      else. `yarn run check` clean over 769 files, `yarn run arch` reporting no dependency violations
      across 790 modules — including the new `client/` test that reads a `server/` module as text
      rather than importing it.

      **`fallow`**: `audit --base main` moved from **fail** to **warn**, with
      `dead_code_introduced: 0` and `complexity_introduced: 0`. The one complexity finding this ticket
      first introduced was fixed rather than suppressed — `CharacterSheet` went to **18 cyclomatic /
      19 cognitive** when the sidebar's hook call, its null check and two fallbacks landed in it, and
      is off the list entirely now that `QuickActionsSidebar` decides for itself like every other rail
      panel. (That 18/19 was a reading on an intermediate state and is not reproducible from the
      shipped tree; it is recorded as this build's own measurement.) The remaining finding,
      `useCharacterSheet` at 16 cyclomatic / 18 cognitive, comes back `introduced: false` — inherited,
      and recorded as such. `dead-code` reports the same two pre-existing findings DM-02 recorded (the
      `fallow` dependency itself and `RulesetHomeKind` in `rulesetSync.ts`), neither in a file this
      ticket touched. `health --hotspots --since 6m`: three touched files come back **Accelerating**
      and each has its row in TEST_STATUS.md amended in place — **two of the three fell**,
      `CharacterSheet.tsx` 10.4 → 9.7 and `useCharacterSheet.ts` 26.5 → 25.5 with its density moving
      0.13 → 0.12 for the first time since DM-01. The one duplication group is introduced
      and deliberate, argued below.

      **`conventions-reviewer` was not run — the User is running it.**

## Decided while building (2026-09-01)

### The one route, and the correction it owed

**`POST /api/characters/:id/dm-adjust-resource` is the only server surface this ticket adds**, and
the overview line said it would add none. That line is amended in the same change rather than left
standing, because the principle it was protecting survives and the sentence did not.

The reasoning, in the order it was reached. Criterion 4 and v3 Req 49.4 both require a resource quick
action to apply **as a delta**. The tree had no DM delta path to a pool at all:
`routes/play/adjustResource.ts` is guarded by `requireCharacterPlayer` — `requireCharacterWriter`
minus the DM — so a DM gets a 404, and `dm-set-resource` takes an absolute value. Three ways forward
were put to the User at the plan: add the route, compute `current − 7` in the browser, or amend the
requirement. **The User chose the route**, on the argument that Req 49.3 forbids a *private
mechanism* — a route with validation of its own that only a quick action can reach, which would drift
from what the sheet allows — and **not a second caller of a rule that already exists**.
`dmAdjustResource` runs `adjustResourceValue` from `playerActions.ts`, the identical function
`routes/play/adjustResource.ts` runs, exactly as `dm-set-resource` runs the identical
`setResourceValue`. There is nothing for a second implementation to diverge from, because there is no
second implementation.

It is also the symmetric completion of TICKET-DM-02's own decision three days of build ago:
`dm-adjust-purse` exists beside `dm-set-purse` because *paying somebody is not arithmetic on a stale
balance*, and a pool has that problem for the same reason. The alternative — a browser computing
`current − 7` — would have put the stale read back and quietly disagreed with the purse.

**v3 Req 49.3 is amended too**, and that outranks this ticket, so it is said here as well: as written
it read *"THE Server SHALL expose no route reachable only by a Quick_Action"*, which is a statement
about *callers* when what it means is a statement about *rules*. A route whose Kernel function is the
one the Player's own route already calls has no separate validation to drift, however many surfaces
happen to reach it today. The requirement now says that.

### Where the preset amounts come from

The ticket asked for this to be recorded so the User can disagree with it. **Presets are derived from
each action's own scale where the Snapshot supports one, and are absent rather than invented where it
does not** — a 1/5/10 ladder would be a guess about a ruleset nobody has seen:

| Action | Steps | Why |
|---|---|---|
| Damage / Restore | `1`, a tenth of the pool's maximum, a quarter of it — deduped and ascending | the pool's own derived maximum, which the sheet already has |
| Give / Take points | `1` | a point is the ruleset's own unit; one of them is not a guess and anything larger would be |
| Award / Deduct experience | what the `xp_thresholds` curve prices the character's **next level** at, from where they stand — and **nothing at all** when it cannot say | TICKET-DM-01's *set level to N* precedent: `experienceForLevel` refuses rather than extrapolating, so a single-row placeholder curve costs a preset instead of producing a confident wrong one |

Typed entry is offered on every action regardless, so a refusing curve costs a preset and not the
action. A pool that maxes at 8 prices its tenth and its quarter at 1 and 2, and renders two buttons
rather than three reading 1 / 1 / 2.

### Three things built differently from the to-be

- **The amount box is not `useNumericDraft`.** The to-be asked for *"presets plus typed relative entry
  through `useNumericDraft`"*. **The direction is the action, not the sign of the number**: a `-5`
  typed into *Damage Vigor* would have to mean *restore 5*, and a control where a minus sign silently
  reverses the act it is labelled with is a trap rather than a convenience. `QuickActionRow` is
  `AdjustmentField`'s shape instead — a plain amount, committed on Enter or the button — and it is a
  second component rather than a `presets` prop on `AdjustmentField`, which would be a prop named
  after one of five callers.
- **`quickActionsFor` imports nothing, not even a type.** The obvious signature takes the sheet's
  `StatBreakdown` rows — and `sheet/useCharacterSheet.ts` already imports `derivedValue.ts` and
  `pointBudgetView.ts` from `play/shared/`, so naming it there would close a `shared/` → `sheet/` →
  `shared/` cycle `fallow` reports and that `AdjustmentField` moved folders to avoid.
  `QuickActionPool` is the three fields the derivation actually needs, and the docblock says not to
  "helpfully" import the other.
- **The sidebar decides for itself who may see it.** It was first written presentational, with
  `CharacterSheet` calling `useQuickActions` and rendering it behind a `quick &&` — which took
  `CharacterSheet` to 18 cyclomatic / 19 cognitive, the one complexity finding `fallow` attributed to
  this ticket. `InventoryPanel`, `SpellbookPanel` and `PassivesPanel` are all rail panels that take a
  character and answer *nothing to draw* themselves, and this is now the fourth. It also let the
  component test assert criterion 7 directly — **zero buttons, no heading** for a Player at a table.

### The point grant is a read-modify-write, and that is not the thing the delta avoids

*Give 5 points* is `grantedStatPoints + 5` computed on the client, because `dm-grant-points` takes a
**total** — deliberately, so two overlapping adjustments cannot compound (TICKET-DM-01). That is
worth distinguishing from the pool, where the same shape would be a bug: a grant is a number the DM
is looking at on the same card, it moves only when a DM moves it, and the store swallows a second
write while one is in flight. A pool moves whenever anything at the table happens to the character.

### What was deliberately not built

**The DM's view of a player's sheet is still not read-only.** DM-01 deferred that here; measuring it
during planning showed five sections, their tests and a `CharacterSheet` `fallow` already watches —
including the finding that `rollDice.ts` is `requireCharacterPlayer` too, so even the roll buttons
are dead on a DM's view. The User's call was to **split it out** rather than make it a ninth
criterion: it is
[TICKET-DM-05](./TICKET-DM-05-the-dms-view-of-a-sheet-is-read-only.md), placed in `overview.md`
immediately after this line.

**One duplication group is introduced and it is deliberate**, on DM-01's and DM-02's stated
reasoning: `dmAdjustResource.ts` and `routes/play/adjustResource.ts` share a nine-line prologue
because **one route per module is what makes `routeGuards.test.ts` and `dmRules.test.ts` able to scan
for a guard *call site* at all**. Merging them would trade two real checks for nine lines, and the
one thing that differs is the whole point of the pair — `requireCharacterDM` against
`requireCharacterPlayer`. PLY-01 accepted the same shape eleven times, DM-01 twice and DM-02 twice
more.

**Nothing in `docs/imports/` changed**, and the rule was checked rather than skipped: no
`Configuration` entity is added or reshaped, and no persisted `Character` field is touched. A quick
action is a surface over routes; `DM_ACTION.ADJUST_RESOURCE` is an Event `type`, not a document
shape. No `SUPPORTED_SCHEMA_VERSION` bump, and none owed.

### What the `conventions-reviewer` pass changed (2026-09-01)

Nine findings, **two of them bugs in code these criteria were ticked against**. Recorded here rather
than folded silently into the evidence above, because both were the kind that a green suite hides.

- **`useQuickActions` could undo against the wrong character.** `LastAction` carried the kind, the
  stat and the amount and **not the character id**, while
  [`character.$id.tsx`](../../../src/client/routes/play/character.$id.tsx) renders
  `<CharacterSheet characterId={id} />` with **no `key`** — so a route param change reuses the
  instance and that state survives it. `seq` cannot stand in for an id, because it is **session**-
  scoped: the next character's feed would very plausibly clear the mark on its own and light *Undo*
  up, sending the inverse to somebody else's sheet in silence. `landedSince` now takes the open
  character and refuses a `last` recorded against another — it was already the pure function that owns
  *did my action land*, and *landed on somebody else's sheet* is not a yes. `useQuickActions.test.ts`
  — *should offer no undo once a different character is open, even when a newer row has landed*,
  which was **run against the unfixed hook and fails there**. It matters twice over because
  TICKET-DM-04 puts this hook on a roster with several characters on screen at once.
- **`noResourceVocabulary.test.ts` did not catch what it exists to catch.** `_` is a word character
  and so is every letter around a camelCase hump, so the original `/\bhealth\b/i` shape passed
  `const HEALTH_ID`, `stat_health`, `maxHealth`, `healthPool`, `manaCost` and `MANA_STAT` — only prose
  and kebab-case were caught, which is why it went red on a *docblock* and would have sailed past
  `const HEALTH_STAT_ID = …`. The second criterion's evidence was therefore stronger than its check.
  Bare case-insensitive substrings now (`hp` keeps both boundaries — as a substring it fires on
  `graphpaper`), plus a third case pinning the eight disguises so the patterns cannot quietly regress.
  **And the scan omitted the module that actually derives the pools**: `toQuickActions` is in
  `sheet/useCharacterSheet.ts`, which is exactly where a `stats.filter(s => s.name !== 'Health')`
  would get written. That hook cannot be scanned whole — its own header reads *"Character Sheet
  **Mana**ger Hook"* — so the region between two named anchors is scanned instead, and a **missing
  anchor throws** rather than silently covering nothing.

The other seven:

- **`play/index.ts` gained the four new modules**, and this was **the second ticket running that the
  feature barrel slipped**. Asked whether `play/` deserves the completeness test `ui/` already has
  (`libraryConventions.test.ts` — *should export every component from the barrel with export ***), the
  answer is **yes, as its own ticket**: the same check run against `play/` today finds **five**
  further omissions that are nobody's fault here — `creation/useCharacterSubmit`,
  `sheet/investedContribution`, `sheet/useOpenTableCharacter`, `sheet/useSheetActions` and the nested
  `passives/index` barrel, which also needs a ruling on whether a sub-barrel belongs in the list.
  Folding that in would have made this a sweep.
- **`QuickActionsSidebar` takes `grantedPoints: number` rather than the whole `PointBudgetView`**, and
  an unreachable fallback went with it. `toPointBudgetView` is `null` only for a null allocation,
  which `CharacterSheet` has already turned into a `SheetStatusNotice`; a budget the ruleset cannot
  *price* still carries a real `grantedPoints`, since only `pointBudget` and `pointsRemaining` are
  `DerivedValue`. Had the `?? 0` ever fired, *give 1 point* would have written `1` **over** a real
  grant instead of incrementing it. The fallback moved to `useCharacterSheet`'s `grantedPointsFrom`,
  where `budget` genuinely can be null.
- **The amount gate is one predicate with two callers**, `isSendableAmount` in `quickActions.ts`,
  rather than the same three terms written in `QuickActionRow` and `useQuickActions.send`. The row's
  emptiness check went with it: `Number('')` is 0 and `Number('abc')` is `NaN`, so both were already
  a *no*.
- **`requests` is projected off the bindings table** through `requestsFrom`, keyed on
  `Object.values(QUICK_ACTION_KIND)`. The first version re-listed all six keys — safe, because the
  `Record` annotation makes an omission a compile error, but the docblock claimed the enumeration was
  taken off one table and the key list was a second copy.
- `project-map` said *"the DM's fourteen"* and then enumerated fifteen; the two other instances in the
  same diff were already correct.
- `useCharacterSheet` reshaped `toDerivedValue(character && config ? calculateCharacterLevel(…) :
  undefined)` into a `const level` without unnesting the inner call — converted-when-touched applies,
  and the engine's answer is now named before it is wrapped.
- **Eleven nested calls in new test code**, all of them this ticket's rather than TICKET-DX-10's
  backlog, including the `readFileSync`/`resolve`/`dirname` prologues copied from `dmRules.test.ts`.
  A borrowed idiom is still new code.

## Notes

- **The derivation is the ticket.** A hard-coded *Damage* / *Heal* / *Spend Mana* trio would work for
  one ruleset and quietly misdescribe every other, which is the precise failure v1.0 Req 20 exists to
  prevent — and this app has spent two milestones making sure a stat is whatever the User said it is.
  If the derivation ever needs a special case, that is a signal the Snapshot is missing a flag, not
  that the list should be written by hand.
- **Undo is an inverse, not a restoration**, and saying so is load-bearing. Damage 5 against a
  maximum that then falls, undone, is a restore of 5 that clamps — it does not put the character back
  where they were, because putting them back would mean the DM's undo silently overriding the rules
  every other write obeys. Show the inverse, name what it did, and let the DM look.
- Where the amounts come from is a judgement call: presets like 1/5/10 are a guess about a ruleset we
  do not know. Prefer deriving a sensible step from the stat's own scale where the Snapshot supports
  it, and record what was chosen in the implementation notes so the User can disagree.
- Resist making this a new server surface. The whole value is that a quick action is a *shortcut to
  an existing control* — the moment it has its own route, it has its own validation, and the two
  drift until a DM can do something through the sidebar that the sheet refuses.
