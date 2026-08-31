/**
 * Formula Template Tests (TICKET-SPL-03)
 *
 * Four things this file is about:
 *
 * 1. **The grammar**, exhaustively — where a placeholder starts and stops, and the three states
 *    that are prose rather than syntax (an unclosed brace, an empty pair, a template with none).
 * 2. **The four confirmed sample shapes** the ticket names, read out of the xlsx's own formulas
 *    (v4 systems/13): a flat computed number, two numbers in one sentence, a final-stat read, and
 *    a skill-bonus-plus-level read. Their *real* texts pin when the data pass transcribes them;
 *    what is pinned here is that each shape resolves.
 * 3. **Errors are values.** A placeholder naming a deleted stat chips inside otherwise intact
 *    text — the sentence survives, one number does not.
 * 4. **The splitter contains no arithmetic.** Every operator-bearing placeholder is computed by
 *    the engine, which is checkable rather than merely intended: the numbers below could not come
 *    out right from anything that did not parse them properly.
 *
 * **Validates: v4 systems/13 gap 4; v4 D4; Concept 00 §5, §7**
 */

import { describe, expect, it } from 'vitest';
import type { Configuration } from '../../types/config';
import type { FormulaContext, FormulaResult } from '../../types/formula';
import { calculateSkills } from '../calculators/skillCalculator';
import { statVariables } from '../calculators/statCalculator';
import { isFormulaError } from './errors';
import { namespacesFor } from './namespaces';
import { FORMULA_OWNER } from './scoping';
import { mapTemplateFormulas, parseTemplate, resolveTemplate, templateFormulas } from './template';

/** A ruleset with two stats, two skills and a constant — enough for every reference kind */
const RULES = {
  id: 'config-1',
  name: 'Test',
  version: '1.0',
  schemaVersion: 10,
  stats: [
    {
      id: 'stat-wis',
      name: 'Wisdom',
      abbreviation: 'WIS',
      description: '',
      order: 0,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
    },
    {
      id: 'stat-int',
      name: 'Intellect',
      abbreviation: 'INT',
      description: '',
      order: 1,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
    },
  ],
  skills: [
    {
      id: 'skill-healing',
      name: 'Healing',
      description: '',
      statWeights: [{ statId: 'stat-wis', weight: 1 }],
    },
    {
      id: 'skill-fire',
      name: 'Fire',
      description: '',
      statWeights: [{ statId: 'stat-int', weight: 1 }],
    },
  ],
  materials: [],
  materialCategories: [],
  items: [],
  equipmentSlots: [],
  races: [],
  currencyTiers: [],
  constants: [
    {
      id: 'const-radius',
      name: 'blast_radius',
      displayName: 'Blast radius',
      description: '',
      value: 5,
    },
    {
      id: 'const-div',
      name: 'bonus_divider',
      displayName: 'Bonus divider',
      description: '',
      value: 5,
    },
  ],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
} as unknown as Configuration;

/**
 * The context a caster's Spellbook evaluates against — Wisdom 11, Intellect 20
 *
 * Built the way `useSpellbook` builds it, through `namespacesFor` at the **`spell-effect`** owner,
 * so what these cases prove is what a Player actually reads rather than what a hand-made resolver
 * would give.
 */
function casterContext(): FormulaContext {
  const statValues: Record<string, FormulaResult> = { 'stat-wis': 11, 'stat-int': 20 };
  const { levels, bonuses } = calculateSkills(RULES, statValues, { investedSkillPoints: {} }, {});

  const namespaces = namespacesFor(
    { ...RULES, statValues, skillLevels: levels, skillBonuses: bonuses },
    FORMULA_OWNER.SPELL_EFFECT
  );

  // The bare space too, because `scoping.ts` puts stat abbreviations in scope here — a code the
  // scope allows and the context cannot resolve is CR-02's bug in miniature
  return { variables: statVariables(RULES.stats, statValues), namespaces };
}

/** The resolved template as a plain sentence, with an unresolvable placeholder written `<error>` */
function readAs(template: string): string {
  const segments = resolveTemplate(template, casterContext());

  return segments
    .map((segment) => {
      if (segment.kind === 'text') return segment.text;

      return isFormulaError(segment.result) ? '<error>' : String(segment.result);
    })
    .join('');
}

describe('the template grammar', () => {
  it('splits prose from placeholders', () => {
    expect(parseTemplate('takes {stats.wisdom} damage')).toEqual([
      { kind: 'text', text: 'takes ' },
      { kind: 'formula', source: 'stats.wisdom' },
      { kind: 'text', text: ' damage' },
    ]);
  });

  it('trims the source so the braces can be written loosely', () => {
    expect(templateFormulas('{ stats.wisdom  }')).toEqual(['stats.wisdom']);
  });

  it('reads a template with no placeholders as one piece of text', () => {
    // 92 of the workbook's 418 effects are exactly this, and they must pass through untouched
    const plain = 'The target falls prone.';

    expect(parseTemplate(plain)).toEqual([{ kind: 'text', text: plain }]);
  });

  it('reads an unclosed brace as text rather than as a broken template', () => {
    const half = 'a bowl { of soup';

    expect(parseTemplate(half)).toEqual([{ kind: 'text', text: half }]);
    expect(templateFormulas(half)).toEqual([]);
  });

  it('reads an empty placeholder as text, deleting nothing the sheet wrote', () => {
    // The braces stay in the sentence: prose is byte-for-byte, and *there is nothing to evaluate*
    // is not the same claim as *these two characters were never there*
    expect(templateFormulas('nothing {} here')).toEqual([]);
    expect(readAs('nothing {} here')).toBe('nothing {} here');
  });

  it('does not nest — the first close wins, and the leftover is prose', () => {
    expect(parseTemplate('{stats.wisdom} }')).toEqual([
      { kind: 'formula', source: 'stats.wisdom' },
      { kind: 'text', text: ' }' },
    ]);
  });

  it('keeps every placeholder in order, duplicates included', () => {
    // A caller counting holders dedupes for its own reasons; the splitter reports what is there
    expect(templateFormulas('{WIS} and {WIS} and {INT}')).toEqual(['WIS', 'WIS', 'INT']);
  });

  it('rewrites placeholders and leaves the prose byte-identical', () => {
    // `references.ts`' way in: the display↔stored translation goes through this and must not touch
    // a word of the sentence. `centered` is the Fireball seam — prose that looks like nothing.
    const template = 'a {WIS}-foot sphere, centered on  a point, takes {INT} damage';
    const shouted = mapTemplateFormulas(template, (source) => `${source}_X`);

    expect(shouted).toBe('a {WIS_X}-foot sphere, centered on  a point, takes {INT_X} damage');
  });

  it('rewrites nothing in a template that has no placeholders', () => {
    const plain = 'The target falls prone.';

    expect(mapTemplateFormulas(plain, () => 'never')).toBe(plain);
  });
});

describe('the four confirmed sample shapes (v4 systems/13)', () => {
  // Wisdom 11 → Healing level 11, bonus ceil(11/5) = 3. Intellect 20 → Fire level 20, bonus 4.
  it('resolves a flat computed number — cure wounds', () => {
    expect(readAs('regains hit points equal to {skills.healing.level}')).toBe(
      'regains hit points equal to 11'
    );
  });

  it('resolves two numbers in one sentence — Fireball', () => {
    expect(
      readAs('a {stats.intellect}-foot-radius sphere takes {skills.fire.bonus} fire damage')
    ).toBe('a 20-foot-radius sphere takes 4 fire damage');
  });

  it('resolves a final-stat read — Acid Splash', () => {
    expect(readAs('lowers the endurance of creatures hit by {stats.wisdom}')).toBe(
      'lowers the endurance of creatures hit by 11'
    );
  });

  it('resolves a skill bonus plus a skill level — Aid', () => {
    // `Calcu!M30+1` and `Calcu!F20` in the sheet: the `+1` is arithmetic the *engine* does
    expect(
      readAs(
        'Choose up to {skills.fire.bonus + 1} creatures, each gains {skills.healing.level} hit points'
      )
    ).toBe('Choose up to 5 creatures, each gains 11 hit points');
  });
});

describe('what a placeholder may reference at the spell-effect attachment point', () => {
  it('reads a stat by its bare abbreviation, as the sheet spells a cell', () => {
    expect(readAs('{WIS} damage')).toBe('11 damage');
  });

  it('reads a stat by its dotted name', () => {
    expect(readAs('{stats.wisdom} damage')).toBe('11 damage');
  });

  it('reads a skill level and a skill bonus', () => {
    expect(readAs('{skills.fire.level} / {skills.fire.bonus}')).toBe('20 / 4');
  });

  it('reads a constant', () => {
    expect(readAs('a {const.blast_radius}-foot burst')).toBe('a 5-foot burst');
  });
});

describe('arithmetic is the engine’s, never the splitter’s', () => {
  // Each of these would come out wrong from anything that did not really parse: precedence,
  // unary minus, a function call and a power are all things a string-substituting "splitter" gets
  // silently wrong, which is exactly the failure CLAUDE.md's formula rule exists against
  it.each([
    ['{2 + 3 * 4}', '14'],
    ['{(2 + 3) * 4}', '20'],
    ['{-WIS + 1}', '-10'],
    ['{WIS ^ 2}', '121'],
    // Lower-case, which is the engine's own spelling rather than this ticket's choice — the
    // function table is keyed that way, and `ROUND(…)` comes back *Unknown function*. Worth
    // knowing before transcribing 326 rows out of a sheet that shouts its function names.
    ['{round(WIS / 2)}', '6'],
    ['{max(WIS, INT)}', '20'],
  ])('computes %s as %s', (template, expected) => {
    expect(readAs(template)).toBe(expected);
  });

  it('computes each placeholder independently — no expression spans the prose between them', () => {
    // A splitter that joined the sources would read `1 + 2` here and answer 3 twice
    expect(readAs('{1} plus {2}')).toBe('1 plus 2');
  });
});

describe('an unresolvable placeholder', () => {
  it('is an error value inside otherwise intact text', () => {
    const segments = resolveTemplate('the {stats.nonesuch} of it', casterContext());

    expect(segments).toHaveLength(3);
    expect(segments[0]).toEqual({ kind: 'text', text: 'the ' });
    expect(segments[2]).toEqual({ kind: 'text', text: ' of it' });

    const placeholder = segments[1];
    expect(placeholder.kind).toBe('formula');
    expect(isFormulaError((placeholder as { result: FormulaResult }).result)).toBe(true);
  });

  it('costs the reader that number and not the sentence', () => {
    expect(readAs('deals {stats.gone} damage in a {const.blast_radius}-foot burst')).toBe(
      'deals <error> damage in a 5-foot burst'
    );
  });

  it('reports a placeholder that is not a formula at all as an error rather than throwing', () => {
    // `evaluateFormulaString` turns a parse failure into a `syntax` error value, which is what lets
    // a half-typed template render while the User is still typing it
    expect(readAs('{( + }')).toBe('<error>');
  });
});
