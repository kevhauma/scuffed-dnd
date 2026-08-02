/**
 * Focus Stat Manager Hook Tests
 *
 * The config store is real with storage mocked, so saving really lands in it.
 *
 * **Validates: Requirements 9.1, 21.1-21.5**
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useConfigStore } from '../../../stores/configStore';
import { useFocusStatManager } from './useFocusStatManager';

describe('useFocusStatManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: null, isLoaded: true });
    useConfigStore.getState().initializeConfig('Test Config');
    useConfigStore.getState().setFocusStatBonusLevel(3);
  });

  it('should start from the configured bonus level with no pending changes', () => {
    const { result } = renderHook(() => useFocusStatManager());

    expect(result.current.draftValue).toBe('3');
    expect(result.current.hasChanges).toBe(false);
    expect(result.current.isValid).toBe(true);
    expect(result.current.hasConfiguration).toBe(true);
  });

  it('should mark a change as pending without touching the store', () => {
    const { result } = renderHook(() => useFocusStatManager());

    act(() => result.current.handleChange('7'));

    expect(result.current.draftValue).toBe('7');
    expect(result.current.hasChanges).toBe(true);
    // Nothing is persisted until save — the draft is the Player's, not the ruleset's
    expect(useConfigStore.getState().config?.focusStatBonusLevel).toBe(3);
  });

  it('should save a valid value through the store action', () => {
    const { result } = renderHook(() => useFocusStatManager());

    act(() => result.current.handleChange('7'));
    act(() => result.current.handleSave());

    expect(useConfigStore.getState().config?.focusStatBonusLevel).toBe(7);
    expect(result.current.hasChanges).toBe(false);
  });

  it('should reject a negative or non-numeric draft', () => {
    const { result } = renderHook(() => useFocusStatManager());

    act(() => result.current.handleChange('-2'));
    expect(result.current.isValid).toBe(false);

    act(() => result.current.handleSave());
    expect(useConfigStore.getState().config?.focusStatBonusLevel).toBe(3);

    act(() => result.current.handleChange('abc'));
    expect(result.current.isValid).toBe(false);

    act(() => result.current.handleSave());
    expect(useConfigStore.getState().config?.focusStatBonusLevel).toBe(3);
  });

  it('should restore the stored value on reset', () => {
    const { result } = renderHook(() => useFocusStatManager());

    act(() => result.current.handleChange('99'));
    act(() => result.current.handleReset());

    expect(result.current.draftValue).toBe('3');
    expect(result.current.hasChanges).toBe(false);
  });

  it('should report no configuration when none is loaded', () => {
    useConfigStore.setState({ config: null, isLoaded: true });

    const { result } = renderHook(() => useFocusStatManager());

    expect(result.current.hasConfiguration).toBe(false);
    expect(result.current.draftValue).toBe('0');
  });
});
