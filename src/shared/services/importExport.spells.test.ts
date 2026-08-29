/**
 * Import/Export — spells
 *
 * The compendium on the wire (v4 systems/13, TICKET-SPL-01), and the sixth per-entity file of the
 * split its own arrival triggered — see `importExport.test.ts`'s header.
 *
 * **What these cases are mostly about is what the gate does *not* refuse.** Three of the five fields
 * accept something that looks like an omission — an absent cost, an empty range, an empty effect —
 * and each of those is a row the source workbook genuinely has. A gate strict enough to feel tidy
 * would refuse the very compendium this entity exists to hold.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; v4 systems/13, TICKET-SPL-01**
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Configuration } from '../types/config';
import {
  importConfiguration,
  serializeConfiguration,
  ValidationError,
  validateConfigurationShape,
} from './importExport';
import { makeValidConfiguration } from './importExport.fixtures';

describe('Import/Export — spells (v4 systems/13, TICKET-SPL-01)', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  /** A plain row of the sheet: priced, ranged, and with effect text */
  const acidSplash = {
    id: 'acid-splash',
    name: 'Acid Splash',
    manaCost: 90,
    rangeTime: '60f',
    effectTemplate: 'lowers the endurance of creatures hit by 3',
  };

  const withSpells = (spells: unknown): Configuration =>
    ({ ...validConfig, spells }) as Configuration;

  it('should accept a file with no spells key — absent means none', () => {
    const noSpells: Record<string, unknown> = { ...validConfig };
    delete noSpells.spells;

    expect(validateConfigurationShape(noSpells).isValid).toBe(true);
    expect('spells' in noSpells).toBe(false);
  });

  it('should leave a ruleset with no spells without one after a round-trip', () => {
    const exported = serializeConfiguration(validConfig);
    const imported = importConfiguration(exported);

    expect(imported).not.toHaveProperty('spells');
  });

  it('should round-trip a spell unchanged', () => {
    const config = withSpells([acidSplash]);

    const exported = serializeConfiguration(config);
    const imported = importConfiguration(exported);

    expect(imported.spells).toEqual([acidSplash]);
  });

  it('should round-trip a spell with an empty effect and an empty range, normalising neither', () => {
    // The two absences the sheet actually has: six of its range cells are blank, and
    // `Summon Lesser Demons`'s effect is a live `#VERW!` error the corpus records as an empty
    // template rather than as invented text. Neither may grow a placeholder on the way through.
    const unstated = { ...acidSplash, id: 'summon', rangeTime: '', effectTemplate: '' };
    const config = withSpells([unstated]);

    const exported = serializeConfiguration(config);
    const imported = importConfiguration(exported);

    expect(imported.spells).toEqual([unstated]);
    expect(imported.spells?.[0].rangeTime).toBe('');
    expect(imported.spells?.[0].effectTemplate).toBe('');
  });

  it('should round-trip a free-text range verbatim, however the ruleset words it', () => {
    // The workbook spells one idea a dozen ways. Every one of these has to survive, because
    // deciding which of them mean the same thing is the User's edit and not the importer's.
    const spellings = ['60f', '60 Feet', '120', 'touch', 'Touch', 'self/focus', 'on hit', '/'];
    const spells = spellings.map((rangeTime, index) => ({
      ...acidSplash,
      id: `spell-${index}`,
      rangeTime,
    }));

    const config = withSpells(spells);
    const imported = importConfiguration(serializeConfiguration(config));

    expect(imported.spells?.map((spell) => spell.rangeTime)).toEqual(spellings);
  });

  it('should round-trip a spell the ruleset does not price, growing no cost', () => {
    // `mighty fortress` in the workbook: its mana and range columns are swapped, so its cost cell
    // holds a distance. Absent is how that is recorded — inventing a number would be worse (v4 D1).
    const { manaCost: _unpriced, ...unpricedSpell } = acidSplash;
    const config = withSpells([{ ...unpricedSpell, id: 'mighty-fortress', rangeTime: '270' }]);

    const imported = importConfiguration(serializeConfiguration(config));

    expect(validateConfigurationShape(config).isValid).toBe(true);
    expect(imported.spells?.[0]).not.toHaveProperty('manaCost');
  });

  it('should keep a mana cost of 0, which a falsy check would erase', () => {
    const free = { ...acidSplash, manaCost: 0 };

    const imported = importConfiguration(serializeConfiguration(withSpells([free])));

    expect(imported.spells?.[0].manaCost).toBe(0);
  });

  it('should round-trip a spell with no description without growing one', () => {
    const config = withSpells([acidSplash]);

    const imported = importConfiguration(serializeConfiguration(config));

    expect(imported.spells?.[0]).not.toHaveProperty('description');
  });

  it('should reject spells that is not an array', () => {
    const result = validateConfigurationShape({ ...validConfig, spells: 'magic' });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('spells');
  });

  it('should reject a spell with no id, which nothing could ever address', () => {
    const { id: _dropped, ...anonymous } = acidSplash;

    const result = validateConfigurationShape(withSpells([anonymous]));

    expect(result.errors).toContain('spells[0].id must be a non-empty string');
  });

  it('should reject a cost that is present and not a finite number', () => {
    // This is the shape a `NaN` written by a number box serialises to, which is why the panel
    // filters on `Number.isFinite` before it stores one
    const nulled = validateConfigurationShape(withSpells([{ ...acidSplash, manaCost: null }]));
    const worded = validateConfigurationShape(withSpells([{ ...acidSplash, manaCost: '90' }]));

    expect(nulled.errors).toContain('spells[0].manaCost must be a finite number when present');
    expect(worded.errors).toContain('spells[0].manaCost must be a finite number when present');
  });

  it('should reject a range or an effect that is not text at all', () => {
    const numbered = withSpells([{ ...acidSplash, rangeTime: 60, effectTemplate: 11 }]);

    const result = validateConfigurationShape(numbered);

    expect(result.errors).toContain('spells[0].rangeTime must be a string');
    expect(result.errors).toContain('spells[0].effectTemplate must be a string');
    expect(() => importConfiguration(JSON.stringify(numbered))).toThrow(ValidationError);
  });

  it('should carry effect text through untouched, since nothing parses it yet', () => {
    // TICKET-SPL-03 turns the numbers in here into formula placeholders (v4 D4). Until it does,
    // a brace or a bracket is prose, and the round trip has to leave it exactly as written.
    const braced = {
      ...acidSplash,
      effectTemplate: 'deals {damage} fire damage in a 55-foot-radius sphere [see p.12]',
    };

    const imported = importConfiguration(serializeConfiguration(withSpells([braced])));

    expect(imported.spells?.[0].effectTemplate).toBe(braced.effectTemplate);
  });

  it('should carry a compendium at the sheet’s own scale through the round trip', () => {
    // 418 rows is what the source workbook holds, and the wire is one of the two places a count
    // like that could quietly become a problem — the panel is the other
    const compendium = Array.from({ length: 418 }, (_, index) => ({
      ...acidSplash,
      id: `spell-${index}`,
      name: `Spell ${index}`,
      manaCost: 60 + (index % 11) * 30,
    }));

    const config = withSpells(compendium);
    const imported = importConfiguration(serializeConfiguration(config));

    expect(validateConfigurationShape(config).isValid).toBe(true);
    expect(imported.spells).toEqual(compendium);
  });
});
