/**
 * What a membership Event does to a member list (TICKET-LIVE-04, v3 Req 44.7)
 *
 * The pure half of the roster's second applier, tested without a socket, a hook or a component —
 * `liveEvents.test.ts`'s shape one list over.
 *
 * The three things worth proving here, each of which the hook above can only demonstrate and not
 * pin down:
 *
 * 1. **Only membership Events touch the list.** Everything a table does in quantity — actions,
 *    adjustments, rolls — has to leave it alone, and *leave alone* has to be `elsewhere` rather than
 *    `stale`, or the roster asks the server about every roll.
 * 2. **A join is the one that cannot be applied**, and it says so honestly rather than dropping the
 *    Event or inventing a row out of an id.
 * 3. **An unreadable payload asks rather than guesses.** A membership Event whose shape this build
 *    does not recognise still means somebody's seat changed, and the server is what can say how.
 *
 * **Validates: v3 Req 39.3, 39.4, 44.7**
 */

import { describe, expect, it } from 'vitest';
import type { SessionMemberSummary } from '#shared/types/api';
import {
  DM_ACTION,
  MEMBER_ROLE,
  PLAYER_ACTION,
  ROLL_EVENT,
  SESSION_EVENT,
} from '#shared/types/api';
import type { LiveEvent } from '#shared/types/liveSocket';
import { EVENT_EFFECT } from '../../../services/liveEvents';
import { applyEventToMembers } from './membershipEvents';
import { DM_ACCOUNT, makeTable, PLAYER_ACCOUNT } from './roster.fixtures';

/** One Event, of whatever kind a case is about */
function anEvent(type: string, payload: unknown): LiveEvent {
  return {
    id: 'event-1',
    seq: 1,
    type,
    actorAccountId: DM_ACCOUNT,
    at: 1_700_000_000_000,
    payload,
  } as LiveEvent;
}

/** Who is in a list, in the order it holds them */
function idsOf(members: SessionMemberSummary[]): string[] {
  return members.map((member) => member.accountId);
}

/** The patched list, or a failure naming what came back instead */
function membersAfter(event: LiveEvent, members = makeTable()): SessionMemberSummary[] {
  const outcome = applyEventToMembers(members, event);

  if (outcome.effect !== EVENT_EFFECT.APPLIED) {
    throw new Error(`expected the list to be patched, and it answered ${outcome.effect}`);
  }

  return outcome.members;
}

describe('applyEventToMembers', () => {
  it('takes a removed Member out of the list', () => {
    const removal = anEvent(SESSION_EVENT.MEMBER_REMOVED, { accountId: PLAYER_ACCOUNT });

    const remaining = membersAfter(removal);
    const left = idsOf(remaining);

    expect(left).toEqual([DM_ACCOUNT]);
  });

  it('takes a departing Member out too, which is the same write', () => {
    const departure = anEvent(SESSION_EVENT.MEMBER_LEFT, { accountId: PLAYER_ACCOUNT });

    const remaining = membersAfter(departure);
    const left = idsOf(remaining);

    expect(left).toEqual([DM_ACCOUNT]);
  });

  it('leaves the list alone when the Member is already gone', () => {
    // A replayed Event, or one that landed on a list read after the removal it describes. There is
    // nothing to patch and nothing to ask about — which is precisely the difference between the two
    const removal = anEvent(SESSION_EVENT.MEMBER_REMOVED, { accountId: 'account-nobody' });
    const table = makeTable();

    const outcome = applyEventToMembers(table, removal);

    expect(outcome.effect).toBe(EVENT_EFFECT.ELSEWHERE);
  });

  it('moves both roles on a handover, and nothing else about either row', () => {
    const handover = anEvent(SESSION_EVENT.DM_TRANSFERRED, {
      accountId: PLAYER_ACCOUNT,
      previousAccountId: DM_ACCOUNT,
    });

    const moved = membersAfter(handover);
    const incoming = moved.find((member) => member.accountId === PLAYER_ACCOUNT);
    const outgoing = moved.find((member) => member.accountId === DM_ACCOUNT);
    const fresh = makeTable();
    const ada = fresh.find((member) => member.accountId === PLAYER_ACCOUNT);

    expect(incoming?.role).toBe(MEMBER_ROLE.DM);
    expect(outgoing?.role).toBe(MEMBER_ROLE.PLAYER);

    // Their name and their characters are untouched: a role moved, and a patch that rebuilt the row
    // would be a second answer to *what is on this Member's line*
    expect(incoming?.name).toBe(ada?.name);
    expect(incoming?.characters).toEqual(ada?.characters);
  });

  it('puts the new DM at the front, where a re-read would have put them', () => {
    const handover = anEvent(SESSION_EVENT.DM_TRANSFERRED, {
      accountId: PLAYER_ACCOUNT,
      previousAccountId: DM_ACCOUNT,
    });

    const moved = membersAfter(handover);
    const order = idsOf(moved);

    expect(order).toEqual([PLAYER_ACCOUNT, DM_ACCOUNT]);
  });

  it('asks again for a handover it cannot complete', () => {
    // Half a transfer is worse than none: the badge would leave one row and land on nobody
    const handover = anEvent(SESSION_EVENT.DM_TRANSFERRED, {
      accountId: 'account-stranger',
      previousAccountId: DM_ACCOUNT,
    });
    const table = makeTable();

    const outcome = applyEventToMembers(table, handover);

    expect(outcome.effect).toBe(EVENT_EFFECT.STALE);
  });

  it('asks again for a join, because the payload carries no name (v3 Req 44.3)', () => {
    // The one membership Event that cannot be applied, and the reason is a rule rather than an
    // omission: a name in the log is a copy a rename can make wrong, so the list is read instead
    const arrival = anEvent(SESSION_EVENT.MEMBER_JOINED, { accountId: 'account-newcomer' });
    const table = makeTable();

    const outcome = applyEventToMembers(table, arrival);

    expect(outcome.effect).toBe(EVENT_EFFECT.STALE);
  });

  it('asks again for a membership payload it cannot read', () => {
    const malformed = anEvent(SESSION_EVENT.MEMBER_REMOVED, { accountId: 42 });
    const empty = anEvent(SESSION_EVENT.MEMBER_LEFT, null);
    const table = makeTable();

    const first = applyEventToMembers(table, malformed);
    const second = applyEventToMembers(table, empty);

    expect(first.effect).toBe(EVENT_EFFECT.STALE);
    expect(second.effect).toBe(EVENT_EFFECT.STALE);
  });

  it('leaves the list alone for everything that is not about a seat', () => {
    // `elsewhere` rather than `stale` for all of these, which is what stops a roster asking the
    // server who is at the table every time somebody throws dice
    const notAboutSeats = [
      anEvent(ROLL_EVENT, { characterId: 'character-1' }),
      anEvent(DM_ACTION.AWARD_EXPERIENCE, { characterId: 'character-1', after: 300 }),
      anEvent(PLAYER_ACTION.INVEST_STAT_POINTS, { characterId: 'character-1' }),
      anEvent(SESSION_EVENT.SNAPSHOT_REFRESHED, { rulesetId: 'ruleset-1' }),
      anEvent('something.this.build.has.never.heard.of', {}),
    ];
    const table = makeTable();

    const effects = notAboutSeats.map((event) => {
      const outcome = applyEventToMembers(table, event);

      return outcome.effect;
    });
    const elsewhere = notAboutSeats.map(() => EVENT_EFFECT.ELSEWHERE);

    expect(effects).toEqual(elsewhere);
  });

  it('patches a copy, so a caller holding the old list still holds it', () => {
    const table = makeTable();
    const removal = anEvent(SESSION_EVENT.MEMBER_REMOVED, { accountId: PLAYER_ACCOUNT });

    const remaining = membersAfter(removal, table);

    expect(remaining).toHaveLength(1);
    expect(table).toHaveLength(2);
  });
});
