/**
 * The session lobby (TICKET-GAM-04)
 *
 * Four claims worth a test:
 *
 * - **What each reader may do to whom** is the server's rule drawn rather than guessed: a player
 *   sees *Leave* on their own row and nothing on anybody else's; a DM sees *Remove* and *Hand over*
 *   on everybody else's and **neither on their own** (v3 Req 39.6).
 * - **Connection says *Unknown***, because until LIVE-01's socket the app cannot tell a player who
 *   closed the tab from one sitting quietly, and *Offline* would be a claim we cannot support.
 * - **Every action confirms first**, and the sentence says that nothing is deleted — *removed* reads
 *   like *deleted* and here it is not (v3 Req 39.3).
 * - **A departed player's characters are still shown**, which is retention made visible rather than
 *   merely implemented.
 *
 * **Validates: v3 Req 39.3, 39.4, 39.5, 39.6, 39.7**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SessionMemberSummary } from '#shared/types/api';
import { MEMBER_ROLE } from '#shared/types/api';
import { SessionLobby } from './SessionLobby';

/** One Member, as the roster carries them */
function member(overrides: Partial<SessionMemberSummary> = {}): SessionMemberSummary {
  return {
    accountId: 'account-dm',
    name: 'The DM',
    role: MEMBER_ROLE.DM,
    joinedAt: 1_760_000_000_000,
    characters: [],
    ...overrides,
  };
}

/** The DM and one player, which is the smallest table with anything to decide */
const ADA = member({
  accountId: 'account-ada',
  name: 'Ada',
  role: MEMBER_ROLE.PLAYER,
  characters: [{ id: 'character-1', name: 'Quackers' }],
});

/** The lobby, read by whoever a case says */
function renderLobby(props: Partial<React.ComponentProps<typeof SessionLobby>> = {}) {
  const onRemove = vi.fn();
  const onTransfer = vi.fn();

  render(
    <SessionLobby
      members={[member(), ADA]}
      departedCharacters={[]}
      accountId="account-dm"
      isDm
      canTransfer
      isPending={false}
      isBusy={false}
      error={null}
      onRemove={onRemove}
      onTransfer={onTransfer}
      {...props}
    />
  );

  return { onRemove, onTransfer };
}

/** Answer the confirmation that is open */
function confirmWith(verb: string) {
  fireEvent.click(screen.getByRole('button', { name: verb }));
}

describe('SessionLobby', () => {
  it('names everybody with their role and what they are playing', () => {
    renderLobby();

    expect(screen.getByText('Runs this game')).toBeTruthy();
    expect(screen.getByText('Player')).toBeTruthy();
    expect(screen.getByText('Quackers')).toBeTruthy();
    // A Member playing nothing says so rather than showing an empty gap
    expect(screen.getByText('No character yet')).toBeTruthy();
  });

  it('marks which row is yours', () => {
    renderLobby();

    expect(screen.getByText(/The DM \(you\)/)).toBeTruthy();
  });

  it('says the connection is unknown rather than claiming offline', () => {
    renderLobby();

    // The app cannot tell until LIVE-03, and saying so is the point
    expect(screen.getAllByText('Connection unknown')).toHaveLength(2);
    expect(screen.queryByText(/offline/i)).toBeNull();
  });

  it('offers a DM nothing on their own row (v3 Req 39.6)', () => {
    renderLobby();

    // Leaving is refused by the server until the game is handed over, so the row does not offer it
    expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull();
    // …and the two it does offer are on the *other* row
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Hand over' })).toHaveLength(1);
  });

  it('offers a player their own seat and nobody else’s', () => {
    renderLobby({ accountId: 'account-ada', isDm: false });

    expect(screen.getByRole('button', { name: 'Leave' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hand over' })).toBeNull();
  });

  it('hides Hand over on an archived table, where the server refuses it', () => {
    renderLobby({ canTransfer: false });

    expect(screen.queryByRole('button', { name: 'Hand over' })).toBeNull();
    // …and removing is still offered, because tidying up a finished game is allowed
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('asks before removing, and says nothing is deleted', () => {
    const { onRemove } = renderLobby();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByText(/Their characters stay at the table/)).toBeTruthy();
    expect(screen.getByText(/Nothing is deleted/)).toBeTruthy();

    confirmWith('Remove them');
    expect(onRemove).toHaveBeenCalledWith('account-ada');
  });

  it('asks before leaving, and lets the answer be no', () => {
    const { onRemove } = renderLobby({ accountId: 'account-ada', isDm: false });

    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onRemove).not.toHaveBeenCalled();
  });

  it('asks before handing the game over, and names who gets it', () => {
    const { onTransfer } = renderLobby();

    fireEvent.click(screen.getByRole('button', { name: 'Hand over' }));

    expect(screen.getByText(/Ada becomes the one who runs it/)).toBeTruthy();

    confirmWith('Hand it over');
    expect(onTransfer).toHaveBeenCalledWith('account-ada');
  });

  it('shows the characters whose player has gone', () => {
    renderLobby({ departedCharacters: [{ id: 'character-9', name: 'Old Quackers' }] });

    expect(screen.getByText('Old Quackers')).toBeTruthy();
    expect(screen.getByText(/nobody can change them/)).toBeTruthy();
  });

  it('says nothing about departed characters when there are none', () => {
    renderLobby();

    expect(screen.queryByText(/nobody can change them/)).toBeNull();
  });

  it('shows a refusal where the reader is looking', () => {
    renderLobby({ error: 'You run this game, so you cannot leave it.' });

    expect(screen.getByRole('alert').textContent).toContain('cannot leave it');
  });

  it('waits rather than showing an empty table', () => {
    renderLobby({ isPending: true, members: [] });

    expect(screen.getByText('Checking who is here…')).toBeTruthy();
  });
});
