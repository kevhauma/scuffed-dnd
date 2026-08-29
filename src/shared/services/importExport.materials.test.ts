/**
 * Import/Export — materials
 *
 * The tier ladder and its stat modifiers on the wire. Split out of `importExport.test.ts` by
 * TICKET-SPL-01; see that file's header for the split's rule.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; TICKET-MAT-01, CR-03**
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

describe('Import/Export — materials', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  describe('material tiers beyond their bonuses (CR-03)', () => {
    const withMaterial = (material: unknown) =>
      validateConfigurationShape({ ...validConfig, materials: [material] });

    it('rejects a material with no category, which the engine dereferences', () => {
      const result = withMaterial({ id: 'iron', name: 'Iron', description: '', levels: [] });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('materials[0].categoryId must be a material category id');
    });

    it('rejects a tier with no value, which used to crash the engine validator', () => {
      // `level.value.tierId` is read unguarded in `engine/validator.ts`
      const result = withMaterial({
        id: 'iron',
        name: 'Iron',
        description: '',
        categoryId: 'cat1',
        levels: [{ level: 1, name: 'Iron', bonuses: [] }],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'materials[0].levels[0].value must be a { tierId, amount } object'
      );
    });

    it('rejects a tier whose value names no currency tier', () => {
      const result = withMaterial({
        id: 'iron',
        name: 'Iron',
        description: '',
        categoryId: 'cat1',
        levels: [{ level: 1, name: 'Iron', bonuses: [], value: { amount: 10 } }],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'materials[0].levels[0].value.tierId must be a currency tier id'
      );
    });
  });

  describe('material stat modifier round-trip (TICKET-MAT-01)', () => {
    const roundTrip = async (config: Configuration): Promise<Configuration> =>
      importConfiguration(serializeConfiguration(config));

    /** A ruleset whose one material tier modifies a stat */
    const withMaterials = (bonuses: unknown[]): Configuration =>
      ({
        ...validConfig,
        materialCategories: [{ id: 'cat1', name: 'Metals', description: '' }],
        currencyTiers: [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 10 }],
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
                bonuses,
                value: { tierId: 'gold', amount: 10 },
              },
            ],
          },
        ],
      }) as Configuration;

    it('should survive export then import unchanged', async () => {
      const config = withMaterials([{ statId: 'id-str', modifier: 50 }]);

      const imported = await roundTrip(config);

      expect(imported.materials).toEqual(config.materials);
    });

    it('should keep the modifier spelled in stat ids on the wire, not in abbreviations', async () => {
      // Like a race's stat block, a tier modifier is already an id, so it crosses the
      // reference-form boundary untranslated and a rename cannot orphan it
      const config = withMaterials([{ statId: 'id-str', modifier: 50 }]);

      const raw = JSON.parse(serializeConfiguration(config));

      expect(raw.materials[0].levels[0].bonuses).toEqual([{ statId: 'id-str', modifier: 50 }]);
    });

    it('should reject a tier bonus that is not { statId, modifier }', () => {
      const oldShape = JSON.stringify(withMaterials([{ skillCode: 'STR', modifier: 2 }]));
      const badNumber = JSON.stringify(withMaterials([{ statId: 'id-str', modifier: 'a lot' }]));

      expect(() => importConfiguration(oldShape)).toThrow(ValidationError);
      expect(() => importConfiguration(badNumber)).toThrow(ValidationError);
    });
  });
});
