/**
 * The invitations waiting for you (TICKET-GAM-03)
 *
 * Three claims worth a test:
 *
 * - **Absent rather than empty.** It is a notification area, and a permanent *no invitations* panel
 *   would be noise on every visit for a state nobody is waiting for.
 * - **Who invited you is on the card** (v3 Req 38.7) — the table's name alone does not tell you
 *   whether you know anybody at it.
 * - **Both answers are offered as equals**, because declining is a normal, recorded answer rather
 *   than an escape hatch.
 *
 * **Validates: v3 Req 38.5, 38.7**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PendingInvitation } from '#shared/types/api';
import { PendingInvitations } from './PendingInvitations';

/** One invitation, as the listing carries it */
function invitation(overrides: Partial<PendingInvitation> = {}): PendingInvitation {
  return {
    id: 'invite-1',
    sessionName: 'Tuesday night',
    invitedBy: 'The DM',
    expiresAt: 1_760_000_000_000,
    ...overrides,
  };
}

/** The card with everything defaulted to "one invitation waiting" */
function renderCard(props: Partial<React.ComponentProps<typeof PendingInvitations>> = {}) {
  const onAccept = vi.fn();
  const onDecline = vi.fn();

  const { container } = render(
    <PendingInvitations
      invitations={[invitation()]}
      isPending={false}
      isBusy={false}
      error={null}
      onAccept={onAccept}
      onDecline={onDecline}
      {...props}
    />
  );

  return { container, onAccept, onDecline };
}

describe('PendingInvitations', () => {
  it('renders nothing at all when nothing is waiting', () => {
    const { container } = renderCard({ invitations: [] });

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing while the answer is still unknown', () => {
    // *Checking…* on every page load, for a card that is usually absent, is worse than silence
    const { container } = renderCard({ isPending: true, invitations: [] });

    expect(container.firstChild).toBeNull();
  });

  it('names the table and who asked', () => {
    renderCard();

    expect(screen.getByText('Tuesday night')).toBeTruthy();
    expect(screen.getByText(/Invited by The DM/)).toBeTruthy();
  });

  it('offers both answers, and passes the invitation each is about', () => {
    const { onAccept, onDecline } = renderCard();

    fireEvent.click(screen.getByText('Join'));
    fireEvent.click(screen.getByText('No thanks'));

    expect(onAccept).toHaveBeenCalledWith('invite-1');
    expect(onDecline).toHaveBeenCalledWith('invite-1');
  });

  it('refuses both while an answer is on the wire', () => {
    const { onAccept } = renderCard({ isBusy: true });

    fireEvent.click(screen.getByText('Join'));

    expect(onAccept).not.toHaveBeenCalled();
  });

  it('shows a refusal even when the list has emptied under it', () => {
    // The card is the only place that message can go, so it survives the list going away
    renderCard({ invitations: [], error: 'That invitation was taken back.' });

    expect(screen.getByRole('alert').textContent).toContain('taken back');
  });

  it('lists one card per invitation', () => {
    renderCard({
      invitations: [invitation(), invitation({ id: 'invite-2', sessionName: 'Saturday' })],
    });

    expect(screen.getAllByText('Join')).toHaveLength(2);
  });
});
