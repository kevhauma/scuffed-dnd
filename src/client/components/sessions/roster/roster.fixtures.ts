/**
 * The table the roster's tests are written against (TICKET-DM-04)
 *
 * One ruleset and one shape of character document, shared by the roster's tests the way
 * `importExport.fixtures.ts` is shared by the import/export ones — so *the same Snapshot* in v3 Req
 * 49.7's criterion is literally the same object, and the sheet-versus-roster comparison cannot pass
 * by two fixtures happening to agree.
 *
 * **Nothing here is named after a system.** The pools are *Vigor* and *Focus*, which is v3 Req 49.2's
 * own example of a ruleset that a hard-coded label would misdescribe: if any of this path ever grows
 * a special case, these fixtures are what stops it passing.
 */

import type { CharacterDocument, SessionMemberSummary } from '#shared/types/api';
import { MEMBER_ROLE } from '#shared/types/api';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';

/** The account ids the table is played by */
export const DM_ACCOUNT = 'account-dm';
export const PLAYER_ACCOUNT = 'account-ada';
export const DEPARTED_ACCOUNT = 'account-gone';

/**
 * A ruleset with two working pools and one broken one
 *
 * *Vigor* has a flat maximum, *Focus* derives from a stat, and *Ruin* names something the ruleset has
 * not got — which is the criterion-7 case: a resource whose formula is broken must chip its cell
 * rather than show a confident number.
 */
export function makeSnapshot(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'snapshot-1',
    name: 'Tuesday night, as it was',
    version: '1.0',
    schemaVersion: 10,
    stats: [
      {
        id: 'stat-might',
        name: 'Might',
        abbreviation: 'MIG',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'stat-vigor',
        name: 'Vigor',
        abbreviation: 'VIG',
        description: '',
        order: 1,
        countsTowardTotal: false,
        isResource: true,
        rounding: 'none',
        formula: '40',
      },
      {
        id: 'stat-focus',
        name: 'Focus',
        abbreviation: 'FOC',
        description: '',
        order: 2,
        countsTowardTotal: false,
        isResource: true,
        rounding: 'none',
        formula: 'MIG * 2',
      },
    ],
    skills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [{ id: 'race-duck', name: 'Duck', description: '', statValues: {} }],
    currencyTiers: [],
    constants: [
      {
        id: 'const-points',
        name: 'points_per_level',
        displayName: 'Points per level',
        value: 3,
        description: '',
      },
    ],
    curves: [
      {
        id: 'curve-xp',
        name: 'xp_thresholds',
        displayName: 'XP thresholds',
        description: '',
        keyName: 'level',
        columns: [{ id: 'curve-xp-col', name: 'xp_required' }],
        rows: [
          { key: 1, values: [0] },
          { key: 2, values: [300] },
          { key: 3, values: [900] },
        ],
        interpolation: 'step',
        outOfRange: 'extrapolate',
        lookupDirection: 'reverse',
      },
    ],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

/** One character built on that ruleset */
export function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character-1',
    name: 'Quackers',
    configurationId: 'snapshot-1',
    raceIds: ['race-duck'],
    investedStatPoints: { 'stat-might': 4 },
    investedSkillPoints: {},
    currentResourceValues: { 'stat-vigor': 31 },
    experience: 300,
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

/**
 * What a case may vary about a document
 *
 * `character` is **partial** where `CharacterDocument`'s is whole, because a case that wants a
 * different name should say `{ character: { name: 'Feathers' } }` rather than restate ten fields it
 * does not care about. Everything else is the document's own.
 */
export interface DocumentOverrides extends Partial<Omit<CharacterDocument, 'character'>> {
  character?: Partial<Character>;
}

/** …as the table's listing carries it */
export function makeDocument(overrides: DocumentOverrides = {}): CharacterDocument {
  const character = makeCharacter(overrides.character);

  return {
    id: character.id,
    sessionId: 'session-1',
    rulesetId: null,
    ownerAccountId: PLAYER_ACCOUNT,
    name: character.name,
    revision: 1,
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    ...overrides,
    character,
  };
}

/** One Member, as the roster carries them */
export function makeMember(overrides: Partial<SessionMemberSummary> = {}): SessionMemberSummary {
  return {
    accountId: DM_ACCOUNT,
    name: 'The DM',
    role: MEMBER_ROLE.DM,
    joinedAt: 1_760_000_000_000,
    characters: [],
    ...overrides,
  };
}

/** The DM and one player, which is the smallest table with anything to decide */
export function makeTable(): SessionMemberSummary[] {
  const dm = makeMember();
  const ada = makeMember({
    accountId: PLAYER_ACCOUNT,
    name: 'Ada',
    role: MEMBER_ROLE.PLAYER,
    characters: [{ id: 'character-1', name: 'Quackers' }],
  });

  return [dm, ada];
}
