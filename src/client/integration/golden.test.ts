/**
 * Golden tests — the v2.0 milestone's parity gate (spec §12, TICKET-DX-04)
 *
 * Every ✅-confirmed derivation in `docs/excel export summary/concepts/`, run through the **real
 * engine** over the **real corpus** (`docs/imports/ducklets.json`) on a sample-character-shaped
 * configuration. `src/services/sheetImport.test.ts` proves that corpus is faithful and importable;
 * this proves the app computes the sheet's numbers *from* it.
 *
 * The suite is also an integration test of the whole v2.0 surface by construction: the ruleset is
 * imported through `importConfiguration`, put into the configuration store, edited through store
 * actions, and the characters are minted by `createCharacter` — so a break anywhere along
 * import → store → composition → skills → rolls lands here as a failing citation.
 *
 * **A failing fixture is never fixed by editing the fixture.** See [README.md](./README.md) for
 * the rule and for the three settlements this suite makes.
 *
 * The sample builder lives here rather than in a module beside `fixtures.ts` because it has to
 * reach the stores and services, and `engine/` is pure — the layering runs
 * `types → engine → services → stores`, so an engine module may not import downstream of itself.
 * `fixtures.ts` imports types only and stays inside the rule.
 *
 * **Validates: Concepts 01, 02, 03, 04, 05, 06, 07, 08, 20; spec §12**
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { calculateCharacter } from '#shared/engine/calculator';
import { affinityFor, pointBuyCurve, statGain } from '#shared/engine/calculators/pointBuy';
import { calculateRaceStatBases } from '#shared/engine/calculators/statCalculator';
import { decomposeValue, formatLadderNotation, rollPool } from '#shared/engine/dice';
import { asNumber } from '#shared/engine/formula/errors';
import {
  aptFixtures,
  bonusDividerFixtures,
  DIALLED_BONUS_DIVIDER,
  describeCitation,
  type GoldenFixture,
  LADDER_DIE_SIZES,
  ladderFixtures,
  POINT_BUY_MAIN_GENERATOR,
  pointBuyFixtures,
  poolFixtures,
  raceBlendFixtures,
  raceTotalFixtures,
  rollFixtures,
  SAMPLE_STAT_LINE,
  sampleStatTotal,
  skillFixtures,
  statLineFixtures,
} from '#shared/engine/golden/fixtures';
import { importConfiguration } from '#shared/services/importExport';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { IMPORTS_DIR, OUTPUT_FILE } from '../../../scripts/build-sheet-import.mjs';
import { useCharacterStore } from '../stores/characterStore';
import { useConfigStore } from '../stores/configStore';

/** The id the suite gives the sample character's race — see the README on why it is not in the corpus */
const SAMPLE_RACE_ID = 'race-ducklets';

/** The archetype the sample character is built on: *Funny*, main-type on Char (Concept 01) */
const SAMPLE_ARCHETYPE_ID = 'archetype-funny';

/** How close a float has to be to count — enough to catch a real drift, loose enough for `0.3` */
const PRECISION = 10;

/**
 * The sheet's ruleset, plus a race carrying the sample character's stat line
 *
 * Built through public APIs end to end: `importConfiguration` for the corpus, `replaceConfig` and
 * `addRace` for the edits. The stat line is installed as a **race stat block** because the export
 * does not say how it splits between race base and point-buy spend — see the README.
 *
 * @param statValues - The block to install; defaults to the documented line
 * @returns The configuration as the store now holds it
 */
function buildSampleConfiguration(
  statValues: Record<string, number> = { ...SAMPLE_STAT_LINE }
): Configuration {
  const corpus = importConfiguration(readFileSync(join(IMPORTS_DIR, OUTPUT_FILE), 'utf-8'));
  const store = useConfigStore.getState();

  store.replaceConfig(corpus);
  store.addRace({
    id: SAMPLE_RACE_ID,
    name: 'Ducklets',
    description:
      "The sample character's stat line from Concept 01, installed as a base. The sheet's own " +
      'split between race block and point-buy spend is not in the export.',
    statValues,
  });

  const built = useConfigStore.getState().config;
  if (built === null) throw new Error('the configuration store holds no ruleset');
  return built;
}

/** What a sample character may vary from Bickuss Dickuss */
interface SampleCharacterOptions {
  raceIds?: string[];
  investedStatPoints?: Record<string, number>;
  investedSkillPoints?: Record<string, number>;
}

/**
 * Bickuss Dickuss, minted by the character store
 *
 * `createCharacter` refuses an allocation the ruleset cannot afford or price, so a character coming
 * back at all is already an assertion — the sample spends nothing, which every budget allows.
 *
 * @param config - The ruleset to build on
 * @param options - What to vary
 * @returns The stored character
 */
function buildSampleCharacter(
  config: Configuration,
  options: SampleCharacterOptions = {}
): Character {
  const character = useCharacterStore.getState().createCharacter(
    {
      name: 'Bickuss Dickuss',
      raceIds: options.raceIds ?? [SAMPLE_RACE_ID],
      archetypeId: SAMPLE_ARCHETYPE_ID,
      investedStatPoints: options.investedStatPoints ?? {},
      investedSkillPoints: options.investedSkillPoints ?? {},
    },
    config
  );

  if (character === null) {
    throw new Error('the character store refused the sample allocation');
  }
  return character;
}

/** A corpus entity by the sheet's own spelling, or a failure naming what is missing */
function idOf(entities: { id: string; name: string }[], name: string, kind: string): string {
  const found = entities.find((entity) => entity.name === name);
  if (found === undefined) throw new Error(`the corpus has no ${kind} named "${name}"`);
  return found.id;
}

describe('golden fixtures — the sheet’s confirmed derivations', () => {
  let config: Configuration;
  let sample: ReturnType<typeof calculateCharacter>;

  beforeEach(() => {
    useCharacterStore.getState().resetCharacters();
    config = buildSampleConfiguration();
    sample = calculateCharacter(buildSampleCharacter(config), config);
  });

  describe('every fixture is citable', () => {
    const all: GoldenFixture[] = [
      ...statLineFixtures,
      sampleStatTotal,
      ...skillFixtures,
      ...bonusDividerFixtures,
      ...aptFixtures,
      ...pointBuyFixtures,
      POINT_BUY_MAIN_GENERATOR,
      ...raceTotalFixtures,
      ...raceBlendFixtures,
      ...ladderFixtures,
      ...rollFixtures,
      ...poolFixtures,
    ];

    it('names a concept page and a section for every row', () => {
      const uncited = all.filter(
        (fixture) => fixture.citation.concept === '' || fixture.citation.section === ''
      );

      expect(uncited.map((fixture) => fixture.name)).toEqual([]);
    });

    it('marks exactly the rows the pages mark 🔍, and no others', () => {
      // Pinned rather than counted: a confirmed row quietly re-tagged as inferred is how a suite
      // stops being a parity gate, and it would not otherwise fail anything
      expect(all.filter((fixture) => fixture.inferred).map((fixture) => fixture.name)).toEqual([
        'Charm with one starting pick — 11.7 + 1.5, the page’s "Persuasion" row',
        'Speed 22 still gets 1 — the creature call sheet’s value',
      ]);
    });
  });

  describe('the sample character’s stat line (Concept 01)', () => {
    it.each(statLineFixtures)('$name', (fixture) => {
      expect(
        asNumber(sample.statValues[fixture.statId]),
        describeCitation(fixture.citation)
      ).toBeCloseTo(fixture.expected, PRECISION);
    });

    it(sampleStatTotal.name, () => {
      expect(sample.statTotal, describeCitation(sampleStatTotal.citation)).toBe(
        sampleStatTotal.expected
      );
    });
  });

  describe('skills — level and bonus (Concept 02)', () => {
    it.each(skillFixtures)('$name', (fixture) => {
      const skillId = idOf(config.skills, fixture.skillName, 'skill');
      const calculated = calculateCharacter(
        buildSampleCharacter(config, { investedSkillPoints: { [skillId]: fixture.invested } }),
        config
      );
      const citation = describeCitation(fixture.citation);

      expect(asNumber(calculated.skillLevels[skillId]), citation).toBeCloseTo(
        fixture.expectedLevel,
        PRECISION
      );
      expect(asNumber(calculated.skillBonuses[skillId]), citation).toBe(fixture.expectedBonus);
    });
  });

  describe(`const.bonus_divider as a dial — turned down to ${DIALLED_BONUS_DIVIDER}`, () => {
    let dialled: ReturnType<typeof calculateCharacter>;
    let dialledConfig: Configuration;

    beforeEach(() => {
      const store = useConfigStore.getState();
      const constantId = idOf(config.constants ?? [], 'bonus_divider', 'constant');

      store.updateConstant(constantId, { value: DIALLED_BONUS_DIVIDER });

      const updated = useConfigStore.getState().config;
      if (updated === null) throw new Error('the configuration store holds no ruleset');
      dialledConfig = updated;
      dialled = calculateCharacter(buildSampleCharacter(dialledConfig), dialledConfig);
    });

    it.each(bonusDividerFixtures)('$name', (fixture) => {
      const skillId = idOf(dialledConfig.skills, fixture.skillName, 'skill');
      const citation = describeCitation(fixture.citation);

      // The level is unchanged by the dial — only what it divides into is
      expect(asNumber(dialled.skillLevels[skillId]), citation).toBeCloseTo(
        fixture.expectedLevel,
        PRECISION
      );
      expect(asNumber(dialled.skillBonuses[skillId]), citation).toBe(fixture.expectedBonus);
    });
  });

  describe('APT — the sheet’s one derived stat (Concepts 01, 05)', () => {
    it.each(aptFixtures)('$name', (fixture) => {
      const speedConfig = buildSampleConfiguration({
        ...SAMPLE_STAT_LINE,
        'stat-speed': fixture.speed,
      });
      const calculated = calculateCharacter(buildSampleCharacter(speedConfig), speedConfig);

      expect(asNumber(calculated.statValues['stat-apt']), describeCitation(fixture.citation)).toBe(
        fixture.expected
      );
    });
  });

  describe('point buy — what a spent point is worth (Concepts 03, 06)', () => {
    it.each(pointBuyFixtures)('$name', (fixture) => {
      expect(
        asNumber(statGain(fixture.points, fixture.affinity, pointBuyCurve(config))),
        describeCitation(fixture.citation)
      ).toBeCloseTo(fixture.expected, PRECISION);
    });

    it(POINT_BUY_MAIN_GENERATOR.name, () => {
      const curve = pointBuyCurve(config);
      if (curve === undefined) throw new Error('the corpus has no point_buy curve');
      const citation = describeCitation(POINT_BUY_MAIN_GENERATOR.citation);

      // Every row, through the engine's own lookup rather than by reading the table back — the
      // 0 row excepted, where "a spend of nothing buys nothing" overrides the generator's 0.75
      expect(curve.rows.length).toBeGreaterThan(1);
      for (const row of curve.rows.filter(({ key }) => key > 0)) {
        expect(
          asNumber(statGain(row.key, 'main', curve)),
          `${citation} — ${row.key} points`
        ).toBeCloseTo(POINT_BUY_MAIN_GENERATOR.factor * (row.key + 1), PRECISION);
      }
    });

    it('routes the archetype’s main stat through the main column', () => {
      const funny = (config.archetypes ?? []).find(
        (archetype) => archetype.id === SAMPLE_ARCHETYPE_ID
      );

      expect(affinityFor(funny, 'stat-char')).toBe('main');
      expect(affinityFor(funny, 'stat-strenght')).toBe('non');
    });
  });

  describe('six-core-only stat totals (Concept 01)', () => {
    it.each(raceTotalFixtures)('$name', (fixture) => {
      const raceId = idOf(config.races, fixture.raceName, 'race');
      const calculated = calculateCharacter(
        buildSampleCharacter(config, { raceIds: [raceId] }),
        config
      );

      expect(calculated.statTotal, describeCitation(fixture.citation)).toBe(fixture.expected);
    });
  });

  describe('the hybrid race blend (Concept 04)', () => {
    it.each(raceBlendFixtures)('$name', (fixture) => {
      const races = fixture.raceNames.map((name) => {
        const raceId = idOf(config.races, name, 'race');
        const race = config.races.find((candidate) => candidate.id === raceId);
        if (race === undefined) throw new Error(`the corpus has no race named "${name}"`);
        return race;
      });

      expect(
        calculateRaceStatBases(races, config.constants)[fixture.statId],
        describeCitation(fixture.citation)
      ).toBe(fixture.expected);
    });

    it('leaves a same-race blend as the race itself — the sheet’s single-race character', () => {
      const ducklets = config.races.find((race) => race.id === SAMPLE_RACE_ID);
      if (ducklets === undefined) throw new Error('the sample race was not installed');

      expect(
        calculateRaceStatBases([ducklets, ducklets], config.constants),
        describeCitation({ concept: '04 · Creature', section: 'Hybrid races ✅' })
      ).toEqual(SAMPLE_STAT_LINE);
    });
  });

  describe('the dice ladder (Concepts 07, 08)', () => {
    it('is the Calculator’s literal [20, 12, 6]', () => {
      expect(config.diceLadders?.[0]?.dieSizes).toEqual(LADDER_DIE_SIZES);
    });

    it.each(ladderFixtures)('$name', (fixture) => {
      const ladder = config.diceLadders?.[0];
      if (ladder === undefined) throw new Error('the corpus carries no dice ladder');

      const decomposition = decomposeValue(fixture.input, ladder);
      const citation = describeCitation(fixture.citation);

      expect(
        decomposition.counts.map(({ count }) => count),
        citation
      ).toEqual([...fixture.expectedCounts]);
      expect(decomposition.flat, citation).toBe(fixture.expectedFlat);
      expect(formatLadderNotation(decomposition, ladder), citation).toBe(fixture.expectedNotation);
    });
  });

  describe('roll definitions end to end (Concept 08)', () => {
    it.each(rollFixtures)('$name', (fixture) => {
      const roll = (config.rollDefinitions ?? []).find(
        (candidate) => candidate.name === fixture.rollName
      );
      if (roll === undefined) throw new Error(`the corpus has no roll named "${fixture.rollName}"`);

      const citation = describeCitation(fixture.citation);
      const input = asNumber(sample.rollInputs[roll.id]);
      expect(input, citation).toBe(fixture.expectedInput);
      if (input === undefined) throw new Error(`${fixture.rollName} produced no input`);

      // The pool comes from `rollPool`, the one place a pool is derived, so this is the same
      // computation the sheet's button label runs (TICKET-ROLL-06)
      const pool = rollPool(roll, input, config);
      expect('notation' in pool ? pool.notation : pool.message, citation).toBe(
        fixture.expectedNotation
      );
    });
  });

  describe('resource pools — behaviour, not derivation (Concept 20)', () => {
    it.each(poolFixtures)('$name', (fixture) => {
      const citation = describeCitation(fixture.citation);

      // The maximum is derived, and the current value is stored — seeded from it at creation
      expect(asNumber(sample.statValues[fixture.statId]), citation).toBe(fixture.expectedMax);
      expect(sample.currentResourceValues[fixture.statId], citation).toBe(fixture.expectedMax);
    });

    it('keeps a stored current value when the derived maximum moves under it', () => {
      const store = useCharacterStore.getState();
      const character = buildSampleCharacter(config);

      store.updateCurrentStatValue(character.id, 'stat-mana', 200, config);

      // Cut the pool's ceiling by editing the ruleset, exactly as a rebalance would
      useConfigStore.getState().updateRace(SAMPLE_RACE_ID, {
        statValues: { ...SAMPLE_STAT_LINE, 'stat-mana': 100 },
      });
      const rebalanced = useConfigStore.getState().config;
      if (rebalanced === null) throw new Error('the configuration store holds no ruleset');

      const stored = useCharacterStore.getState().getCharacter(character.id);
      if (stored === undefined) throw new Error('the character store lost the sample character');
      const calculated = calculateCharacter(stored, rebalanced);

      expect(asNumber(calculated.statValues['stat-mana'])).toBe(100);
      // Never silently overwritten — Concept 20's non-negotiable
      expect(calculated.currentResourceValues['stat-mana']).toBe(200);
    });
  });
});
