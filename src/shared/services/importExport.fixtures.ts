/**
 * The valid Configuration the import/export tests are written against
 *
 * Extracted when TICKET-DX-07 split the service in two: the pure half's tests live beside it in
 * `shared/`, the browser-file half's beside `client/services/configFiles.ts`, and both are written
 * against *this* ruleset. A copy in each file would let the two drift, which is the one thing a
 * round-trip fixture must not do.
 *
 * Deliberately small but not trivial: three stats including a resource with a formula, a skill with
 * stat weights, and a roll definition — so a round-trip exercises **both** persisted formula fields
 * (TICKET-ROLL-06) rather than only the stat one.
 */

import type { Configuration } from '../types/config';

/** A fresh, valid configuration — a function so no test can mutate another's fixture */
export function makeValidConfiguration(): Configuration {
  return {
    id: 'test-config',
    name: 'Test Config',
    version: '1.0.0',
    schemaVersion: 9,
    stats: [
      {
        id: 'STR',
        name: 'Strength',
        abbreviation: 'STR',
        description: 'Physical power',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'DEX',
        name: 'Dexterity',
        abbreviation: 'DEX',
        description: 'Agility',
        order: 1,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'health',
        name: 'Health',
        abbreviation: 'HEA',
        description: 'Hit points',
        order: 0,
        countsTowardTotal: true,
        isResource: true,
        rounding: 'none',
        formula: 'STR * 10',
      },
    ],
    skills: [
      {
        id: 'MEL',
        name: 'Melee',
        description: 'Close combat',
        statWeights: [
          { statId: 'STR', weight: 0.2 },
          { statId: 'DEX', weight: 0.1 },
        ],
      },
    ],
    // A roll's `input` is the **second** persisted formula field (TICKET-ROLL-06), so a round-trip
    // exercises `references.ts`'s roll branch as well as the stat one
    diceLadders: [
      {
        id: 'ladder',
        name: 'Standard',
        description: '',
        dieSizes: [20, 12, 6],
        showZeroTerms: true,
        remainder: 'flat',
      },
    ],
    rollDefinitions: [
      {
        id: 'roll-melee',
        name: 'Melee',
        description: '',
        input: 'STR + skills.melee',
        ladderId: 'ladder',
        order: 0,
      },
    ],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}
