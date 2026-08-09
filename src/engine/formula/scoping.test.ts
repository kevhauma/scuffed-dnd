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
    schemaVersion: 3,
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
    specialitySkills: [
      {
        id: 'STL',
        code: 'STL',
        name: 'Stealth',
        description: '',
        maxBaseLevel: 10,
        bonusFormula: 'DEX / 2',
      },
    ],
    combatSkills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    focusStatBonusLevel: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

describe('formula scoping tables', () => {
  it('declares a namespace row for every attachment point', () => {
    expect(Object.keys(NAMESPACE_SCOPES).sort()).toEqual([
      'combat-skill',
      'curve-generator',
      'speciality-skill',
      'stat',
    ]);
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
      const owner = NAMESPACE_SCOPES.stat.includes(namespace) ? 'stat' : 'combat-skill';
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

  it('gives a speciality skill the stat abbreviations only (Requirement 4.3)', () => {
    const scope = scopeFor(createConfig(), 'speciality-skill');
    expect(Array.from(scope.codes).sort()).toEqual(['DEX', 'HEA', 'STR']);
  });

  it('gives a combat skill stat abbreviations and speciality codes (Requirement 5.4)', () => {
    const scope = scopeFor(createConfig(), 'combat-skill');
    expect(Array.from(scope.codes).sort()).toEqual(['DEX', 'HEA', 'STL', 'STR']);
  });

  it('exposes every stat by its slug as a member of the stats namespace', () => {
    const scope = scopeFor(createConfig(), 'stat');
    expect(Array.from(scope.namespaces.stats ?? [])).toEqual(['strength', 'dexterity', 'health']);
  });

  it('exposes speciality codes as members of the skills namespace', () => {
    const scope = scopeFor(createConfig(), 'combat-skill');
    expect(Array.from(scope.namespaces.skills ?? [])).toEqual(['STL']);
  });

  it('withholds the skills namespace from a speciality skill', () => {
    const scope = scopeFor(createConfig(), 'speciality-skill');
    expect(scope.namespaces.skills).toBeUndefined();
    expect(scope.namespaces.stats).toBeDefined();
  });

  it('provides const and curve with no members when the ruleset has neither', () => {
    const scope = scopeFor(createConfig(), 'stat');
    expect(scope.namespaces.const?.size).toBe(0);
    expect(scope.namespaces.curve?.size).toBe(0);
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
