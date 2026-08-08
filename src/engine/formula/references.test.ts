/**
 * Formula Reference Tests
 *
 * The rename contract: a formula points at ids, so renaming what it names changes only how it is
 * spelled — never what it computes.
 *
 * **Validates: Concept 00 §6; spec §3.2**
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../../types/character';
import type { Configuration } from '../../types/config';
import { calculateCharacter } from '../calculator';
import {
  buildReferenceIndex,
  ensureReferenceIds,
  statMemberName,
  toDisplayConfiguration,
  toDisplayFormula,
  toStoredConfiguration,
  toStoredFormula,
} from './references';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    mainSkills: [
      { id: 'id-str', code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
      { id: 'id-dex', code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
    ],
    stats: [{ id: 'id-hp', name: 'Max Health', description: '', formula: 'STR * 10' }],
    specialitySkills: [
      {
        id: 'id-stl',
        code: 'STL',
        name: 'Stealth',
        description: '',
        maxBaseLevel: 10,
        bonusFormula: 'DEX / 2',
      },
    ],
    combatSkills: [
      {
        id: 'id-atk',
        code: 'ATK',
        name: 'Attack',
        description: '',
        dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
        bonusFormula: 'STR + STL',
      },
    ],
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

function createCharacter(): Character {
  return {
    id: 'char1',
    name: 'Test',
    configurationId: 'config1',
    raceIds: [],
    mainSkillLevels: { STR: 6, DEX: 4 },
    specialitySkillBaseLevels: { STL: 3 },
    currentStatValues: {},
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

/** Rename an entity the way a store action does: patch the id-resolved form, translate back */
function rename(config: Configuration, patch: (config: Configuration) => Configuration) {
  return toDisplayConfiguration(patch(toStoredConfiguration(config)));
}

describe('statMemberName', () => {
  it('slugs a name into an identifier-shaped member', () => {
    expect(statMemberName({ name: 'Max Health' })).toBe('max_health');
    expect(statMemberName({ name: 'Speed' })).toBe('speed');
    expect(statMemberName({ name: 'Armour Class (AC)' })).toBe('armour_class_ac');
  });

  it('keeps a member that could not start with a letter parseable', () => {
    expect(statMemberName({ name: '2nd Wind' })).toBe('stat_2nd_wind');
    expect(statMemberName({ name: '!!!' })).toBe('stat_');
  });
});

describe('buildReferenceIndex', () => {
  it('puts every skill kind in the one flat code space', () => {
    const index = buildReferenceIndex(createConfig());

    expect(index.toId.bare.get('STR')).toBe('id-str');
    expect(index.toId.bare.get('STL')).toBe('id-stl');
    expect(index.toId.bare.get('ATK')).toBe('id-atk');
  });

  it('exposes speciality skills under skills and stats by their slug', () => {
    const index = buildReferenceIndex(createConfig());

    expect(index.toId.skills.get('STL')).toBe('id-stl');
    expect(index.toId.stats.get('max_health')).toBe('id-hp');
    expect(index.toDisplay.stats.get('id-hp')).toBe('max_health');
  });

  it('gives an ambiguous spelling to the first claimant only', () => {
    const config = createConfig({
      stats: [
        { id: 'id-a', name: 'Health', description: '', formula: '1' },
        { id: 'id-b', name: 'health', description: '', formula: '2' },
      ],
    });
    const index = buildReferenceIndex(config);

    expect(index.toId.stats.get('health')).toBe('id-a');
    expect(index.toDisplay.stats.has('id-b')).toBe(false);
  });
});

describe('toStoredFormula / toDisplayFormula', () => {
  const index = buildReferenceIndex(createConfig());

  it('resolves bare codes and namespaced members to ids', () => {
    expect(toStoredFormula('STR + DEX', index)).toBe('[id-str] + [id-dex]');
    expect(toStoredFormula('stats.max_health / 2', index)).toBe('stats.[id-hp] / 2');
    expect(toStoredFormula('skills.STL.level', index)).toBe('skills.[id-stl].level');
  });

  it('leaves everything that is not a reference untouched', () => {
    expect(toStoredFormula('max(  1,round( STR /3 ) )', index)).toBe(
      'max(  1,round( [id-str] /3 ) )'
    );
  });

  it('spells ids back the way the ruleset spells them', () => {
    expect(toDisplayFormula('[id-str] + [id-dex]', index)).toBe('STR + DEX');
    expect(toDisplayFormula('stats.[id-hp] / 2', index)).toBe('stats.max_health / 2');
    expect(toDisplayFormula('skills.[id-stl].level', index)).toBe('skills.STL.level');
  });

  it('round-trips a formula in both directions', () => {
    const display = 'round((STR + DEX) / 2) + stats.max_health';
    expect(toDisplayFormula(toStoredFormula(display, index), index)).toBe(display);
  });

  it('is idempotent — translating twice changes nothing', () => {
    const stored = toStoredFormula('STR + DEX', index);
    expect(toStoredFormula(stored, index)).toBe(stored);
  });

  it('keeps references it cannot resolve exactly as written', () => {
    expect(toStoredFormula('STR + XYZ', index)).toBe('[id-str] + XYZ');
    expect(toDisplayFormula('[id-str] + [id-gone]', index)).toBe('STR + [id-gone]');
    expect(toStoredFormula('curve.growth(STR)', index)).toBe('curve.growth([id-str])');
    expect(toStoredFormula('const.bonus_divider', index)).toBe('const.bonus_divider');
  });

  it('resolves references either side of a power operator (TICKET-FORM-07)', () => {
    // `^` is not identifier-shaped, so the scan steps over it — but only once the tokenizer
    // knows it, which it did not before this operator existed
    expect(toStoredFormula('STR ^ 2 + DEX', index)).toBe('[id-str] ^ 2 + [id-dex]');
    expect(toDisplayFormula('[id-str] ^ 2 + [id-dex]', index)).toBe('STR ^ 2 + DEX');
  });

  it('keeps an unparseable formula rather than mangling it', () => {
    expect(toStoredFormula('STR + #', index)).toBe('STR + #');
  });
});

describe('the rename test (Concept 00 §6)', () => {
  it('keeps every formula computing the same numbers when a code is renamed', () => {
    const character = createCharacter();
    const before = calculateCharacter(character, createConfig());

    const renamed = rename(createConfig(), (config) => ({
      ...config,
      mainSkills: config.mainSkills.map((skill) =>
        skill.id === 'id-str' ? { ...skill, code: 'STG', name: 'Might' } : skill
      ),
    }));

    // Allocations are keyed by code, so the character store re-keys them as part of the same
    // rename (`characterStore.renameSkillCode`). That half is applied here so this test isolates
    // the formula half; `integration.test.ts` exercises both together.
    const after = calculateCharacter(
      { ...character, mainSkillLevels: { STG: 6, DEX: 4 } },
      renamed
    );

    expect(renamed.stats[0].formula).toBe('STG * 10');
    expect(renamed.combatSkills[0].bonusFormula).toBe('STG + STL');
    expect(after.maxStatValues).toEqual(before.maxStatValues);
    expect(after.combatSkillBonuses).toEqual(before.combatSkillBonuses);
  });

  it('re-spells a speciality skill named through both syntaxes', () => {
    const config = createConfig({
      stats: [{ id: 'id-hp', name: 'Max Health', description: '', formula: 'skills.STL.level' }],
    });

    const renamed = rename(config, (current) => ({
      ...current,
      specialitySkills: current.specialitySkills.map((skill) => ({ ...skill, code: 'SNK' })),
    }));

    expect(renamed.stats[0].formula).toBe('skills.SNK.level');
    expect(renamed.combatSkills[0].bonusFormula).toBe('STR + SNK');
  });

  it('re-spells a stat named in another formula when the stat is renamed', () => {
    const config = createConfig({
      combatSkills: [
        {
          id: 'id-atk',
          code: 'ATK',
          name: 'Attack',
          description: '',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'stats.max_health / 10',
        },
      ],
    });

    const renamed = rename(config, (current) => ({
      ...current,
      stats: current.stats.map((stat) => ({ ...stat, name: 'Vitality' })),
    }));

    expect(renamed.combatSkills[0].bonusFormula).toBe('stats.vitality / 10');
  });

  it('re-spells a curve column when the column is renamed (TICKET-CRV-03)', () => {
    const config = createConfig({
      curves: [
        {
          id: 'id-pb',
          name: 'point_buy',
          displayName: 'Point buy',
          description: '',
          keyName: 'points',
          columns: [
            { id: 'id-col-non', name: 'non' },
            { id: 'id-col-main', name: 'main' },
          ],
          rows: [{ key: 0, values: [0, 0.75] }],
          interpolation: 'step',
          outOfRange: 'error',
          lookupDirection: 'forward',
        },
      ],
      stats: [
        { id: 'id-hp', name: 'Max Health', description: '', formula: 'curve.point_buy.main(STR)' },
      ],
    });

    const renamed = rename(config, (current) => ({
      ...current,
      curves: (current.curves ?? []).map((curve) => ({
        ...curve,
        columns: curve.columns.map((column) =>
          column.id === 'id-col-main' ? { ...column, name: 'main_type' } : column
        ),
      })),
    }));

    expect(renamed.stats[0].formula).toBe('curve.point_buy.main_type(STR)');
  });

  it('leaves a column spelled by name in an older stored formula alone', () => {
    // Formulas persisted before TICKET-CRV-03 hold the column as plain text. Nothing resolves it,
    // so it stays as written and still reads the right column — which is the one property every
    // existing ruleset depends on.
    const config = createConfig({
      curves: [
        {
          id: 'id-pb',
          name: 'point_buy',
          displayName: 'Point buy',
          description: '',
          keyName: 'points',
          columns: [
            { id: 'id-col-non', name: 'non' },
            { id: 'id-col-main', name: 'main' },
          ],
          rows: [{ key: 0, values: [0, 0.75] }],
          interpolation: 'step',
          outOfRange: 'error',
          lookupDirection: 'forward',
        },
      ],
    });
    const index = buildReferenceIndex(config);

    expect(toDisplayFormula('curve.[id-pb].main(1)', index)).toBe('curve.point_buy.main(1)');
    expect(toStoredFormula('curve.point_buy.main(1)', index)).toBe(
      'curve.[id-pb].[id-col-main](1)'
    );
  });

  it('keeps two curves’ identically named columns apart', () => {
    // Column spellings are only unique within a curve, so the stored form has to be scoped by
    // the owning curve — otherwise renaming one `main` re-spells the other one too
    const curve = (id: string, name: string, columnId: string) => ({
      id,
      name,
      displayName: name,
      description: '',
      keyName: 'points',
      columns: [{ id: columnId, name: 'main' }],
      rows: [{ key: 0, values: [1] }],
      interpolation: 'step' as const,
      outOfRange: 'error' as const,
      lookupDirection: 'forward' as const,
    });

    const config = createConfig({
      curves: [curve('id-a', 'alpha', 'id-col-a'), curve('id-b', 'beta', 'id-col-b')],
      stats: [
        { id: 'id-1', name: 'One', description: '', formula: 'curve.alpha.main(1)' },
        { id: 'id-2', name: 'Two', description: '', formula: 'curve.beta.main(1)' },
      ],
    });

    const renamed = rename(config, (current) => ({
      ...current,
      curves: (current.curves ?? []).map((candidate) =>
        candidate.id === 'id-a'
          ? { ...candidate, columns: [{ id: 'id-col-a', name: 'primary' }] }
          : candidate
      ),
    }));

    expect(renamed.stats[0].formula).toBe('curve.alpha.primary(1)');
    expect(renamed.stats[1].formula).toBe('curve.beta.main(1)');
  });

  it('carries racial and material bonuses through a rename too', () => {
    const config = createConfig({
      races: [
        {
          id: 'race1',
          name: 'Dwarf',
          description: '',
          skillModifiers: [{ skillCode: 'STR', modifier: 2 }],
        },
      ],
      materials: [
        {
          id: 'mat1',
          name: 'Iron',
          description: '',
          categoryId: 'cat1',
          levels: [
            {
              level: 1,
              name: 'Iron',
              bonuses: [{ skillCode: 'STR', modifier: 1 }],
              value: { tierId: 'gold', amount: 1 },
            },
          ],
        },
      ],
    });

    const renamed = rename(config, (current) => ({
      ...current,
      mainSkills: current.mainSkills.map((skill) =>
        skill.id === 'id-str' ? { ...skill, code: 'STG' } : skill
      ),
    }));

    expect(renamed.races[0].skillModifiers[0].skillCode).toBe('STG');
    expect(renamed.materials[0].levels[0].bonuses[0].skillCode).toBe('STG');
  });

  it('leaves a link-shaped reference alone — it already points at an id', () => {
    const config = createConfig({
      races: [{ id: 'race1', name: 'Dwarf', description: '', skillModifiers: [] }],
      items: [{ id: 'item1', name: 'Axe', description: '', materialId: 'mat1' }],
    });

    const renamed = rename(config, (current) => ({
      ...current,
      races: current.races.map((race) => ({ ...race, name: 'Duergar' })),
    }));

    expect(renamed.races[0].id).toBe('race1');
    expect(renamed.items[0].materialId).toBe('mat1');
  });
});

describe('toStoredConfiguration / toDisplayConfiguration', () => {
  it('survives a JSON round trip and comes back in display form', () => {
    const config = createConfig();
    const stored = toStoredConfiguration(config);

    expect(stored.stats[0].formula).toBe('[id-str] * 10');
    expect(toDisplayConfiguration(JSON.parse(JSON.stringify(stored)) as Configuration)).toEqual(
      config
    );
  });

  it('spells a stored formula with the current codes, not the ones it was written with', () => {
    const stored = toStoredConfiguration(createConfig());
    const withNewCode = {
      ...stored,
      mainSkills: stored.mainSkills.map((skill) =>
        skill.id === 'id-str' ? { ...skill, code: 'STG' } : skill
      ),
    };

    expect(toDisplayConfiguration(withNewCode).stats[0].formula).toBe('STG * 10');
  });
});

describe('ensureReferenceIds', () => {
  it('mints an id for a skill that predates them and leaves the rest alone', () => {
    const config = createConfig();
    const legacy = {
      ...config,
      mainSkills: config.mainSkills.map(({ id: _dropped, ...rest }) => rest),
    } as Configuration;

    const completed = ensureReferenceIds(legacy, () => 'minted');

    expect(completed.mainSkills.every((skill) => Boolean(skill.id))).toBe(true);
    expect(completed.specialitySkills[0].id).toBe('id-stl');
  });
});
