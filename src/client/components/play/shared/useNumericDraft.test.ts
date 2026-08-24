/**
 * Numeric Draft Tests
 *
 * The half-typed states are the whole reason the hook exists, so they are what is covered here:
 * `""`, `"-"`, and the multi-digit entry whose prefix used to be committed on the way past.
 *
 * **Validates: Concept 20; Requirements 14.2, 14.4**
 */

import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { NumericEntry } from './useNumericDraft';
import { useNumericDraft } from './useNumericDraft';

/** A keyboard event with only the fields the hook reads */
function keyEvent(key: string) {
  return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent<HTMLInputElement>;
}

describe('useNumericDraft', () => {
  describe('holding a draft', () => {
    it('should show the stored value until something is typed', () => {
      const { result } = renderHook(() => useNumericDraft(30, vi.fn()));

      expect(result.current.value).toBe(30);
    });

    it('should show what was typed, character for character', () => {
      const { result } = renderHook(() => useNumericDraft(30, vi.fn()));

      act(() => result.current.handleChange('1'));
      expect(result.current.value).toBe('1');

      act(() => result.current.handleChange('12'));
      expect(result.current.value).toBe('12');
    });

    it('should commit nothing while the Player is still typing', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumericDraft(30, onCommit));

      act(() => result.current.handleChange('1'));
      act(() => result.current.handleChange('12'));

      // The bug this hook was rewritten to fix: `1` used to be a real write on the way to `12`
      expect(onCommit).not.toHaveBeenCalled();
    });

    it('should go back to the stored value once the draft is dropped', () => {
      const { result } = renderHook(() => useNumericDraft(30, vi.fn()));

      act(() => result.current.handleChange('12'));
      act(() => result.current.handleBlur());

      expect(result.current.value).toBe(30);
    });
  });

  describe('committing', () => {
    it('should commit the finished entry on blur', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumericDraft(30, onCommit));

      act(() => result.current.handleChange('12'));
      act(() => result.current.handleBlur());

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith<[NumericEntry]>({ kind: 'absolute', value: 12 });
    });

    it('should commit on Enter, and swallow the key so no surrounding form submits', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumericDraft(30, onCommit));
      const event = keyEvent('Enter');

      act(() => result.current.handleChange('12'));
      act(() => result.current.handleKeyDown(event));

      expect(onCommit).toHaveBeenCalledWith<[NumericEntry]>({ kind: 'absolute', value: 12 });
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should abandon the draft on Escape without committing', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumericDraft(30, onCommit));

      act(() => result.current.handleChange('12'));
      act(() => result.current.handleKeyDown(keyEvent('Escape')));

      expect(onCommit).not.toHaveBeenCalled();
      expect(result.current.value).toBe(30);
    });

    it('should commit nothing when nothing was typed', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumericDraft(30, onCommit));

      act(() => result.current.handleBlur());

      expect(onCommit).not.toHaveBeenCalled();
    });

    it.each(['', '   ', '-', '+', 'lots'])(
      'should treat %o as abandoning the edit rather than as a request for 0',
      (raw) => {
        const onCommit = vi.fn();
        const { result } = renderHook(() => useNumericDraft(30, onCommit));

        act(() => result.current.handleChange(raw));
        act(() => result.current.handleBlur());

        expect(onCommit).not.toHaveBeenCalled();
        expect(result.current.value).toBe(30);
      }
    );

    it('should commit only once per finished entry', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumericDraft(30, onCommit));

      act(() => result.current.handleChange('12'));
      act(() => result.current.handleKeyDown(keyEvent('Enter')));
      act(() => result.current.handleBlur());

      expect(onCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('relative entry (Concept 20)', () => {
    it.each([
      ['-7', -7],
      ['+12', 12],
    ])('should read %s as a delta when relative entry is on', (raw, delta) => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumericDraft(30, onCommit, { allowRelative: true }));

      act(() => result.current.handleChange(raw));
      act(() => result.current.handleBlur());

      expect(onCommit).toHaveBeenCalledWith<[NumericEntry]>({ kind: 'relative', delta });
    });

    it('should still read an unsigned number as an absolute value', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumericDraft(30, onCommit, { allowRelative: true }));

      act(() => result.current.handleChange('12'));
      act(() => result.current.handleBlur());

      expect(onCommit).toHaveBeenCalledWith<[NumericEntry]>({ kind: 'absolute', value: 12 });
    });

    it('should read a signed number as a signed absolute value when relative entry is off', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumericDraft(30, onCommit));

      act(() => result.current.handleChange('-7'));
      act(() => result.current.handleBlur());

      expect(onCommit).toHaveBeenCalledWith<[NumericEntry]>({ kind: 'absolute', value: -7 });
    });
  });
});
