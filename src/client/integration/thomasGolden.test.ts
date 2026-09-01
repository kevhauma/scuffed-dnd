/**
 * *Thomas the test more* — the v4 parity gate (v4.0 overview, the data pass)
 *
 * The other golden suite ([golden.test.ts](./golden.test.ts)) pins the **old** workbook's sample
 * character against the concept pages that reverse-engineered it. This one pins the **new**
 * workbook's, and it asks a different question: not *does the engine reproduce a derivation the
 * spec confirmed*, but **can a User import `docs/imports/ducklets.json`, build the character the
 * sheet has on it, and read the same numbers off both.**
 *
 * That is the whole of it, so the inputs are the Setup tab's and the expectations are the Character
 * Sheet's, cell by cell:
 *
 * | Setup | |
 * |---|---|
 * | Race 1 / Race 2 | Ducklets, Ducklets (`Setup` B8:B9) |
 * | Archetype | Science (`Setup` B12) |
 * | Focus skills | Arcane, Summening, **Arcane again** (`Setup` B15:B17) |
 * | Points spend | 3, all on Int (`Character Sheet` L3, `Calcu` AK4) |
 * | Level / Dream level | 1 and 1 (`Character Sheet` B4:B5) |
 * | Right hand | Iron Ore 10 Battleaxe with Diamond 4 inlay (`Backpack` C8:D8) |
 *
 * **One thing the corpus cannot supply, and it is deliberate**: the workbook never says which slot a
 * template goes in — it composes that at the point of use — so `items.json` leaves
 * `equipmentSlotType` absent on all 830 templates rather than guessing, and this suite assigns the
 * Battleaxe its slot the way a User would. That assignment is the *only* edit made to the imported
 * ruleset, and it is named here rather than buried, because it is exactly the gap a Player meets.
 *
 * **A failing expectation is never fixed by editing the expectation** — golden.test.ts's rule, and
 * for the same reason. The one place this suite deliberately disagrees with the sheet is Summening,
 * whose level cell reads Stealing's stat row; the User ruled on 2026-08-29 that the reference
 * table's intent is built rather than the slip reproduced, and the row below says so in as many
 * words.
 *
 * **Validates: v4 systems/02, 03, 04, 05, 06, 07, 09, 10, 12**
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { calculateCharacter } from '#shared/engine/calculator';
import { rollPool } from '#shared/engine/dice';
import { asNumber } from '#shared/engine/formula/errors';
import { importConfiguration } from '#shared/services/importExport';
import { composeBuild, equipToSlot, isRefusal } from '#shared/services/playerActions';
import type { CalculatedCharacter, Character, ComposedItem } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { IMPORTS_DIR, OUTPUT_FILE } from '../../../scripts/build-sheet-import.mjs';
import { useCharacterStore } from '../stores/characterStore';
import { useConfigStore } from '../stores/configStore';

/** The slot the sheet puts the sample's weapon in, and the one the corpus cannot name for itself */
const WEAPON_SLOT = 'right_hand';

/** The build the sample wears — `Backpack` D8, spelled as a set of links (TICKET-INV-05) */
const WORN_BUILD: ComposedItem = {
  id: 'build-thomas-battleaxe',
  templateId: 'item-battleaxe',
  materialId: 'material-iron-ore',
  materialLevel: 10,
  inlayId: 'inlay-diamond',
  inlayLevel: 4,
};

/**
 * The corpus, with the one thing the workbook never says filled in the way a User would
 *
 * @returns The ruleset as the configuration store now holds it
 */
function buildRuleset(): Configuration {
  const corpus = importConfiguration(readFileSync(join(IMPORTS_DIR, OUTPUT_FILE), 'utf-8'));
  const store = useConfigStore.getState();
  store.replaceConfig(corpus);

  // The sheet composes "which slot" at the point of use, so the fragment leaves it absent on every
  // template rather than inventing a mapping (items.json's own note). A User assigns it once
  store.updateItem('item-battleaxe', { equipmentSlotType: WEAPON_SLOT });

  const built = useConfigStore.getState().config;
  if (built === null) throw new Error('the configuration store holds no ruleset');
  return built;
}

/**
 * Thomas as the Setup tab builds him, wearing what the Backpack tab has him wearing
 *
 * Every step is a public action — `createCharacter`, `composeBuild`, `equipToSlot` — so a refusal
 * anywhere is a failure of the corpus rather than of the fixture, which is the point of routing it
 * this way instead of assembling a `Character` literal.
 *
 * @param config - The ruleset to build on
 * @returns The stored character
 */
function buildThomas(config: Configuration): Character {
  const created = useCharacterStore.getState().createCharacter(
    {
      name: 'Thomas the test more',
      raceIds: ['race-ducklets', 'race-ducklets'],
      archetypeId: 'archetype-smart',
      investedStatPoints: { 'stat-int': 3 },
      investedSkillPoints: {},
      focusSkillIds: ['skill-arcane', 'skill-summening', 'skill-arcane'],
    },
    config
  );
  if (created === null) throw new Error('the character store refused the sample allocation');

  const composed = composeBuild(created, config, WORN_BUILD);
  if (isRefusal(composed)) throw new Error(`the build was refused: ${composed.refusal}`);

  const equipped = equipToSlot(composed.character, config, WEAPON_SLOT, WORN_BUILD.id);
  if (isRefusal(equipped)) throw new Error(`the equip was refused: ${equipped.refusal}`);

  return equipped.character;
}

describe('Thomas the test more — the v4 workbook’s own sample character', () => {
  let config: Configuration;
  let thomas: Character;
  let sheet: CalculatedCharacter;

  beforeEach(() => {
    config = buildRuleset();
    thomas = buildThomas(config);
    sheet = calculateCharacter(thomas, config);
  });

  describe('core attributes (Character Sheet B10:N12)', () => {
    /**
     * The finished line, assembled from three sources the sheet keeps in separate columns:
     * the race blend (`Calcu` S3:S11), the equipped gear (X3:X11) and the archetype gain (Z3:Z11).
     */
    const FINAL_STATS: ReadonlyArray<readonly [string, string, number]> = [
      ['Strenght', 'stat-strenght', 26],
      ['Dex', 'stat-dex', 9],
      ['Con', 'stat-con', 26],
      ['Int', 'stat-int', 11],
      ['Wis', 'stat-wis', 13],
      ['Char', 'stat-char', 22],
      ['Health', 'stat-health', 8],
      ['Mana', 'stat-mana', 4211],
      ['Speed', 'stat-speed', 20],
    ];

    it.each(FINAL_STATS)('%s reads %s as %i', (_name, statId, expected) => {
      const value = asNumber(sheet.statValues[statId]);
      expect(value).toBe(expected);
    });

    it('derives ATP from Speed, as the identity block shows it', () => {
      // `Character Sheet` B6 — max(1, round(20 / 30)) is the floor doing its job
      const apt = asNumber(sheet.statValues['stat-apt']);
      expect(apt).toBe(1);
    });

    it('spends exactly the points the sheet spends, and has none left (L2:L3)', () => {
      const spent = Object.values(thomas.investedStatPoints ?? {});
      const total = spent.reduce((sum, points) => sum + points, 0);

      expect(total).toBe(3);
      // Level 1 × const.points_per_level 3 = 3, all of it on Int — *Points to Use* reads 0
      const perLevel = config.constants?.find((constant) => constant.name === 'points_per_level');
      expect(perLevel?.value).toBe(3);
    });
  });

  describe('where each number comes from (Calcu S:Z)', () => {
    it('blends two Ducklets into one Ducklets', () => {
      // A pure-blood is the same race in both slots, which is how `Setup` B8:B9 writes this one —
      // and `(a + a) / 2 = a` falls out of the blend rather than being a special case
      const ducklets = config.races.find((race) => race.id === 'race-ducklets');
      expect(ducklets?.statValues['stat-strenght']).toBe(8);
      expect(ducklets?.statValues['stat-char']).toBe(14);
    });

    it('adds the material and the gem the worn build is made of', () => {
      // Strenght 26 = Ducklets 8 + Iron Ore 10's 10 + Diamond 4's 8, and nothing else
      const iron = config.materials.find((material) => material.id === 'material-iron-ore');
      const tenth = iron?.levels.find((level) => level.level === 10);
      const ironStrength = tenth?.bonuses.find((bonus) => bonus.statId === 'stat-strenght');
      expect(ironStrength?.modifier).toBe(10);

      const diamond = config.inlays?.find((inlay) => inlay.id === 'inlay-diamond');
      const fourth = diamond?.tiers.find((tier) => tier.tier === 4);
      const gemStrength = fourth?.bonuses.find((bonus) => bonus.statId === 'stat-strenght');
      expect(gemStrength?.modifier).toBe(8);

      // The gem is where the sample's 4,211 Mana comes from — the material tab has no Mana column
      const gemMana = fourth?.bonuses.find((bonus) => bonus.statId === 'stat-mana');
      expect(gemMana?.modifier).toBe(4000);
    });

    it('routes the archetype gain by affinity, dream level and all (TICKET-ARC-04)', () => {
      // Science is main on Int and sub on Wis and Mana. At dream level 1: Int gains
      // point_buy.main(3) × 1 = 3, and each sub stat gains point_buy.sub(0) + 1 = 1 with nothing
      // spent on it — which is where the sample's Wis 13 and its odd 4,211th point of Mana come from
      const science = config.archetypes?.find((archetype) => archetype.id === 'archetype-smart');
      expect(science?.name).toBe('Science');
      expect(science?.statAffinity['stat-int']).toBe('main');
      expect(science?.statAffinity['stat-wis']).toBe('sub');
      expect(science?.statAffinity['stat-mana']).toBe('sub');
    });
  });

  describe('skills (Character Sheet B16:N29)', () => {
    /**
     * Level and bonus per skill, read off the sheet's three skill columns.
     *
     * The set is chosen to cover every mechanism at once rather than all 48: a skill chosen twice
     * (Arcane at 3.3), one chosen once (Summening at 2.1), several unchosen (0.9), a duo skill whose
     * *secondary* stat matters (Athletics, intimidation), and two whose bonus is moved by the
     * equipped Battleaxe's own vector on top of the level.
     */
    const SKILLS: ReadonlyArray<readonly [string, string, number, number]> = [
      // Chosen twice — 1.5 + 1.5 + 0.3 = 3.3. (11 × 0.2 + 13 × 0.1) × 3.3 = 11.55 → 12
      ['Arcane', 'skill-arcane', 12, 3],
      // Unchosen — 0.3 × 3 = 0.9. 11 × 0.35 × 0.9 = 3.465 → 4
      ['Alchemy', 'skill-alchemy', 4, 1],
      // Duo, and the secondary stat is the one that carries it: (9 × 0.2 + 26 × 0.1) × 0.9 = 3.96
      // → 4, and the bonus is ceil(4/5) = 1 plus the Battleaxe's +2
      ['Athletics', 'skill-athletics', 4, 3],
      // (26 × 0.2 + 22 × 0.1) × 0.9 = 6.66 → 7, bonus ceil(7/5) = 2 plus the Battleaxe's +3
      ['intimidation', 'skill-intimidation', 7, 5],
      // 26 × 0.35 × 0.9 = 8.19 → 9, and the axe does not touch it
      ['Black smithing', 'skill-black-smithing', 9, 2],
      // 13 × 0.35 × 0.9 = 4.095 → 5
      ['perception', 'skill-perception', 5, 1],
      // (22 × 0.2 + 26 × 0.1) × 0.9 = 6.3 → 7
      ['Persuasion', 'skill-persuasion', 7, 2],
    ];

    it.each(SKILLS)('%s is level %i, bonus %i', (_name, skillId, level, bonus) => {
      const calculatedLevel = asNumber(sheet.skillLevels[skillId]);
      expect(calculatedLevel).toBe(level);
      const calculatedBonus = asNumber(sheet.skillBonuses[skillId]);
      expect(calculatedBonus).toBe(bonus);
    });

    it('reads Summening off its own row, where the sheet reads Stealing’s', () => {
      // **The one deliberate disagreement.** `Calcu` D38 looks up reference row 40 (Stealing) for
      // Summening's primary stat, so the sheet scales it off Dex and prints level 7. The reference
      // table says Wis 0.2 + Int 0.1, and the User ruled on 2026-08-29 that the table's intent is
      // what gets built: (13 × 0.2 + 11 × 0.1) × 2.1 = 7.77 → 8.
      const level = asNumber(sheet.skillLevels['skill-summening']);
      expect(level).toBe(8);

      // Stealing itself is unaffected — it was always reading its own row
      const stealing = asNumber(sheet.skillLevels['skill-stealing']);
      expect(stealing).toBe(3);
    });

    it('gives the axe’s penalties to the skills the sheet gives them to', () => {
      // The Battleaxe is −1 on eight skills, and the vector reaches the *bonus* rather than the
      // level (TICKET-ITEM-01). Sneaking's level is 9 × 0.35 × 0.9 = 2.835 → 3, so its bonus is
      // ceil(3/5) = 1 minus the axe's 1
      const sneaking = asNumber(sheet.skillBonuses['skill-sneaking']);
      expect(sneaking).toBe(0);
    });
  });

  describe('combat rolls (Character Sheet G2:G5)', () => {
    /** The four pools, notation and all, as the sheet's own buttons are labelled */
    const ROLLS: ReadonlyArray<readonly [string, number, string]> = [
      ['Mele', 26, '1D20 + 0D12 + 1D6 + 0'],
      ['Ranged', 9, '0D20 + 0D12 + 1D6 + 3'],
      // Dex 9 + Speed 20 / 5 = 13
      ['Evasion', 13, '0D20 + 1D12 + 0D6 + 1'],
      // (26 + 26) / 2.5 + 8 / 5 = 20.8 + 1.6 = 22.4, whose remainder rounds to 2 (TICKET-ROLL-08)
      ['Endurance', 22.4, '1D20 + 0D12 + 0D6 + 2'],
    ];

    it.each(ROLLS)('%s reads %d and throws %s', (name, expectedInput, notation) => {
      const roll = config.rollDefinitions?.find((candidate) => candidate.name === name);
      if (roll === undefined) throw new Error(`the corpus has no roll named "${name}"`);

      const input = asNumber(sheet.rollInputs[roll.id]);
      expect(input).toBeCloseTo(expectedInput, 10);
      if (input === undefined) throw new Error(`${name} produced no input`);

      const pool = rollPool(roll, input, config);
      const label = 'notation' in pool ? pool.notation : pool.message;
      expect(label).toBe(notation);
    });
  });

  describe('what the corpus could not supply on its own', () => {
    it('leaves every template’s slot unassigned, because the workbook never says', () => {
      // Recorded rather than worked around: the one edit this suite makes to the imported ruleset
      // is the one a User has to make too, and a later ticket that gives templates their slots
      // should delete this test rather than change it
      const corpus = importConfiguration(readFileSync(join(IMPORTS_DIR, OUTPUT_FILE), 'utf-8'));
      const slotted = corpus.items.filter((item) => item.equipmentSlotType !== undefined);

      expect(slotted).toEqual([]);
    });

    it('prices nothing, so the purse has nothing to buy the axe with', () => {
      // The new workbook dropped every price (overview D5). A build is composed rather than bought,
      // which is why the sample character is reproducible at all without them
      const corpus = importConfiguration(readFileSync(join(IMPORTS_DIR, OUTPUT_FILE), 'utf-8'));
      const amounts = corpus.materials.flatMap((material) =>
        material.levels.map((level) => level.value.amount)
      );
      const distinct = new Set(amounts);

      expect([...distinct]).toEqual([0]);
    });
  });
});
