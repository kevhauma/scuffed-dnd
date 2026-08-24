/**
 * Guarded Delete Hook Tests
 *
 * **Validates: Concept 00 §6; Requirements 2.5, 2.6**
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EntityReference } from '#shared/engine/dependencies';
import { useGuardedDelete } from './useGuardedDelete';

const reference: EntityReference = {
  holderKind: 'Stat',
  holderName: 'Health',
  field: 'formula',
  holderId: 'id-hp',
};

describe('useGuardedDelete', () => {
  it('holds nothing when the delete went through', () => {
    const action = vi.fn(() => []);
    const { result } = renderHook(() => useGuardedDelete());

    act(() => result.current.attemptDelete('Main skill STR', action));

    expect(action).toHaveBeenCalledWith();
    expect(result.current.blocked).toBeNull();
  });

  it('keeps the refusal and what the User was trying to delete', () => {
    const { result } = renderHook(() => useGuardedDelete());

    act(() => result.current.attemptDelete('Main skill STR', () => [reference]));

    expect(result.current.blocked?.label).toBe('Main skill STR');
    expect(result.current.blocked?.references).toEqual([reference]);
  });

  it('re-runs the same action with force, then clears the refusal', () => {
    const action = vi.fn((options?: { force?: boolean }) => (options?.force ? [] : [reference]));
    const { result } = renderHook(() => useGuardedDelete());

    act(() => result.current.attemptDelete('Main skill STR', action));
    act(() => result.current.blocked?.force());

    expect(action).toHaveBeenLastCalledWith({ force: true });
    expect(action).toHaveBeenCalledTimes(2);
    expect(result.current.blocked).toBeNull();
  });

  it('clears the refusal when the User backs out', () => {
    const { result } = renderHook(() => useGuardedDelete());

    act(() => result.current.attemptDelete('Main skill STR', () => [reference]));
    act(() => result.current.dismissBlocked());

    expect(result.current.blocked).toBeNull();
  });
});
