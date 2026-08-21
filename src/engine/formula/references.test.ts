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
    schemaVersion: 9,
    stats: [
      {
        id: 'id-str',
        name: 'Strength',
        abbreviation: 'STR',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'id-dex',
        name: 'Dexterity',
        abbreviation: 'DEX',
        description: '',
        order: 1,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'id-hp',
        name: 'Max Health',
        abbreviation: 'MAX',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
        formula: 'STR * 10',
      },
    ],
    skills: [
      {
        id: 'id-stl',
        name: 'Stealth',
        description: '',
        statWeights: [{ statId: 'id-dex', weight: 0.3 }],
      },
    ],
    // A roll's input is the second persisted formula field, the one that replaced the combat
    // skill's `bonusFormula` (TICKET-ROLL-06) — so the rename cases still cover two of them
    diceLadders: [
      {
        id: 'id-ladder',
        name: 'Standard',
        description: '',
        dieSizes: [20, 12, 6],
        showZeroTerms: true,
        remainder: 'flat',
      },
    ],
    rollDefinitions: [
      {
        id: 'id-mel',
        name: 'Melee',
        description: '',
        input: 'STR + skills.stealth',
        ladderId: 'id-ladder',
        order: 0,
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

function createCharacter(): Character {
  return {
    id: 'char1',
    name: 'Test',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: { 'id-str': 6, 'id-dex': 4 },
    investedSkillPoints: { 'id-stl': 3 },
    currentResourceValues: {},
    experience: 0,
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
  it('puts stat abbreviations, and only those, in the flat code space (TICKET-ROLL-06)', () => {
    const index = buildReferenceIndex(createConfig());

    expect(index.toId.bare.get('STR')).toBe('id-str');
    // The combat codes that used to share this space went with the entity; a roll was never in it
    expect([...index.toId.bare.keys()].sort()).toEqual(['DEX', 'MAX', 'STR']);
  });

  it('keeps a skill out of the flat space entirely (TICKET-SKL-02)', () => {
    // The half of the flat space a speciality code used to occupy is gone with the code
    const index = buildReferenceIndex(createConfig());

    expect(index.toId.bare.has('STL')).toBe(false);
    expect(index.toDisplay.bare.has('id-stl')).toBe(false);
  });

  it('exposes skills and stats under their namespaces by slug', () => {
    const index = buildReferenceIndex(createConfig());

    expect(index.toId.skills.get('stealth')).toBe('id-stl');
    expect(index.toDisplay.skills.get('id-stl')).toBe('stealth');
    expect(index.toId.stats.get('max_health')).toBe('id-hp');
    expect(index.toDisplay.stats.get('id-hp')).toBe('max_health');
  });

  it('gives an ambiguous spelling to the first claimant only', () => {
    const config = createConfig({
      stats: [
        {
          id: 'id-a',
          name: 'Health',
          abbreviation: 'HEA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: '1',
        },
        {
          id: 'id-b',
          name: 'health',
          abbreviation: 'HEA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: '2',
        },
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
    expect(toStoredFormula('skills.stealth.bonus', index)).toBe('skills.[id-stl].bonus');
  });

  it('leaves everything that is not a reference untouched', () => {
    expect(toStoredFormula('max(  1,round( STR /3 ) )', index)).toBe(
      'max(  1,round( [id-str] /3 ) )'
    );
  });

  it('spells ids back the way the ruleset spells them', () => {
    expect(toDisplayFormula('[id-str] + [id-dex]', index)).toBe('STR + DEX');
    expect(toDisplayFormula('stats.[id-hp] / 2', index)).toBe('stats.max_health / 2');
    expect(toDisplayFormula('skills.[id-stl].bonus', index)).toBe('skills.stealth.bonus');
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
      stats: config.stats.map((stat) =>
        stat.id === 'id-str' ? { ...stat, abbreviation: 'STG', name: 'Might' } : stat
      ),
    }));

    // Nothing to re-key on the character: investment is keyed by stat id (TICKET-STAT-01) and by
    // skill id (TICKET-SKL-02), so the same character is passed to both calculations.
    const after = calculateCharacter(character, renamed);

    expect(renamed.stats.find((candidate) => candidate.formula)?.formula).toBe('STG * 10');
    expect(renamed.rollDefinitions?.[0].input).toBe('STG + skills.stealth');
    expect(after.statValues).toEqual(before.statValues);
    expect(after.rollInputs).toEqual(before.rollInputs);
  });

  it('re-spells a skill everywhere it is named when the skill is renamed (TICKET-SKL-02)', () => {
    // A `Skill` has no code, so its *name* is the display spelling — renaming it re-slugs every
    // formula naming it, in both the level and the `.bonus` form
    const config = createConfig({
      stats: [
        {
          id: 'id-hp',
          name: 'Max Health',
          abbreviation: 'MAX',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'skills.stealth.bonus',
        },
      ],
    });

    const renamed = rename(config, (current) => ({
      ...current,
      skills: current.skills.map((skill) => ({ ...skill, name: 'Sneaking' })),
    }));

    expect(renamed.stats.find((candidate) => candidate.formula)?.formula).toBe(
      'skills.sneaking.bonus'
    );
    expect(renamed.rollDefinitions?.[0].input).toBe('STR + skills.sneaking');
  });

  it('keeps a skill computing the same level when a stat it weights is renamed (TICKET-SKL-02)', () => {
    // AC 4: a weight row points at a stat **id**, so a rename cannot orphan it. The skill's level
    // is the same number before and after, with no formula to re-spell at all.
    const character = createCharacter();
    const before = calculateCharacter(character, createConfig());

    const renamed = rename(createConfig(), (config) => ({
      ...config,
      stats: config.stats.map((stat) =>
        stat.id === 'id-dex' ? { ...stat, abbreviation: 'AGI', name: 'Agility' } : stat
      ),
    }));
    const after = calculateCharacter(character, renamed);

    expect(renamed.skills[0].statWeights).toEqual([{ statId: 'id-dex', weight: 0.3 }]);
    expect(after.skillLevels).toEqual(before.skillLevels);
    expect(after.skillBonuses).toEqual(before.skillBonuses);
  });

  it('re-spells a stat named in another formula when the stat is renamed', () => {
    const config = createConfig({
      rollDefinitions: [
        {
          id: 'id-mel',
          name: 'Melee',
          description: '',
          input: 'stats.max_health / 10',
          ladderId: 'id-ladder',
          order: 0,
        },
      ],
    });

    const renamed = rename(config, (current) => ({
      ...current,
      stats: current.stats.map((stat) =>
        stat.id === 'id-hp' ? { ...stat, name: 'Vitality' } : stat
      ),
    }));

    expect(renamed.rollDefinitions?.[0].input).toBe('stats.vitality / 10');
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
        {
          id: 'id-hp',
          name: 'Max Health',
          abbreviation: 'MAX',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'curve.point_buy.main(STR)',
        },
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

    expect(renamed.stats.find((candidate) => candidate.formula)?.formula).toBe(
      'curve.point_buy.main_type(STR)'
    );
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
        {
          id: 'id-1',
          name: 'One',
          abbreviation: 'ONE',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'curve.alpha.main(1)',
        },
        {
          id: 'id-2',
          name: 'Two',
          abbreviation: 'TWO',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'curve.beta.main(1)',
        },
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

    const formulaFor = (id: string) =>
      renamed.stats.find((candidate) => candidate.id === id)?.formula;

    expect(formulaFor('id-1')).toBe('curve.alpha.primary(1)');
    expect(formulaFor('id-2')).toBe('curve.beta.main(1)');
  });

  it('leaves a material bonus and a race stat block untouched through a rename', () => {
    // Both are keyed by stat **id** now — races since TICKET-RACE-01, material tier modifiers
    // since TICKET-MAT-01 — so there is nothing to re-spell in either. A translation pass over
    // them would be a way for display and stored form to disagree, not a safety net: the rename
    // moves the abbreviation and the modifier keeps pointing at the same stat regardless.
    const config = createConfig({
      races: [
        {
          id: 'race1',
          name: 'Dwarf',
          description: '',
          statValues: { 'id-str': 2 },
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
              bonuses: [{ statId: 'id-str', modifier: 1 }],
              value: { tierId: 'gold', amount: 1 },
            },
          ],
        },
      ],
    });

    const renamed = rename(config, (current) => ({
      ...current,
      stats: current.stats.map((stat) =>
        stat.id === 'id-str' ? { ...stat, abbreviation: 'STG' } : stat
      ),
    }));

    expect(renamed.materials[0].levels[0].bonuses[0].statId).toBe('id-str');
    expect(renamed.races[0].statValues).toEqual({ 'id-str': 2 });
  });

  it('leaves a link-shaped reference alone — it already points at an id', () => {
    const config = createConfig({
      races: [{ id: 'race1', name: 'Dwarf', description: '', statValues: {} }],
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

    expect(stored.stats.find((candidate) => candidate.formula)?.formula).toBe('[id-str] * 10');
    expect(toDisplayConfiguration(JSON.parse(JSON.stringify(stored)) as Configuration)).toEqual(
      config
    );
  });

  it('spells a stored formula with the current codes, not the ones it was written with', () => {
    const stored = toStoredConfiguration(createConfig());
    const withNewCode = {
      ...stored,
      stats: stored.stats.map((stat) =>
        stat.id === 'id-str' ? { ...stat, abbreviation: 'STG' } : stat
      ),
    };

    expect(
      toDisplayConfiguration(withNewCode).stats.find((candidate) => candidate.formula)?.formula
    ).toBe('STG * 10');
  });
});

describe('ensureReferenceIds', () => {
  it('mints an id for an entity that predates them and leaves the rest alone', () => {
    const config = createConfig();
    const legacy = {
      ...config,
      stats: config.stats.map(({ id: _dropped, ...rest }) => rest),
    } as Configuration;

    const completed = ensureReferenceIds(legacy, () => 'minted');

    expect(completed.stats.every((stat) => Boolean(stat.id))).toBe(true);
    expect(completed.skills[0].id).toBe('id-stl');
  });
});
