/**
 * What somebody following an invite link is shown (TICKET-GAM-02)
 *
 * **Wording is the feature**, the way it was for IO-04's copy dialog. Two of these matter more than
 * the rest: an archived game has to read as *this ended* rather than as a failure, and being already
 * at the table has to read as a welcome. Both are situations where the technically-correct terse
 * answer is the socially wrong one.
 *
 * **Validates: v3 Req 38.1, 38.4, 38.7**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MEMBER_ROLE, SESSION_STATUS } from '#shared/types/api';
import { JoinSessionPanel } from './JoinSessionPanel';
import { JOIN_OUTCOME } from './useJoinSession';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

/** The panel with everything defaulted to "the preview has landed and nothing has happened" */
function renderPanel(props: Partial<React.ComponentProps<typeof JoinSessionPanel>> = {}) {
  const onJoin = vi.fn();

  render(
    <JoinSessionPanel
      preview={{ sessionName: 'Tuesday night', isJoinable: true }}
      isPending={false}
      isBusy={false}
      error={null}
      outcome={null}
      session={null}
      onJoin={onJoin}
      {...props}
    />
  );

  return { onJoin };
}

/** A session summary, for the two outcome cases */
const SESSION = {
  id: 'session-1',
  rulesetId: 'ruleset-1',
  name: 'Tuesday night',
  // The constants rather than the literals — which also removes the `as const` the literals needed
  status: SESSION_STATUS.ACTIVE,
  role: MEMBER_ROLE.PLAYER,
  snapshotTakenAt: 1,
  createdAt: 1,
  updatedAt: 1,
};

describe('JoinSessionPanel', () => {
  it('names the table before anything happens', () => {
    renderPanel();

    expect(screen.getByText(/Tuesday night/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Join this game' })).toBeTruthy();
  });

  it('says the role somebody will get, so it is not a surprise', () => {
    renderPanel();

    expect(screen.getByText(/join as a\s+player/)).toBeTruthy();
  });

  it('joins only on the explicit action', () => {
    const { onJoin } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Join this game' }));

    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('cannot be pressed twice while a join is on the wire', () => {
    const { onJoin } = renderPanel({ isBusy: true });

    fireEvent.click(screen.getByRole('button', { name: 'Joining…' }));

    expect(onJoin).not.toHaveBeenCalled();
  });

  it('shows nothing to press while the preview is in flight', () => {
    renderPanel({ preview: null, isPending: true });

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/Checking that invitation/)).toBeTruthy();
  });

  it('announces a refusal so a screen reader hears it, in the server’s words', () => {
    renderPanel({
      preview: null,
      error: 'That invitation has expired. Ask whoever runs the game for a new code.',
    });

    expect(screen.getByRole('alert').textContent).toContain('has expired');
    // Nothing to press: the code is not going to start working
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('describes an archived game rather than refusing to name it', () => {
    renderPanel({ preview: { sessionName: 'Last summer', isJoinable: false } });

    expect(screen.getByText(/Last summer/)).toBeTruthy();
    expect(screen.getByText(/archived/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Join this game' })).toBeNull();
  });

  it('welcomes somebody who has just joined', () => {
    renderPanel({ outcome: JOIN_OUTCOME.JOINED, session: SESSION });

    expect(screen.getByText(/You have joined “Tuesday night”/)).toBeTruthy();
  });

  it('treats already being at the table as a welcome, not an error (v3 Req 38.7)', () => {
    renderPanel({ outcome: JOIN_OUTCOME.ALREADY, session: SESSION });

    expect(screen.getByText(/already at “Tuesday night” — nothing changed/)).toBeTruthy();
    // Emphatically not an alert: somebody clicked their own paste, and telling them off for it is
    // exactly the wrong answer
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
