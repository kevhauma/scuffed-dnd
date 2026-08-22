/**
 * Entity Dialog Hook Tests
 *
 * The lifecycle nine managers used to keep their own copy of (CR-24). Asserted on the hook rather
 * than through nine panels, the same way `useGuardedDelete` is: one implementation, one test.
 *
 * **Validates: Requirements 21.1-21.5**
 */

import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { useEntityDialog } from './useEntityDialog';

interface Fields {
  name: string;
  weight: number;
}

const EMPTY: Fields = { name: '', weight: 0 };

/** The hook as a manager holds it: a form, and a dialog over it */
function renderDialog() {
  return renderHook(() => {
    const form = useForm<Fields>({ defaultValues: EMPTY });
    return { form, dialog: useEntityDialog(form) };
  });
}

describe('useEntityDialog', () => {
  it('should start closed and editing nothing', () => {
    const { result } = renderDialog();

    expect(result.current.dialog.isOpen).toBe(false);
    expect(result.current.dialog.editingId).toBeNull();
  });

  it('should open on the defaults it is given, editing nothing', () => {
    const { result } = renderDialog();

    act(() => {
      result.current.dialog.openForAdd({ name: 'Fresh', weight: 2 });
    });

    expect(result.current.dialog.isOpen).toBe(true);
    expect(result.current.dialog.editingId).toBeNull();
    expect(result.current.form.getValues()).toEqual({ name: 'Fresh', weight: 2 });
  });

  it('should open on an entity, remembering which one', () => {
    const { result } = renderDialog();

    act(() => {
      result.current.dialog.openForEdit('stat-1', { name: 'Strength', weight: 5 });
    });

    expect(result.current.dialog.isOpen).toBe(true);
    expect(result.current.dialog.editingId).toBe('stat-1');
    expect(result.current.form.getValues()).toEqual({ name: 'Strength', weight: 5 });
  });

  it('should clear an edited entity out of the form when the next add opens', () => {
    // The half that is easy to forget, and the reason the reset lives in the hook
    const { result } = renderDialog();

    act(() => {
      result.current.dialog.openForEdit('stat-1', { name: 'Strength', weight: 5 });
    });
    act(() => {
      result.current.dialog.close();
    });
    act(() => {
      result.current.dialog.openForAdd(EMPTY);
    });

    expect(result.current.dialog.editingId).toBeNull();
    expect(result.current.form.getValues()).toEqual(EMPTY);
  });

  it('should leave the form alone when it closes', () => {
    // Closing is not cancelling: a save reads the values and then closes, in that order
    const { result } = renderDialog();

    act(() => {
      result.current.dialog.openForEdit('stat-1', { name: 'Strength', weight: 5 });
    });
    act(() => {
      result.current.dialog.close();
    });

    expect(result.current.dialog.isOpen).toBe(false);
    expect(result.current.form.getValues()).toEqual({ name: 'Strength', weight: 5 });
  });
});
