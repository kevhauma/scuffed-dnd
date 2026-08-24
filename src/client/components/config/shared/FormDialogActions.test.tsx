/**
 * Form Dialog Actions Tests
 *
 * The row thirteen dialogs used to carry verbatim (CR-23). What matters about it is the pair of
 * button *types*: Cancel must not submit the form it sits in, and the save must.
 *
 * **Validates: Requirements 21.1-21.5**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormDialogActions } from './FormDialogActions';

describe('FormDialogActions', () => {
  it('should label the submit button with what the dialog saves', () => {
    render(<FormDialogActions submitLabel="Update Stat" onCancel={() => {}} />);

    expect(screen.getByRole('button', { name: 'Update Stat' })).toHaveProperty('type', 'submit');
  });

  it('should cancel without submitting the form it sits in', () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <FormDialogActions submitLabel="Add Tier" onCancel={onCancel} />
      </form>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    // `type="button"`, so a Cancel inside a form is a Cancel rather than a save
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should submit the form it sits in', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <FormDialogActions submitLabel="Add Tier" onCancel={() => {}} />
      </form>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Tier' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
