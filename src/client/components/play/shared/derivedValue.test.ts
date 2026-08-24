/**
 * Derived Value Tests
 *
 * The three readings of an engine result, pinned here rather than incidentally through whichever
 * surface renders them — the sheet and the creation wizard both depend on this agreeing.
 *
 * **Validates: Concept 00 §7; Requirements 16.6**
 */

import { describe, expect, it } from 'vitest';
import { formulaError, withSource } from '#shared/engine/formula/errors';
import { toDerivedValue } from './derivedValue';

describe('toDerivedValue', () => {
  it('should pass a number straight through', () => {
    expect(toDerivedValue(12)).toEqual({ value: 12, error: null });
  });

  it('should read a missing entry as 0 rather than as breakage', () => {
    // Absence is a stat the engine produced nothing for — not a stat whose formula failed
    expect(toDerivedValue(undefined)).toEqual({ value: 0, error: null });
  });

  it('should keep 0 distinguishable from an error', () => {
    expect(toDerivedValue(0)).toEqual({ value: 0, error: null });
  });

  it('should describe an error value instead of substituting a number', () => {
    const result = toDerivedValue(formulaError('undefined-variable', 'Undefined variable: MAG'));

    expect(result.value).toBeNull();
    expect(result.error).toContain('Undefined variable: MAG');
  });

  it("should carry an error's provenance into the description", () => {
    // What makes the chip say which entity broke, rather than only what went wrong
    const sourced = withSource(formulaError('undefined-variable', 'Undefined variable: MAG'), {
      kind: 'stat',
      id: 'health',
      name: 'Health',
    });

    expect(toDerivedValue(sourced).error).toContain('Health');
  });
});
