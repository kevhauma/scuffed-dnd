/**
 * Formula Scoping Tests
 *
 * **Validates: Concept 00 §5; Requirements 3.2, 4.3, 5.4**
 */

import { describe, expect, it } from 'vitest';
import type { Configuration } from '../../types/config';
import { KNOWN_NAMESPACES, NAMESPACE_SCOPES, scopeFor } from './scoping';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 9,
    stats: [
      {
        id: 'STR',
        name: 'Strength',
        abbreviation: 'STR',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'DEX',
        name: 'Dexterity',
        abbreviation: 'DEX',
        description: '',
        order: 1,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'health',
        name: 'Health',
        abbreviation: 'HEA',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: true,
        rounding: 'none',
        formula: 'STR * 10',
      },
    ],
    skills: [
      {
        id: 'STL',
        name: 'Stealth',
        description: '',
        statWeights: [{ statId: 'DEX', weight: 0.3 }],
      },
    ],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

describe('formula scoping tables', () => {
  it('declares a namespace row for every attachment point', () => {
    // No skill row since TICKET-SKL-02 (a `Skill` carries weight rows rather than a formula, so it
    // is not an attachment point at all) and no combat-skill row since TICKET-ROLL-06 took the
    // entity — a row goes when the thing it describes does
    expect(Object.keys(NAMESPACE_SCOPES).sort()).toEqual(['curve-generator', 'roll-input', 'stat']);
  });

  it('only lists namespaces the engine knows about', () => {
    for (const [owner, namespaces] of Object.entries(NAMESPACE_SCOPES)) {
      for (const namespace of namespaces) {
        expect(KNOWN_NAMESPACES, `${owner} lists an unknown namespace`).toContain(namespace);
      }
    }
  });

  it('can resolve members for every known namespace', () => {
    // The other direction: a namespace declared but never given a member source would hand
    // back undefined and silently turn every reference into "Unknown member".
    const config = createConfig();
    for (const namespace of KNOWN_NAMESPACES) {
      const owner = NAMESPACE_SCOPES.stat.includes(namespace) ? 'stat' : 'roll-input';
      const scope = scopeFor(config, owner);
      expect(scope.namespaces[namespace], `${namespace} has no member source`).toBeDefined();
    }
  });
});

describe('scopeFor', () => {
  it('gives a stat the stat abbreviations only (Requirement 3.2)', () => {
    // Every stat, derived ones included — a derived stat is readable from another formula
    const scope = scopeFor(createConfig(), 'stat');
    expect(Array.from(scope.codes).sort()).toEqual(['DEX', 'HEA', 'STR']);
  });

  it('gives a roll input the stat abbreviations only (Requirement 5.4)', () => {
    // v1 put speciality codes in this flat space, and TICKET-ROLL-06 took the combat codes out of
    // it too — a skill is reached as `skills.<name>` and the bare space is stats alone.
    const scope = scopeFor(createConfig(), 'roll-input');
    expect(Array.from(scope.codes).sort()).toEqual(['DEX', 'HEA', 'STR']);
  });

  it('exposes every stat by its slug as a member of the stats namespace', () => {
    const scope = scopeFor(createConfig(), 'stat');
    expect(Array.from(scope.namespaces.stats ?? [])).toEqual(['strength', 'dexterity', 'health']);
  });

  it('exposes each skill by its name slug as a member of the skills namespace (TICKET-SKL-02)', () => {
    // Not the 3-letter code v1 published here — a skill is spelled `skills.stealth` now
    const scope = scopeFor(createConfig(), 'roll-input');
    expect(Array.from(scope.namespaces.skills ?? [])).toEqual(['stealth']);
  });

  it('withholds the skills namespace from a stat, which cannot resolve one (CR-02)', () => {
    // Skills are computed *from* the finished stat values, so `calculateStatValues` has no skill
    // resolver to offer. Leaving `skills` in the row let a formula validate and preview with a
    // real number and then error `Unknown namespace: skills` every time the sheet computed it.
    const scope = scopeFor(createConfig(), 'stat');
    expect(scope.namespaces.skills).toBeUndefined();
    expect(scope.namespaces.stats).toBeDefined();
  });

  it('provides const and curve with no members when the ruleset has neither', () => {
    const scope = scopeFor(createConfig(), 'stat');
    expect(scope.namespaces.const?.size).toBe(0);
    expect(scope.namespaces.curve?.size).toBe(0);
  });

  it('gives a roll input everything a character is, like a derived stat (TICKET-ROLL-05)', () => {
    const config = createConfig();
    const scope = scopeFor(config, 'roll-input');

    // A roll is another reading of the character, so it sees the same set a derived stat does
    expect(Object.keys(scope.namespaces).sort()).toEqual(['const', 'curve', 'skills', 'stats']);
    expect([...scope.codes]).toEqual([...scopeFor(config, 'stat').codes]);
  });

  it('gives a curve generator the row key and the constants, and nothing else (TICKET-CRV-02)', () => {
    const scope = scopeFor(createConfig({}), 'curve-generator');

    // `key` as the User writes it; the parser normalises bare identifiers to uppercase
    expect(scope.codes.has('KEY')).toBe(true);
    // A generator fills a table, not a character, so no skill is in scope
    expect(scope.codes.has('STR')).toBe(false);
    expect(scope.namespaces.const).toBeDefined();
    // Deliberately absent: a table generated from another table is a cycle waiting to happen
    expect(scope.namespaces.curve).toBeUndefined();
    expect(scope.namespaces.stats).toBeUndefined();
  });

  it('publishes each curve by name (TICKET-CRV-01)', () => {
    const scope = scopeFor(
      createConfig({
        curves: [
          {
            id: 'id-xp',
            name: 'xp_thresholds',
            displayName: 'XP thresholds',
            description: '',
            keyName: 'level',
            columns: [{ id: 'col', name: 'xp_required' }],
            rows: [{ key: 1, values: [0] }],
            interpolation: 'step',
            outOfRange: 'error',
            lookupDirection: 'reverse',
          },
        ],
      }),
      'stat'
    );

    // The *column* is a third segment rather than a member, so it is not published here —
    // which column a call names is checked at evaluation, where the curve itself is in hand
    expect(scope.namespaces.curve?.has('xp_thresholds')).toBe(true);
    expect(scope.namespaces.curve?.has('xp_required')).toBe(false);
  });

  it('tracks the configuration rather than a snapshot', () => {
    const scope = scopeFor(
      createConfig({
        stats: [
          {
            id: 'str',
            name: 'Strength',
            abbreviation: 'STR',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: false,
            rounding: 'none',
          },
          {
            id: 'health',
            name: 'Health',
            abbreviation: 'HEA',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: true,
            rounding: 'none',
            formula: 'STR',
          },
          {
            id: 'mana',
            name: 'Mana',
            abbreviation: 'MAN',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: false,
            rounding: 'none',
            formula: 'DEX',
          },
        ],
      }),
      'stat'
    );

    expect(Array.from(scope.namespaces.stats ?? []).sort()).toEqual(['health', 'mana', 'strength']);
  });
});
