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

- [ ] Awarding experience moves the derived level with nothing else stored; there is no writable
      level field anywhere, asserted by a test that greps the persisted shape.
- [ ] "Set level to N" writes the `xp_thresholds` threshold XP for N and is refused, with the reason,
      when the curve cannot price N — never falling back to a guess.
- [ ] A grant raises the budget `validateStatAllocation` reports, and the Player can then spend it
      through PLY-01's unchanged route.
- [ ] Revoking a grant that would leave the Character having overspent is **refused**, naming the
      overspend (v3 Req 42.4) — the same refuse-don't-clamp discipline as RES-02's spend.
- [ ] A deduction below zero experience is refused, not clamped — the existing rule, now server-side.
- [ ] Every DM adjustment writes one Event naming the DM, the Character, and before/after; a Player
      reads the Events that changed their own sheet.
- [ ] A `player` Member calling any DM route is refused; the DM's own character gets no special path.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts (ask the User first).

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
