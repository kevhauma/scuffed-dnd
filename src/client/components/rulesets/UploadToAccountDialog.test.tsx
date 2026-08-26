/**
 * The copy-to-my-account question (TICKET-IO-04)
 *
 * **Wording is the feature here**, which is why it is asserted rather than eyeballed. v3 Req 36.5's
 * *an upload copies, it does not move* is a promise the User has to be able to read **before** they
 * agree — a dialog that merely behaved correctly while implying a move would still lose people who
 * cancel, and would mislead the ones who do not.
 *
 * **Validates: v3 Req 36.3, 36.4, 36.5**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BrowserUpload } from '../../services/rulesetUpload';
import { UploadToAccountDialog } from './UploadToAccountDialog';

/** What an upload would carry */
function upload(overrides: Partial<BrowserUpload> = {}): BrowserUpload {
  return {
    name: 'Ducklets',
    characterCount: 2,
    request: { configuration: {}, characters: [] },
    ...overrides,
  };
}

/** The dialog with everything wired to spies */
function renderDialog(props: Partial<React.ComponentProps<typeof UploadToAccountDialog>> = {}) {
  const handlers = {
    onBackup: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  render(
    <UploadToAccountDialog
      upload={upload()}
      isBusy={false}
      failure={null}
      {...handlers}
      {...props}
    />
  );

  return handlers;
}

describe('UploadToAccountDialog', () => {
  it('renders nothing while there is nothing to copy', () => {
    render(
      <UploadToAccountDialog
        upload={null}
        isBusy={false}
        failure={null}
        onBackup={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText(/Copy to my account/)).toBeNull();
  });

  it('names the ruleset and counts what would go with it', () => {
    renderDialog();

    expect(screen.getByText(/Ducklets/)).toBeTruthy();
    expect(screen.getByText(/2 characters built on it/)).toBeTruthy();
  });

  it('says the characters will sit at no table rather than implying they joined one', () => {
    renderDialog();

    expect(screen.getByText(/sit at no table/)).toBeTruthy();
  });

  it('says so plainly when nothing in this browser was built on it', () => {
    renderDialog({ upload: upload({ characterCount: 0 }) });

    expect(screen.getByText(/none will be copied/)).toBeTruthy();
  });

  it('says in words that the browser’s copy stays (v3 Req 36.5)', () => {
    renderDialog();

    expect(screen.getByText(/The copy in this browser stays exactly where it is/)).toBeTruthy();
  });

  it('offers the backup before anything is copied (v3 Req 36.4)', () => {
    const { onBackup, onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Download backup' }));

    expect(onBackup).toHaveBeenCalledTimes(1);
    // Downloading a backup is not agreeing to the copy
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('takes no action without an explicit choice (v3 Req 36.3)', () => {
    const { onConfirm, onCancel } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('copies on the explicit choice', () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Copy to my account' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cannot be confirmed twice while a copy is on the wire', () => {
    const { onConfirm } = renderDialog({ isBusy: true });

    const button = screen.getByRole('button', { name: 'Copying…' });
    fireEvent.click(button);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  describe('a refusal (the IO-04 review)', () => {
    // **The dialog has to carry its own.** It stays open over a refusal, which is right — the
    // decision is still the User's — but it renders over a `fixed inset-0` blurred overlay with the
    // page scroll locked, so a reason rendered *behind* it is a reason nobody can see. The symptom
    // was a button that read "Copying…", flipped back, and did nothing else.
    it('shows the reason inside the dialog rather than on the page behind it', () => {
      renderDialog({
        failure: { message: 'Could not reach the server.', fields: [] },
      });

      const alert = screen.getByRole('alert');

      expect(alert.textContent).toContain('Could not reach the server.');
      // Inside the dialog, not a sibling of it
      expect(screen.getByRole('dialog').contains(alert)).toBe(true);
    });

    it('lists the failing fields the server named, so the refusal is actionable', () => {
      renderDialog({
        failure: {
          message: 'That ruleset is not a shape this server can read, so nothing was saved.',
          fields: ["Field 'stats' must be an array", 'characters[1].experience must be a number'],
        },
      });

      expect(screen.getByText("Field 'stats' must be an array")).toBeTruthy();
      expect(screen.getByText('characters[1].experience must be a number')).toBeTruthy();
    });

    it('leaves the choice on the table — the copy can still be retried or cancelled', () => {
      const { onConfirm } = renderDialog({
        failure: { message: 'Could not reach the server.', fields: [] },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Copy to my account' }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
