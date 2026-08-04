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
    mainSkills: [
      { code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
      { code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
    ],
    stats: [{ id: 'health', name: 'Health', description: '', formula: 'STR * 10' }],
    specialitySkills: [
      { code: 'STL', name: 'Stealth', description: '', maxBaseLevel: 10, bonusFormula: 'DEX / 2' },
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
  it('gives a stat the main skill codes only (Requirement 3.2)', () => {
    const scope = scopeFor(createConfig(), 'stat');
    expect(Array.from(scope.codes).sort()).toEqual(['DEX', 'STR']);
  });

  it('gives a speciality skill the main skill codes only (Requirement 4.3)', () => {
    const scope = scopeFor(createConfig(), 'speciality-skill');
    expect(Array.from(scope.codes).sort()).toEqual(['DEX', 'STR']);
  });

  it('gives a combat skill main and speciality codes (Requirement 5.4)', () => {
    const scope = scopeFor(createConfig(), 'combat-skill');
    expect(Array.from(scope.codes).sort()).toEqual(['DEX', 'STL', 'STR']);
  });

  it('exposes stat ids as members of the stats namespace', () => {
    const scope = scopeFor(createConfig(), 'stat');
    expect(Array.from(scope.namespaces.stats ?? [])).toEqual(['health']);
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

  it('provides const and curve with no members until their entities exist', () => {
    const scope = scopeFor(createConfig(), 'stat');
    expect(scope.namespaces.const?.size).toBe(0);
    expect(scope.namespaces.curve?.size).toBe(0);
  });

  it('tracks the configuration rather than a snapshot', () => {
    const scope = scopeFor(
      createConfig({
        stats: [
          { id: 'health', name: 'Health', description: '', formula: 'STR' },
          { id: 'mana', name: 'Mana', description: '', formula: 'DEX' },
        ],
      }),
      'stat'
    );

    expect(Array.from(scope.namespaces.stats ?? []).sort()).toEqual(['health', 'mana']);
  });
});
