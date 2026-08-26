/**
 * The code a DM hands out (TICKET-GAM-02)
 *
 * **The one surface in the feature that renders a credential**, which is why it earns a test of its
 * own even though the folder's other panels are covered through their parents. Three claims:
 *
 * - **A stale code says it is stale.** The server deliberately still sends an expired one — a DM
 *   shown nothing would read that as *I never issued one* — so this is the only place the difference
 *   becomes visible, and rendering it as live with a *Copy link* beside it was the GAM-02 review's
 *   finding.
 * - **An archived table cannot be invited into**, said before the click rather than as a 409 after.
 * - **Nothing copyable is on screen when there is no code**, which is the cheap assertion about a
 *   credential surface that is worth having.
 *
 * **Validates: v3 Req 37.5, 38.1, 38.2**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InviteCodePanel } from './InviteCodePanel';

/** A live invitation, a fortnight out */
const LIVE = { code: 'A1B2C-3D4E5', expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000 };

/** One that ran out yesterday */
const EXPIRED = { code: 'Z9Y8X-7W6V5', expiresAt: Date.now() - 24 * 60 * 60 * 1000 };

/** The panel with everything defaulted to "a live code on a running table" */
function renderPanel(props: Partial<React.ComponentProps<typeof InviteCodePanel>> = {}) {
  const handlers = { onIssue: vi.fn(), onRevoke: vi.fn() };

  render(
    <InviteCodePanel
      invite={LIVE}
      canInvite
      isPending={false}
      isBusy={false}
      error={null}
      {...handlers}
      {...props}
    />
  );

  return handlers;
}

describe('InviteCodePanel', () => {
  it('shows the code and the link as text, not only behind a button', () => {
    renderPanel();

    // `navigator.clipboard` needs a secure context and a permission; somebody without one has to be
    // able to read and select both
    expect(screen.getByText('A1B2C-3D4E5')).toBeTruthy();
    expect(screen.getByText(/\/join\/A1B2C-3D4E5$/)).toBeTruthy();
  });

  it('says when a live code runs out', () => {
    renderPanel();

    expect(screen.getByText(/can join as a player, until/)).toBeTruthy();
  });

  it('says an expired code no longer works, with the remedy beside it', () => {
    renderPanel({ invite: EXPIRED });

    expect(screen.getByText(/expired on .* and no longer works/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New code' })).toBeTruthy();
  });

  it('offers nothing copyable when the table has no invitation', () => {
    renderPanel({ invite: null });

    expect(screen.queryByRole('button', { name: 'Copy code' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create an invite code' })).toBeTruthy();
  });

  it('will not offer to make one on an archived table', () => {
    renderPanel({ invite: null, canInvite: false });

    expect(screen.queryByRole('button', { name: 'Create an invite code' })).toBeNull();
    expect(screen.getByText(/nobody new can join it/)).toBeTruthy();
  });

  it('still lets an archived table’s code be taken back', () => {
    // The server allows this deliberately: a DM who archived first must be able to invalidate a
    // link they posted publicly
    renderPanel({ canInvite: false });

    expect(screen.getByRole('button', { name: 'Take it back' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New code' })).toBeNull();
  });

  it('issues and revokes on request', () => {
    const { onIssue, onRevoke } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'New code' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take it back' }));

    expect(onIssue).toHaveBeenCalledTimes(1);
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });

  it('cannot be pressed twice while a write is on the wire', () => {
    const { onIssue, onRevoke } = renderPanel({ isBusy: true });

    fireEvent.click(screen.getByRole('button', { name: 'New code' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take it back' }));

    expect(onIssue).not.toHaveBeenCalled();
    expect(onRevoke).not.toHaveBeenCalled();
  });

  it('announces a refusal so a screen reader hears it', () => {
    renderPanel({ error: 'This game session has been archived.' });

    expect(screen.getByRole('alert').textContent).toContain('archived');
  });

  it('distinguishes "still looking" from "there is none"', () => {
    renderPanel({ invite: null, isPending: true });

    expect(screen.getByText(/Checking this table/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create an invite code' })).toBeNull();
  });
});
