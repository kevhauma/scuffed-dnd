/**
 * Import/Export — item templates
 *
 * The template's shop and skill vector on the wire, plus the fused material pair TICKET-INV-05
 * retired from the entity. Split out of `importExport.test.ts` by TICKET-SPL-01; see that file's
 * header for the split's rule.
 *
 * The retired-pair block travels **here** rather than staying with the configuration-level retired
 * fields, because `EntitySpec.retired` is a property of the `items` collection: the sentence it
 * produces names an item's path, and the fixture it needs is an item.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; v4 systems/11, TICKET-ITEM-01, TICKET-INV-05**
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

describe('Import/Export — item templates (v4 systems/11, TICKET-ITEM-01)', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  /** The ticket's own Battleaxe: a shop, and a vector over the fixture's one skill */
  const battleaxe = {
    id: 'battleaxe',
    name: 'Battleaxe',
    description: '',
    shop: 'Imperial Forge',
    skillBonuses: [{ skillId: 'MEL', modifier: 2 }],
  };

  const withItems = (items: unknown): Configuration => ({ ...validConfig, items }) as Configuration;

  it('should accept a template with neither a shop nor a vector — both are additive', () => {
    // Every template in the corpus, which this ticket leaves untouched (v4 D7)
    const plain = withItems([{ id: 'axe', name: 'Axe', description: '' }]);

    expect(validateConfigurationShape(plain).isValid).toBe(true);
  });

  it('should leave a plain template plain after a round-trip', () => {
    const config = withItems([{ id: 'axe', name: 'Axe', description: '' }]);

    const exported = serializeConfiguration(config);
    const imported = importConfiguration(exported);

    expect(imported.items[0]).not.toHaveProperty('shop');
    expect(imported.items[0]).not.toHaveProperty('skillBonuses');
  });

  it('should round-trip a shop and a vector unchanged', () => {
    const config = withItems([battleaxe]);

    const exported = serializeConfiguration(config);
    const imported = importConfiguration(exported);

    expect(imported.items).toEqual([battleaxe]);
  });

  it('should keep a bonus spelled in skill ids on the wire, not in names', () => {
    // Like a material tier's modifier, the row is already an id, so it crosses the
    // reference-form boundary untranslated and a rename cannot orphan it
    const config = withItems([battleaxe]);

    const exported = serializeConfiguration(config);
    const raw = JSON.parse(exported);

    expect(raw.items[0].skillBonuses).toEqual([{ skillId: 'MEL', modifier: 2 }]);
  });

  it('should keep the vector pointing at the skill after it is renamed', () => {
    const renamed: Configuration = {
      ...withItems([battleaxe]),
      skills: validConfig.skills.map((skill) => ({ ...skill, name: 'Cleaving' })),
    };

    const exported = serializeConfiguration(renamed);
    const imported = importConfiguration(exported);

    expect(imported.items[0].skillBonuses).toEqual([{ skillId: 'MEL', modifier: 2 }]);
  });

  it('should reject a skillBonuses that is not an array', () => {
    const result = validateConfigurationShape(withItems([{ ...battleaxe, skillBonuses: 'lots' }]));

    expect(result.errors).toContain('items[0].skillBonuses must be an array when present');
  });

  it('should reject a bonus that is not { skillId, modifier }', () => {
    const badTarget = withItems([{ ...battleaxe, skillBonuses: [{ skillId: '', modifier: 1 }] }]);
    const badNumber = withItems([
      { ...battleaxe, skillBonuses: [{ skillId: 'MEL', modifier: 'a lot' }] },
    ]);

    expect(validateConfigurationShape(badTarget).errors).toContain(
      'items[0].skillBonuses[0].skillId must be a skill id'
    );
    expect(validateConfigurationShape(badNumber).errors).toContain(
      'items[0].skillBonuses[0].modifier must be a finite number'
    );
  });

  it('should accept a stored zero rather than insisting the vector is sparse', () => {
    // Sparseness is how the editor *writes* one; a zero contributes nothing and a file carrying
    // it plays identically, so refusing it would reject a ruleset for tidiness
    const withZero = withItems([{ ...battleaxe, skillBonuses: [{ skillId: 'MEL', modifier: 0 }] }]);

    expect(validateConfigurationShape(withZero).isValid).toBe(true);
  });

  it('should reject a shop that is not a string', () => {
    const result = validateConfigurationShape(withItems([{ ...battleaxe, shop: 7 }]));

    expect(result.errors).toContain('items[0].shop must be a string when present');
  });

  describe('a field retired from an entity rather than from the configuration (TICKET-INV-05)', () => {
    // The fused `materialId` / `materialLevel` pair. A v4.0 file never reaches this — the version
    // gate refuses anything not on schema 10 first (D6's clean break) — so what these cases pin is
    // the *hand-edited* file that claims the current version while still fusing a tier onto a
    // template: it is told where the pair went rather than importing an item made of nothing.
    const fused = (retired: Record<string, unknown>): Configuration =>
      ({
        ...validConfig,
        items: [{ id: 'axe', name: 'Axe', description: '', ...retired }],
      }) as Configuration;

    it('should reject an item still carrying the fused materialId', () => {
      const stale = fused({ materialId: 'mat-iron' });

      const result = validateConfigurationShape(stale);

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('items[0].materialId');
    });

    it('should reject the tier half on its own too', () => {
      const stale = fused({ materialLevel: 2 });

      const result = validateConfigurationShape(stale);

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('items[0].materialLevel');
    });

    it('should name what replaced the pair, not just refuse it', () => {
      const stale = fused({ materialId: 'mat-iron' });

      const result = validateConfigurationShape(stale);
      const errors = result.errors.join(' ');

      expect(errors).toContain('composed item');
      expect(errors).toContain('TICKET-INV-05');
    });

    it('should reject a retired entity field whatever its value, including zero', () => {
      // `materialLevel: 0` was never meaningful, but a falsy value must not slip past the
      // presence check — the same rule the configuration-level cases pin
      const stale = fused({ materialLevel: 0 });

      const result = validateConfigurationShape(stale);

      expect(result.isValid).toBe(false);
    });

    it('should refuse the import outright rather than dropping the fields', () => {
      // Silently dropping them would import a catalog that plays differently from the one the
      // User exported: every item made of iron would become an item made of nothing
      const stale = fused({ materialId: 'mat-iron' });
      const text = JSON.stringify(stale);

      expect(() => importConfiguration(text)).toThrow(ValidationError);
    });

    it('should accept a template on the current shape, which fuses nothing', () => {
      const current = fused({});

      const result = validateConfigurationShape(current);

      expect(result.isValid).toBe(true);
    });
  });
});
