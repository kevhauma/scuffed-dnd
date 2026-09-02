/**
 * The roster, derived (TICKET-DM-04, v3 Req 49.8)
 *
 * Four claims worth a test:
 *
 * - **Every column is the ruleset's**, so a Snapshot that gains a resource gains a pair of cells and
 *   two more quick actions with no code change (v3 Req 49.2, 49.8).
 * - **A value that cannot be calculated chips rather than showing a confident number** (criterion 7).
 *   It matters more in a grid than on a sheet: twenty confident numbers with one quiet lie in them is
 *   harder to catch than one chipped cell.
 * - **The departed group is derived from who is seated**, and its characters keep their numbers —
 *   which GAM-04's lobby could not give them (v3 Req 39.3).
 * - **The order is stable and nobody chooses it**: Members as the server listed them, characters by
 *   name, the departed last.
 *
 * **Validates: v3 Req 39.3, 39.7, 49.1, 49.2, 49.8**
 */

import { describe, expect, it } from 'vitest';
import type { Stat } from '#shared/types/config';
import {
  DEPARTED_ACCOUNT,
  DM_ACCOUNT,
  makeCharacter,
  makeDocument,
  makeMember,
  makeSnapshot,
  makeTable,
  PLAYER_ACCOUNT,
} from './roster.fixtures';
import { toRosterView } from './rosterView';

/** One pool of a row, by the ruleset's own name for it */
function poolNamed(groups: ReturnType<typeof toRosterView>, characterId: string, name: string) {
  const rows = groups.flatMap((group) => group.characters);
  const row = rows.find((candidate) => candidate.id === characterId);
  const pool = row?.pools.find((candidate) => candidate.name === name);

  if (!pool) throw new Error(`no pool named ${name} on ${characterId}`);

  return pool;
}

describe('toRosterView', () => {
  it('gives every Member a group, including one playing nothing (v3 Req 39.7)', () => {
    const members = makeTable();
    const documents = [makeDocument()];
    const snapshot = makeSnapshot();

    const groups = toRosterView(members, documents, snapshot, DM_ACCOUNT);

    expect(groups).toHaveLength(2);
    expect(groups[0].member?.accountId).toBe(DM_ACCOUNT);
    expect(groups[0].characters).toEqual([]);
    expect(groups[1].characters).toHaveLength(1);
  });

  it('marks the reader’s own group', () => {
    const members = makeTable();
    const documents = [makeDocument()];
    const snapshot = makeSnapshot();

    const groups = toRosterView(members, documents, snapshot, PLAYER_ACCOUNT);

    expect(groups[0].isYou).toBe(false);
    expect(groups[1].isYou).toBe(true);
  });

  it('derives the level from experience rather than from points spent', () => {
    // TICKET-RES-01's rule, read on the roster: 300 XP is level 2 on this curve, and the four points
    // in Might have nothing to do with it
    const members = makeTable();
    const documents = [makeDocument()];
    const snapshot = makeSnapshot();

    const groups = toRosterView(members, documents, snapshot, DM_ACCOUNT);
    const row = groups[1].characters[0];

    expect(row.level).toEqual({ value: 2, error: null });
  });

  it('shows every resource the Snapshot flags, current against maximum', () => {
    const members = makeTable();
    const documents = [makeDocument()];
    const snapshot = makeSnapshot();

    const groups = toRosterView(members, documents, snapshot, DM_ACCOUNT);
    const vigor = poolNamed(groups, 'character-1', 'Vigor');
    const focus = poolNamed(groups, 'character-1', 'Focus');

    expect(vigor.current).toBe(31);
    expect(vigor.max).toEqual({ value: 40, error: null });
    // Derived from a stat the character invested in, so it moves when they spend
    expect(focus.max.value).toBeGreaterThan(0);
  });

  it('grows a column when the Snapshot grows a resource, with no code change (v3 Req 49.2)', () => {
    const members = makeTable();
    const documents = [makeDocument()];
    const base = makeSnapshot();

    const fourth: Stat = {
      id: 'stat-breath',
      name: 'Breath',
      abbreviation: 'BRE',
      description: '',
      order: 3,
      countsTowardTotal: false,
      isResource: true,
      rounding: 'none',
      formula: '12',
    };

    const widened = makeSnapshot({ stats: [...base.stats, fourth] });

    const before = toRosterView(members, documents, base, DM_ACCOUNT);
    const after = toRosterView(members, documents, widened, DM_ACCOUNT);

    const poolsBefore = before[1].characters[0].pools;
    const poolsAfter = after[1].characters[0].pools;

    expect(poolsBefore).toHaveLength(2);
    expect(poolsAfter).toHaveLength(3);

    // …and the action set follows it, which is the same derivation reaching the other placement
    const actionsBefore = before[1].characters[0].quickActions;
    const actionsAfter = after[1].characters[0].quickActions;

    expect(actionsAfter.length - actionsBefore.length).toBe(2);
  });

  it('chips a resource whose formula is broken rather than showing a number', () => {
    const members = makeTable();
    const documents = [makeDocument()];
    const base = makeSnapshot();

    const broken: Stat = {
      id: 'stat-ruin',
      name: 'Ruin',
      abbreviation: 'RUI',
      description: '',
      order: 3,
      countsTowardTotal: false,
      isResource: true,
      rounding: 'none',
      formula: 'NOPE * 2',
    };

    const snapshot = makeSnapshot({ stats: [...base.stats, broken] });

    const groups = toRosterView(members, documents, snapshot, DM_ACCOUNT);
    const ruin = poolNamed(groups, 'character-1', 'Ruin');

    expect(ruin.max.value).toBeNull();
    expect(ruin.max.error).toBeTruthy();
  });

  it('chips the level when the curve cannot price it', () => {
    // A ruleset with no `xp_thresholds` curve cannot say what level anybody is, and claiming 1 would
    // be the confident wrong answer the whole error-value discipline exists to refuse
    const members = makeTable();
    const documents = [makeDocument()];
    const snapshot = makeSnapshot({ curves: [] });

    const groups = toRosterView(members, documents, snapshot, DM_ACCOUNT);
    const row = groups[1].characters[0];

    expect(row.level.value).toBeNull();
    expect(row.level.error).toBeTruthy();
  });

  it('flags a pool holding more than its maximum rather than correcting it (TICKET-RES-03)', () => {
    const members = makeTable();
    const overfull = makeCharacter({ currentResourceValues: { 'stat-vigor': 55 } });
    const documents = [makeDocument({ character: overfull })];
    const snapshot = makeSnapshot();

    const groups = toRosterView(members, documents, snapshot, DM_ACCOUNT);
    const vigor = poolNamed(groups, 'character-1', 'Vigor');

    expect(vigor.current).toBe(55);
    expect(vigor.isOverMax).toBe(true);
  });

  it('keeps a departed player’s characters, with their numbers (v3 Req 39.3)', () => {
    // The lobby could only name them, because it had no Snapshot to read them against. Retention
    // means the sheets stay readable, and a name on its own is not a readable sheet.
    const members = makeTable();
    const orphan = makeCharacter({ id: 'character-9', name: 'Old Quackers' });
    const documents = [
      makeDocument(),
      makeDocument({
        id: 'character-9',
        ownerAccountId: DEPARTED_ACCOUNT,
        character: orphan,
      }),
    ];
    const snapshot = makeSnapshot();

    const groups = toRosterView(members, documents, snapshot, DM_ACCOUNT);
    const last = groups[groups.length - 1];

    expect(last.member).toBeNull();
    expect(last.characters).toHaveLength(1);
    expect(last.characters[0].name).toBe('Old Quackers');
    expect(last.characters[0].level).toEqual({ value: 2, error: null });
  });

  it('has no departed group when nobody has left', () => {
    const members = makeTable();
    const documents = [makeDocument()];
    const snapshot = makeSnapshot();

    const groups = toRosterView(members, documents, snapshot, DM_ACCOUNT);
    const orphans = groups.filter((group) => group.member === null);

    expect(orphans).toEqual([]);
  });

  it('orders characters by name within a Member, so the list does not move', () => {
    const zed = makeCharacter({ id: 'character-2', name: 'Zeb' });
    const abe = makeCharacter({ id: 'character-3', name: 'Abe' });
    const members = makeTable();
    const documents = [
      makeDocument({ id: 'character-2', character: zed }),
      makeDocument({ id: 'character-3', character: abe }),
    ];
    const snapshot = makeSnapshot();

    const groups = toRosterView(members, documents, snapshot, DM_ACCOUNT);
    const names = groups[1].characters.map((row) => row.name);

    expect(names).toEqual(['Abe', 'Zeb']);
  });

  it('draws nothing at all until the Snapshot has been read', () => {
    // A roster of names with blank columns reads as *these characters have no points* rather than as
    // *still loading*, which on a surface a DM acts on without checking is the worse of the two
    const members = makeTable();
    const documents = [makeDocument()];

    const groups = toRosterView(members, documents, null, DM_ACCOUNT);

    expect(groups).toEqual([]);
  });

  it('carries the DM’s grant, which a give or take is a total on top of', () => {
    const granted = makeCharacter({ grantedStatPoints: 5 });
    const members = makeTable();
    const documents = [makeDocument({ character: granted })];
    const snapshot = makeSnapshot();

    const groups = toRosterView(members, documents, snapshot, DM_ACCOUNT);

    expect(groups[1].characters[0].grantedPoints).toBe(5);
  });

  it('gives a Member with no seat in the listing no group of their own', () => {
    // Somebody removed mid-session: their character moves to the departed group rather than keeping
    // a header that claims they are still at the table
    const dmOnly = [makeMember()];
    const documents = [makeDocument()];
    const snapshot = makeSnapshot();

    const groups = toRosterView(dmOnly, documents, snapshot, DM_ACCOUNT);

    expect(groups).toHaveLength(2);
    expect(groups[1].member).toBeNull();
  });
});
