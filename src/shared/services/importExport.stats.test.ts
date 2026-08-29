/**
 * Import/Export — stats
 *
 * The stat's own place on the wire. Split out of `importExport.test.ts` by TICKET-SPL-01; see that
 * file's header for what the split's rule is and why it happened when it did.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; TICKET-STAT-04**
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Configuration } from '../types/config';
import {
  importConfiguration,
  serializeConfiguration,
  validateConfigurationShape,
} from './importExport';
import { makeValidConfiguration } from './importExport.fixtures';

describe('Import/Export — stats', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  describe('stat groups (TICKET-STAT-04)', () => {
    it('should round-trip a ruleset that names no groups unchanged', () => {
      const exported = serializeConfiguration(validConfig);
      const imported = importConfiguration(exported);

      expect(imported.stats).toEqual(validConfig.stats);
      // Additive-optional: an ungrouped ruleset gains no key, so it needs no version bump of its own
      for (const stat of imported.stats) {
        expect('group' in stat).toBe(false);
      }
    });

    it('should round-trip the groups a ruleset does name', () => {
      const grouped: Configuration = {
        ...validConfig,
        stats: validConfig.stats.map((stat) => ({ ...stat, group: 'Physical' })),
      };

      const exported = serializeConfiguration(grouped);
      const imported = importConfiguration(exported);

      expect(imported.stats.map((stat) => stat.group)).toEqual([
        'Physical',
        'Physical',
        'Physical',
      ]);
    });

    it('should accept any spelling of a group, because the names are the Users own', () => {
      const odd: Configuration = {
        ...validConfig,
        stats: validConfig.stats.map((stat) => ({ ...stat, group: 'vittals ' })),
      };

      const result = validateConfigurationShape(odd);

      expect(result.isValid).toBe(true);
    });

    it('should reject a group that is not a string at all', () => {
      const [first, ...rest] = validConfig.stats;
      const result = validateConfigurationShape({
        ...validConfig,
        stats: [{ ...first, group: 3 }, ...rest],
      });

      expect(result.errors).toContain('stats[0].group must be a string when present');
    });
  });
});
