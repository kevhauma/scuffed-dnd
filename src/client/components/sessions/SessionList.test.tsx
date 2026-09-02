/**
 * The tables, one row each (TICKET-GAM-02)
 *
 * **The row's badge is the assertion worth making.** v3 Req 36.8's discipline applied one aggregate
 * over: a row has to say what you are at that table at all times, because whether you can invite
 * anybody follows from it — and a surface that left it to be inferred would leave a player hunting
 * for a button that is not theirs.
 *
 * The other half is that **the invitation is only ever behind a DM's row**, which is the client
 * mirroring a rule the server already enforces rather than being trusted to.
 *
 * **Validates: v3 Req 37.1, 38.1**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameSessionSummary, MemberRole } from '#shared/types/api';
import { MEMBER_ROLE, SESSION_STATUS } from '#shared/types/api';
import { useLiveRoom } from '../live/useLiveRoom';
import { adjustmentVocabularyFrom } from '../play/dm/adjustmentVocabulary';
import type { SessionRosterState } from './roster/useSessionRoster';
import { SessionList } from './SessionList';
import type { SessionInvitationsState } from './useSessionInvitations';
import type { SessionInviteState } from './useSessionInvite';

// The roster subscribes to the table's feed; what this file is about is which panels a row shows
vi.mock('../live/useLiveRoom');
vi.mocked(useLiveRoom).mockReturnValue(null);

/** One table, as the listing carries it */
function session(overrides: Partial<GameSessionSummary> = {}): GameSessionSummary {
  return {
    id: 'session-1',
    rulesetId: 'ruleset-1',
    name: 'Tuesday night',
    status: SESSION_STATUS.ACTIVE,
    role: MEMBER_ROLE.DM,
    snapshotTakenAt: 1_760_000_000_000,
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    ...overrides,
  };
}

/** A live invitation, a fortnight out */
const LIVE_INVITE = { code: 'A1B2C-3D4E5', expiresAt: Date.now() + 1_000_000 };

/** The invite hook's state, inert unless a case says otherwise */
function invite(overrides: Partial<SessionInviteState> = {}): SessionInviteState {
  return {
    invite: LIVE_INVITE,
    isPending: false,
    isBusy: false,
    error: null,
    issue: vi.fn(),
    revoke: vi.fn(),
    ...overrides,
  };
}

/** The addressed-invitations hook's state, inert unless a case says otherwise (TICKET-GAM-03) */
function invitations(overrides: Partial<SessionInvitationsState> = {}): SessionInvitationsState {
  return {
    invites: [],
    isPending: false,
    isBusy: false,
    error: null,
    send: vi.fn(async () => true),
    revoke: vi.fn(),
    ...overrides,
  };
}

/** The roster hook's state, inert unless a case says otherwise (TICKET-DM-04) */
function roster(
  overrides: Partial<Omit<SessionRosterState, 'remove' | 'transfer'>> = {}
): Omit<SessionRosterState, 'remove' | 'transfer'> {
  const words = adjustmentVocabularyFrom(null, []);

  return {
    groups: [],
    accountId: 'account-1',
    isDm: true,
    words,
    rolls: [],
    areRollsPending: false,
    isPending: false,
    isBusy: false,
    error: null,
    isOpeningRules: false,
    makeCharacterHere: vi.fn(),
    openCharacter: vi.fn(),
    actsAsDm: () => false,
    adjustments: () => [],
    ...overrides,
  };
}

/** The list with everything defaulted to "one table you run" */
function renderList(props: Partial<React.ComponentProps<typeof SessionList>> = {}) {
  const onToggle = vi.fn();

  render(
    <SessionList
      sessions={[session()]}
      isPending={false}
      openSessionId={null}
      onToggle={onToggle}
      invite={invite()}
      invitations={invitations()}
      roster={roster()}
      onRemoveMember={vi.fn()}
      onTransferDm={vi.fn()}
      {...props}
    />
  );

  return { onToggle };
}

describe('SessionList', () => {
  it.each([
    [MEMBER_ROLE.DM, 'You run this'],
    [MEMBER_ROLE.PLAYER, 'You play here'],
  ])('says what you are at a table you are %s of', (role, label) => {
    renderList({ sessions: [session({ role: role as MemberRole })] });

    expect(screen.getByText(label)).toBeTruthy();
  });

  it('marks an archived table without dressing it as a fault', () => {
    renderList({ sessions: [session({ status: SESSION_STATUS.ARCHIVED })] });

    expect(screen.getByText('Archived')).toBeTruthy();
    // A state, not an error — nothing announces it
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lets a player open their row too, since TICKET-GAM-04', () => {
    // It used to be the DM's alone, because the only thing behind a row was the invitation. The
    // roster is everybody's: a table is other people, and a player who could not see who else was
    // at theirs would be playing alone with extra steps (v3 Req 39.7).
    renderList({ sessions: [session({ role: MEMBER_ROLE.PLAYER })] });

    expect(screen.getByRole('button', { name: 'Who is here' })).toBeTruthy();
  });

  it('opens the row on request', () => {
    const { onToggle } = renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Who is here' }));

    expect(onToggle).toHaveBeenCalledWith('session-1');
  });

  it('shows the code only while the row is open', () => {
    renderList({ openSessionId: 'session-1' });

    expect(screen.getByText('A1B2C-3D4E5')).toBeTruthy();
  });

  it('keeps the code hidden while the row is closed', () => {
    renderList({ openSessionId: null });

    expect(screen.queryByText('A1B2C-3D4E5')).toBeNull();
  });

  it('never shows a code on a player’s row, whatever the hook holds', () => {
    // The server omits `invite` for a player, so the hook would hold `null` — and since GAM-04 a
    // player's row **does** expand, onto the roster. What keeps the code off it is the `isDm` gate
    // around both invitation panels, which is the client mirroring the server's rule rather than
    // relying on it. This case hands the hook a live code to prove the gate is what does the work.
    renderList({
      sessions: [session({ role: MEMBER_ROLE.PLAYER })],
      openSessionId: 'session-1',
      roster: roster({ isDm: false }),
    });

    expect(screen.queryByText('A1B2C-3D4E5')).toBeNull();
    // …and the roster really did render, so this is not passing by showing nothing at all
    expect(screen.getByText('Who is at this table')).toBeTruthy();
  });

  it('puts the table’s roll log under the roster, for every Member (TICKET-DM-04)', () => {
    // The table-wide log DM-05 and LIVE-02 both recorded against this ticket. Not the DM's alone:
    // the server has always answered `GET /api/sessions/:id/rolls` to every Member, because a game
    // is played out loud.
    renderList({
      sessions: [session({ role: MEMBER_ROLE.PLAYER })],
      openSessionId: 'session-1',
      roster: roster({ isDm: false }),
    });

    const log = screen.getByText('Rolls at this table');

    expect(log).toBeTruthy();
  });

  it('says nothing is here rather than showing an empty list', () => {
    renderList({ sessions: [] });

    expect(screen.getByText(/not in any games yet/)).toBeTruthy();
  });

  it('offers no way to invite into an archived table (the GAM-02 review)', () => {
    // The server refuses `issueInvite` on one, so a button here would always 409 — and the DM
    // could not have predicted it from anything on screen
    renderList({
      sessions: [session({ status: SESSION_STATUS.ARCHIVED })],
      openSessionId: 'session-1',
      invite: invite({ invite: null }),
    });

    expect(screen.queryByRole('button', { name: 'Create an invite code' })).toBeNull();
    expect(screen.getByText(/nobody new can join it/)).toBeTruthy();
  });

  it('still lets a DM take a code back on an archived table', () => {
    // Deliberately allowed by the server: a DM who archived first must still be able to invalidate
    // a link they posted publicly
    renderList({
      sessions: [session({ status: SESSION_STATUS.ARCHIVED })],
      openSessionId: 'session-1',
    });

    expect(screen.getByRole('button', { name: 'Take it back' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New code' })).toBeNull();
  });

  it('distinguishes "still looking" from "none"', () => {
    renderList({ isPending: true, sessions: [] });

    expect(screen.getByText(/Checking your games/)).toBeTruthy();
    expect(screen.queryByText(/not in any games yet/)).toBeNull();
  });
});
