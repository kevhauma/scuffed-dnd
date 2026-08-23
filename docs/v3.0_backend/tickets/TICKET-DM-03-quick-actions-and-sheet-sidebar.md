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

- [ ] A Snapshot with three `isResource` stats produces six resource actions labelled from those
      stats; adding a fourth resource to the ruleset produces two more with no code change.
- [ ] A grep of `src/` finds no `"health"`, `"hp"`, `"mana"` or equivalent as a stat identifier or
      label anywhere in the quick-action path (v1.0 Req 20, v3 Req 49.2).
- [ ] Every action issues a DM-01/DM-02 request and no other; a test enumerates the requests a
      sidebar can produce and asserts each maps to an existing route (v3 Req 49.3).
- [ ] A resource action applies as a **delta** through `adjustCurrentStatValue`, so it lands on the
      stored value rather than on a clamped reading, and a current above a fallen maximum is left
      flagged rather than rewritten (TICKET-RES-03's rule, unbroken).
- [ ] An accepted action reports before → after; a refused one — an unaffordable grant revocation, a
      deduction below zero XP — reports the server's reason with the surface unchanged.
- [ ] Undo applies the inverse and is itself refused when the inverse is refused; the surface states
      that undo is an inverse rather than a restoration wherever clamping makes them differ.
- [ ] The sidebar is absent for a `player` — not present and disabled — and the server refuses the
      requests regardless of what is rendered.
- [ ] The sidebar composes `components/ui/` primitives on theme tokens; no raw `<button>`/`<input>`,
      no non-theme colour.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts (ask the User first).

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
