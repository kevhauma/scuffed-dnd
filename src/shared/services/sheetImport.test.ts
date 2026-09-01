/**
 * The sheet-import corpus is a real, importable ruleset — proven, not assumed.
 *
 * `docs/imports/` holds one fragment per built feature, carrying that feature's slice of the
 * source spreadsheet, and `docs/imports/ducklets.json` is the merge of all of them. This suite is
 * what makes those files trustworthy: the envelope is present on every fragment, the committed
 * merge matches what the fragments currently say, and the result passes the same
 * `validateConfigurationShape` the app's Import button runs.
 *
 * A failure here means one of three things, in rough order of likelihood: a fragment changed and
 * `yarn run sheet:import` was not re-run; a fragment was hand-edited into a shape the importer
 * refuses; or a persisted shape changed and the corpus has not caught up. All three are the
 * corpus's problem to fix — never the test's.
 *
 * **The fragment list below is deliberately fixed through v4.0's shape pass**
 * ([D7](../../../docs/v4.0_sheet_parity/overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)).
 * That milestone suspends *every feature ships its sheet data* while the whole corpus is
 * re-sourced at once, so spells, inlays and passives are shapes with no fragment yet and the list
 * has twelve entries rather than fifteen on purpose. What this suite keeps proving meanwhile is the
 * half that still binds: the corpus regenerates byte-identically and still imports clean **at the
 * new shape** (TICKET-DX-09). The rule, and the three missing fragments, return with the data pass.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; Concept 00 §6**
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildConfiguration,
  collisions,
  IMPORTS_DIR,
  OUTPUT_FILE,
  readFragments,
  renderConfiguration,
} from '../../../scripts/build-sheet-import.mjs';
import { decomposeValue } from '../engine/dice/diceLadder';
import { statMemberName } from '../engine/formula/references';
import { validateFormula } from '../engine/formula/validator';
import { validateConfiguration } from '../engine/validator';
import { SUPPORTED_SCHEMA_VERSION } from '../types/config';
import { importConfiguration, validateConfigurationShape } from './importExport';

const fragments = readFragments();

describe('sheet import fragments', () => {
  it('finds a fragment for every built feature', () => {
    expect(fragments.map((entry) => entry.name)).toEqual([
      'archetypes.json',
      'constants.json',
      'currency-tiers.json',
      'curves.json',
      'dice-ladders.json',
      'equipment-slots.json',
      'inlays.json',
      'items.json',
      'materials.json',
      'passives.json',
      'races.json',
      'roll-definitions.json',
      'skills.json',
      'spells.json',
      'stats.json',
    ]);
  });

  it.each(fragments)('$name carries its provenance envelope', ({ fragment }) => {
    expect(typeof fragment.feature).toBe('string');
    expect(typeof fragment.title).toBe('string');
    expect(Array.isArray(fragment.tickets)).toBe(true);
    expect(typeof fragment.concept).toBe('string');
    expect(fragment.source.spreadsheet).toMatch(/^https:\/\/docs\.google\.com\/spreadsheets\//);
    expect(fragment.source.ranges.length).toBeGreaterThan(0);
    expect(typeof fragment.confidence).toBe('string');
    // Notes are where a value that does *not* fit the current shape gets recorded, so a fragment
    // with none is a fragment nobody wrote down the caveats for
    expect(fragment.notes.length).toBeGreaterThan(0);
    expect(Object.keys(fragment.data).length).toBeGreaterThan(0);
  });
});

describe('the merged ruleset', () => {
  const committed = readFileSync(join(IMPORTS_DIR, OUTPUT_FILE), 'utf-8');

  it('is up to date with the fragments', () => {
    // Re-runs the merge rather than comparing counts: a fragment edited without regenerating is
    // the failure this catches, and it looks identical from the outside until you diff the bytes
    expect(committed).toBe(renderConfiguration());
  });

  it('has no id or formula-spelling collisions across fragments', () => {
    expect(collisions(buildConfiguration(fragments))).toEqual([]);
  });

  it('passes the importer the app itself uses', () => {
    expect(validateConfigurationShape(JSON.parse(committed))).toEqual({
      isValid: true,
      errors: [],
    });
  });

  it('imports at the current schema version, with the sheet in it', () => {
    const config = importConfiguration(committed);

    expect(config.schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
    expect(config.stats.map((stat) => stat.abbreviation)).toContain('APT');
    expect(config.skills).toHaveLength(48);
    expect(config.curves?.find((curve) => curve.name === 'point_buy')?.rows).toHaveLength(51);
  });
});

describe('the confirmed derivations survive the round trip', () => {
  const config = importConfiguration(readFileSync(join(IMPORTS_DIR, OUTPUT_FILE), 'utf-8'));

  it('keeps the six-core-only stat totals (Concept 01)', () => {
    // A race is a stat block keyed by stat id since TICKET-RACE-01, so the six-core total is a
    // sum over the counted stats rather than a filter over a modifier list
    const core = config.stats.filter((stat) => stat.countsTowardTotal);
    const total = (race: string) => {
      const block = config.races.find((candidate) => candidate.name === race)?.statValues;
      if (!block) return undefined;
      return core.reduce((sum, stat) => sum + (block[stat.id] ?? 0), 0);
    };

    expect(core).toHaveLength(6);
    expect(total('human')).toBe(60);
    expect(total('elf')).toBe(64);
    expect(total('dwarf')).toBe(60);
    expect(total('Raccoon')).toBe(59);
    // The rule re-confirmed against the v4 catalog's own unlabelled total row: the sample
    // character's race sums to 59 over the six, with Health, Mana and Speed excluded
    expect(total('Ducklets')).toBe(59);
    expect(total('goliath')).toBe(81);
  });

  it('keeps the point-buy main column at 0.75 x (points + 1) (Concept 06)', () => {
    const pointBuy = config.curves?.find((curve) => curve.name === 'point_buy');
    const main = pointBuy?.columns.findIndex((column) => column.name === 'main') ?? -1;

    expect(main).toBeGreaterThanOrEqual(0);
    for (const row of pointBuy?.rows ?? []) {
      expect(row.values[main]).toBeCloseTo(0.75 * (row.key + 1), 10);
    }
  });

  it('keeps the dice ladder decomposing the sheet values (Concept 07)', () => {
    const ladder = config.diceLadders?.[0];
    if (!ladder) throw new Error('the corpus carries no dice ladder');

    const row = (value: number) => {
      const { counts, flat } = decomposeValue(value, ladder);
      return [...counts.map((entry) => entry.count), flat];
    };

    expect(ladder.dieSizes).toEqual([20, 12, 6]);
    expect(row(10)).toEqual([0, 0, 1, 4]);
    expect(row(39)).toEqual([1, 1, 1, 1]);
  });

  it('keeps every roll reading names the corpus defines, down a ladder that exists (systems/07)', () => {
    // The references a roll holds, checked against what the corpus actually defines: the ladder by
    // id, the input's `stats.<slug>` against the stats fragment, and — since the data pass gave
    // evasion and endurance their real formulas — its `const.<name>` against the constants
    const ladderIds = new Set((config.diceLadders ?? []).map((ladder) => ladder.id));
    const slugs = new Set(config.stats.map((stat) => statMemberName(stat)));
    const constants = new Set((config.constants ?? []).map((constant) => constant.name));

    expect(config.rollDefinitions).toHaveLength(4);
    for (const roll of config.rollDefinitions ?? []) {
      expect(ladderIds.has(roll.ladderId), `${roll.name} names a missing ladder`).toBe(true);
      const { namespacedReferences } = validateFormula(roll.input);
      for (const reference of namespacedReferences) {
        const known = reference.namespace === 'const' ? constants : slugs;
        const defined = known.has(reference.member);
        expect(defined, `${roll.name} reads a missing ${reference.namespace}`).toBe(true);
      }
    }
  });

  it('keeps all four roll inputs, which the v4 workbook finally states (systems/07)', () => {
    const inputOf = (name: string) =>
      config.rollDefinitions?.find((roll) => roll.name === name)?.input;

    // Confirmed since v2.0: the final stat, straight down the ladder
    const melee = inputOf('Mele');
    expect(melee).toBe('stats.strenght');
    const ranged = inputOf('Ranged');
    expect(ranged).toBe('stats.dex');

    // v2.0 shipped these two deliberately *short* — the old sheet's 18 and 16 carried a term
    // nothing explained. The xlsx writes both out, so Concept 08's open question is closed
    const evasion = inputOf('Evasion');
    expect(evasion).toBe('stats.dex + stats.speed / const.evasion_speed_divisor');
    const endurance = inputOf('Endurance');
    expect(endurance).toBe(
      '(stats.strenght + stats.con) / const.endurance_body_divisor + stats.health / const.endurance_health_divisor'
    );
  });

  it('keeps the v4 skill weights the reference table states (systems/06)', () => {
    // Weight rows rather than a formula string since TICKET-SKL-02, and keyed by stat **id** —
    // so this reads through the stats to check the spelling the systems document uses.
    // The numbers are the *reference table's*, not the workbook's arithmetic: the User ruled on
    // 2026-08-29 that the sheet's two copy-fill bugs are fixed rather than reproduced, so a duo
    // skill genuinely reads its secondary stat and Summening scales off its own row.
    const abbreviationOf = (statId: string) =>
      config.stats.find((stat) => stat.id === statId)?.abbreviation;

    const weights = (name: string) =>
      config.skills
        .find((skill) => skill.name === name)
        ?.statWeights.map(({ statId, weight }) => `${abbreviationOf(statId)} ${weight}`)
        .join(' + ');

    // Mono skills weigh 0.35 — every old 0.3 became one, and alchemy moved off INT 0.2
    const charm = weights('Charm');
    expect(charm).toBe('CHA 0.35');
    const trading = weights('Trading');
    expect(trading).toBe('CHA 0.35');
    const brewing = weights('Brewing');
    expect(brewing).toBe('WIS 0.35');
    const blackSmithing = weights('Black smithing');
    expect(blackSmithing).toBe('STR 0.35');
    const alchemy = weights('Alchemy');
    expect(alchemy).toBe('INT 0.35');

    // Duo skills weigh 0.2 on the primary and 0.1 on the secondary
    const cooking = weights('Cooking');
    expect(cooking).toBe('WIS 0.2 + DEX 0.1');
    // The weights v2.0's golden suite pinned, unchanged by the new workbook
    const persuasion = weights('Persuasion');
    expect(persuasion).toBe('CHA 0.2 + STR 0.1');
    // The bug the app declines to reproduce: the sheet computes this off Dex twice
    const athletics = weights('Athletics');
    expect(athletics).toBe('DEX 0.2 + STR 0.1');
    // The other one: the sheet reads Stealing's row here, so it scales Summening off Dex
    const summening = weights('Summening');
    expect(summening).toBe('WIS 0.2 + INT 0.1');
  });

  it('holds the v4 workbook 48, not the old sheet 48 (systems/06)', () => {
    const names = config.skills.map((skill) => skill.name);

    expect(names).toHaveLength(48);
    // New in this workbook — `Summening` was only ever a focus-skill spelling before
    expect(names).toContain('Summening');
    expect(names).toContain('woodcrafting');
    // Gone: `sewing`, and v2.0's deliberate `skinning`/`Skinning` duplicate resolved to one
    expect(names).not.toContain('sewing');
    expect(names).not.toContain('Skinning');

    const unique = new Set(names);
    expect(unique.size).toBe(48);
  });

  it('keeps every weight pointing at a stat the corpus actually defines', () => {
    // The failure mode a fragment keyed by id has that a formula string did not: a weight can
    // name an id no stats.json row supplies, and nothing spells it out at import time
    const statIds = new Set(config.stats.map((stat) => stat.id));
    const dangling = config.skills.flatMap((skill) =>
      skill.statWeights
        .filter((row) => !statIds.has(row.statId))
        .map((row) => `${skill.name} → ${row.statId}`)
    );

    expect(dangling).toEqual([]);
  });

  it('keeps the constants the sheet labels (Concept 05)', () => {
    const value = (name: string) =>
      config.constants?.find((constant) => constant.name === name)?.value;

    expect(value('bonus_divider')).toBe(5);
    expect(value('apt_value')).toBe(30);
    expect(value('points_per_level')).toBe(3);
  });
});

/**
 * The v4 catalogs, pinned against the workbook the data pass read them from.
 *
 * These are the acceptance criteria of TICKET-MAT-03 and TICKET-ITEM-02 written as assertions:
 * the counts the reconciliation turned on, the sample-confirmed rows, and the two absences the
 * fragments promise — no stat axis the material tab does not have, and no price anywhere.
 */
describe('the v4 catalogs', () => {
  const committed = readFileSync(join(IMPORTS_DIR, OUTPUT_FILE), 'utf-8');
  const parsed = importConfiguration(committed);

  it('holds 24 material families in four groups, ten tiers apiece (MAT-03)', () => {
    expect(parsed.materials).toHaveLength(24);
    expect(parsed.materialCategories).toHaveLength(4);

    const groups = parsed.materialCategories.map((category) => category.name);
    expect(groups).toEqual(['biological material', 'Stone & Clay', 'Raw Ores', 'new materials']);

    const rungs = parsed.materials.map((material) => material.levels.length);
    const tiers = new Set(rungs);
    expect([...tiers]).toEqual([10]);
  });

  it('grants what the sample character reads off Iron Ore 10 (MAT-03)', () => {
    const iron = parsed.materials.find((material) => material.name === 'Iron Ore');
    const tenth = iron?.levels.find((level) => level.level === 10);
    const granted = tenth?.bonuses.map((bonus) => `${bonus.statId} ${bonus.modifier}`);

    expect(granted).toEqual(['stat-strenght 10', 'stat-con 10', 'stat-health 5']);
  });

  it('round-trips a hand-authored ladder rather than generating one (MAT-03)', () => {
    const wood = parsed.materials.find((material) => material.name === 'Wood');
    const dexterity = wood?.levels.map((level) => {
      const row = level.bonuses.find((bonus) => bonus.statId === 'stat-dex');
      return row ? row.modifier : 0;
    });

    // Not linear, and not a multiple of the tier-1 vector — every rung is data
    expect(dexterity).toEqual([1, 1, 2, 2, 3, 4, 4, 5, 5, 6]);
  });

  it('targets no stat axis the material tab does not have (MAT-03)', () => {
    const targeted = parsed.materials.flatMap((material) =>
      material.levels.flatMap((level) => level.bonuses.map((bonus) => bonus.statId))
    );
    const axes = new Set(targeted);

    // The tab covers seven of nine stats; Mana and Speed are the inlays' axes (systems/10)
    expect(axes.has('stat-mana')).toBe(false);
    expect(axes.has('stat-speed')).toBe(false);
    expect(axes.has('stat-health')).toBe(true);
  });

  it('prices nothing, because the new workbook prices nothing (D5)', () => {
    const amounts = parsed.materials.flatMap((material) =>
      material.levels.map((level) => level.value.amount)
    );
    const distinct = new Set(amounts);

    expect([...distinct]).toEqual([0]);

    // The old fragment parked base values in item descriptions — those retire with the prices
    const priced = parsed.items.filter((item) => /\bcopper\b/i.test(item.description));
    expect(priced).toEqual([]);
  });

  it('reconciles the item matrix to 830 templates (ITEM-02)', () => {
    expect(parsed.items).toHaveLength(830);

    const names = parsed.items.map((item) => item.name);
    const unique = new Set(names);
    expect(unique.size).toBe(830);

    const shops = parsed.items.map((item) => item.shop).filter(Boolean);
    const distinct = new Set(shops);
    expect(distinct.size).toBe(9);
  });

  it("spells the Battleaxe's full vector as systems/11 quotes it (ITEM-02)", () => {
    const nameOf = new Map(parsed.skills.map((skill) => [skill.id, skill.name]));
    const battleaxe = parsed.items.find((item) => item.name === 'Battleaxe');
    const vector = battleaxe?.skillBonuses?.map(
      (bonus) => `${nameOf.get(bonus.skillId)} ${bonus.modifier}`
    );

    expect(battleaxe?.categoryId).toBe('Arsenal');
    expect(battleaxe?.shop).toBe('Imperial Forge');
    expect(vector).toEqual([
      'Assassination -1',
      'Athletics 2',
      'Butchering 1',
      'Construction 1',
      'Dancing 1',
      'graple -1',
      'hand to hand -1',
      'Hiding -1',
      'intimidation 3',
      'Lock picking -1',
      'Prefomance 1',
      'skinning -1',
      'Sneaking -1',
      'Summening -1',
      'Storytelling 1',
      'Teaching 1',
      'woodcrafting 1',
      'woodcutting 2',
    ]);
  });

  it('takes the tail vector where the tail and a headed row disagree (ITEM-02)', () => {
    // The User's 2026-09-01 ruling: the un-headed tail is the creator's revision, so its clean
    // positive-only vector replaces the headed copy's blanket of −1 nuisance penalties
    const nameOf = new Map(parsed.skills.map((skill) => [skill.id, skill.name]));
    const cake = parsed.items.find((item) => item.name === 'Barley Cake');
    const vector = cake?.skillBonuses?.map(
      (bonus) => `${nameOf.get(bonus.skillId)} ${bonus.modifier}`
    );

    expect(vector).toEqual(['Cooking 1']);
    // The headed row still decides where the template is sold
    expect(cake?.categoryId).toBe('Peasant Fare');
    expect(cake?.shop).toBe('Imperial Restaurant');
  });

  it('leaves the tail-only rows uncategorised rather than filing them by position (ITEM-02)', () => {
    const uncategorised = parsed.items.filter((item) => item.categoryId === undefined);

    expect(uncategorised).toHaveLength(99);
    // They fall under Bedding & Comfort by position only, which the fragment declines to assert
    const shops = uncategorised.map((item) => item.shop);
    const distinct = new Set(shops);
    expect([...distinct]).toEqual([undefined]);

    const names = uncategorised.map((item) => item.name);
    expect(names).toContain('Cane Sugar (1kg)');
    expect(names).toContain('Harvested Hide 10');
    // A tail row whose name a headed category already holds is *not* here — it kept that
    // category and only its vector was taken (the ruling above)
    expect(names).not.toContain('Flour (5kg)');
  });

  it('holds no dangling reference of any kind', () => {
    // The check `validateConfigurationShape` cannot make and the merge's id-collision pass does not:
    // whether every id one entity *points at* is an id some other entity **has**. It earns its place
    // — regenerating the coin ladder from the workbook's own spellings moved every currency tier's
    // id, and 240 material tiers went on naming the one it replaced. Nothing else noticed
    const report = validateConfiguration(parsed);
    const messages = report.errors.map((error) => error.message);

    expect(messages).toEqual([]);
    expect(report.isValid).toBe(true);
  });

  it('warns only where the sheet genuinely declined to say (archetype affinity)', () => {
    // Six warnings, one per archetype, and they are the honest state rather than a gap to fill: the
    // workbook tags one `main` and two `sub` stats per archetype and says nothing about the other
    // seven, which take the `non` default. Tagging all ten to silence this would invent six
    // decisions nobody made
    const report = validateConfiguration(parsed);
    const categories = report.warnings.map((warning) => warning.category);
    const unique = new Set(categories);

    expect(report.warnings).toHaveLength(6);
    expect([...unique]).toEqual(['Data Consistency']);
  });

  it('resolves every skill a vector names against the corpus 48 (ITEM-02)', () => {
    const skillIds = new Set(parsed.skills.map((skill) => skill.id));
    const dangling = parsed.items.flatMap((item) =>
      (item.skillBonuses ?? [])
        .filter((bonus) => !skillIds.has(bonus.skillId))
        .map((bonus) => `${item.name} → ${bonus.skillId}`)
    );

    expect(dangling).toEqual([]);
  });
});
