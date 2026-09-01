/**
 * Template text resolved for a real character (TICKET-PAS-01)
 *
 * The proof behind v4 D4's promise on the *passives* side: the two of the workbook's 26 that are
 * live formulas — Blindsight's `perception level × 10` feet and darkvision's `× 5` — come out as
 * numbers **for the character reading them**, and the other 24 come out as the sentence they were
 * written as.
 *
 * **Both fixtures are shaped like the sheet's own rows** rather than invented: a sense whose range
 * scales off a skill level, and a resistance line that computes nothing. Their real texts pin once
 * the data pass transcribes them (overview D7); what is pinned here is the mechanism.
 *
 * The whole point of testing through `templateContextFor` rather than a hand-built context is that
 * it is the thing both readers call — the Spellbook and the sheet's passives panel — so what these
 * cases prove is what a Player actually sees. In particular the **flat stat space** is checked
 * (`{PER}`), because a context supplying namespaces alone is CR-02's bug: a placeholder that
 * validates, previews, and then fails at the table.
 *
 * **Validates: v4 D4; v4 systems/14**
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../types/character';
import type { Configuration } from '../types/config';
import { asNumber, isFormulaError } from './formula/errors';
import { FORMULA_OWNER } from './formula/scoping';
import { resolveTemplate } from './formula/template';
import { templateContextFor } from './templateContext';

/** One invested stat and one skill weighted entirely off it, so the arithmetic is readable */
const RULES = {
  id: 'config-1',
  name: 'Test',
  version: '1.0',
  schemaVersion: 10,
  stats: [
    {
      id: 'stat-per',
      name: 'Perception',
      abbreviation: 'PER',
      description: '',
      order: 0,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
    },
  ],
  skills: [
    {
      id: 'skill-perception',
      name: 'Perception',
      description: '',
      statWeights: [{ statId: 'stat-per', weight: 1 }],
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
} as unknown as Configuration;

/** A character whose Perception stat is worth 5, so the skill's level is 5 */
function aSeer(): Character {
  return {
    id: 'character-1',
    name: 'Quackers',
    configurationId: 'config-1',
    raceIds: [],
    investedStatPoints: { 'stat-per': 5 },
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

/** What a resolved template reads as, with each computed number rendered */
function readAs(template: string, character: Character): string {
  const context = templateContextFor(character, RULES, FORMULA_OWNER.SPELL_EFFECT);
  const segments = resolveTemplate(template, context);

  return segments
    .map((segment) => {
      if (segment.kind === 'text') return segment.text;
      if (isFormulaError(segment.result)) return `⟨${segment.source}⟩`;

      return String(asNumber(segment.result));
    })
    .join('');
}

describe('a passive effect resolved for its holder', () => {
  it('computes a sense whose range scales off a skill level — the Blindsight shape', () => {
    const reading = readAs(
      'You have blindsight out to {skills.perception.level * 10} feet.',
      aSeer()
    );

    expect(reading).toBe('You have blindsight out to 50 feet.');
  });

  it('computes darkvision off the same level at a different scaler', () => {
    // The sheet's other templated row, and the reason the pair is worth pinning together: one term,
    // two constants, and nothing about the passive itself in the arithmetic
    const reading = readAs('Darkvision out to {skills.perception.level * 5} feet.', aSeer());

    expect(reading).toBe('Darkvision out to 25 feet.');
  });

  it('renders a plain-prose effect verbatim — the resistance shape', () => {
    // 24 of the 26 are this, so *not touching them* is as load-bearing as computing the other two
    const effect = 'You take three quarters of all poison damage.';

    expect(readAs(effect, aSeer())).toBe(effect);
  });

  it('re-reads itself when the character changes, because nothing is stored', () => {
    const sharper = { ...aSeer(), investedStatPoints: { 'stat-per': 9 } };

    expect(readAs('out to {skills.perception.level * 10} feet', sharper)).toBe('out to 90 feet');
  });

  it('resolves a bare stat abbreviation, which the scope allows at this attachment point', () => {
    // CR-02's bug in one case: `scoping.ts` puts `PER` in the flat space, so a context without
    // `statVariables` would let this validate and preview and then fail on the sheet
    expect(readAs('resists {PER} points', aSeer())).toBe('resists 5 points');
  });

  it('chips one placeholder and keeps the sentence when it names something gone', () => {
    const reading = readAs('blindsight out to {skills.nonesuch.level} feet', aSeer());

    expect(reading).toBe('blindsight out to ⟨skills.nonesuch.level⟩ feet');
  });
});
