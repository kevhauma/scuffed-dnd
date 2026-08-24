/**
 * Incompatible Data Notice Tests
 *
 * **Validates: v2.0 decision "Clean break on persisted data" (TICKET-IO-03)**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IncompatibleDataNotice } from './IncompatibleDataNotice';

const message = 'This browser holds a ruleset saved by an older version of the app.';

describe('IncompatibleDataNotice', () => {
  it('should say what was found and offer both ways out', () => {
    render(<IncompatibleDataNotice message={message} onBackup={vi.fn()} onStartFresh={vi.fn()} />);

    expect(screen.getByText('Saved Data Cannot Be Opened')).toBeDefined();
    expect(screen.getByText(message)).toBeDefined();
    expect(screen.getByRole('button', { name: /download backup/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /start fresh/i })).toBeDefined();
  });

  it('should download the backup without any confirmation', () => {
    const onBackup = vi.fn();
    render(<IncompatibleDataNotice message={message} onBackup={onBackup} onStartFresh={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /download backup/i }));

    // Keeping a copy is never the destructive choice
    expect(onBackup).toHaveBeenCalledTimes(1);
  });

  it('should not delete anything until the User confirms', () => {
    const onStartFresh = vi.fn();
    render(
      <IncompatibleDataNotice message={message} onBackup={vi.fn()} onStartFresh={onStartFresh} />
    );

    fireEvent.click(screen.getByRole('button', { name: /^start fresh$/i }));

    // The first click only asks
    expect(onStartFresh).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be undone/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /yes, delete it/i }));

    expect(onStartFresh).toHaveBeenCalledTimes(1);
  });

  it('should let the User back out of the confirmation', () => {
    const onStartFresh = vi.fn();
    render(
      <IncompatibleDataNotice message={message} onBackup={vi.fn()} onStartFresh={onStartFresh} />
    );

    fireEvent.click(screen.getByRole('button', { name: /^start fresh$/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onStartFresh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /download backup/i })).toBeDefined();
  });

  it('should accept layout classes from its caller', () => {
    const { container } = render(
      <IncompatibleDataNotice
        message={message}
        onBackup={vi.fn()}
        onStartFresh={vi.fn()}
        className="mt-8"
      />
    );

    expect(container.firstElementChild?.className).toContain('mt-8');
  });
});
