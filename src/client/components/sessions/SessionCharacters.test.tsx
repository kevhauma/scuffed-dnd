/**
 * The characters at a table (TICKET-CHAR-04)
 *
 * Three claims worth a test:
 *
 * - **Everybody's, not just yours** (v3 Req 40.4). A game is played out loud, so the list is the
 *   party's — with only *whose is which* marked, because the roster above answers who is here.
 * - **Making one opens this table's rules**, which is the whole of *one wizard, two destinations*
 *   from the surface's side: the button does not create anything, it points the config store at the
 *   Snapshot and sends the Player to the four steps they already know.
 * - **An archived table says so** rather than offering a button the server refuses.
 *
 * **Validates: v3 Req 37.5, 40.4, 40.6**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterDocument } from '#shared/types/api';
import { SessionCharacters } from './SessionCharacters';

/** One character, as the table's listing carries it */
function document(overrides: Partial<CharacterDocument> = {}): CharacterDocument {
  return {
    id: 'character-1',
    sessionId: 'session-1',
    rulesetId: null,
    ownerAccountId: 'account-1',
    name: 'Quackers',
    revision: 1,
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    character: {
      id: 'character-1',
      name: 'Quackers',
      configurationId: 'session-1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    ...overrides,
  };
}

/** The panel with everything defaulted to "one character, and it is yours" */
function renderPanel(props: Partial<React.ComponentProps<typeof SessionCharacters>> = {}) {
  const onCreate = vi.fn();

  render(
    <SessionCharacters
      characters={[document()]}
      accountId="account-1"
      canCreate
      isPending={false}
      isOpening={false}
      error={null}
      onCreate={onCreate}
      {...props}
    />
  );

  return { onCreate };
}

describe('SessionCharacters', () => {
  it('names every character at the table, whoever owns it', () => {
    renderPanel({
      characters: [
        document(),
        document({
          id: 'character-2',
          ownerAccountId: 'account-2',
          character: { ...document().character, id: 'character-2', name: 'Feathers' },
        }),
      ],
    });

    expect(screen.getByText('Quackers')).toBeTruthy();
    expect(screen.getByText('Feathers')).toBeTruthy();
  });

  it('marks which ones are yours, and only those', () => {
    renderPanel({
      characters: [
        document(),
        document({
          id: 'character-2',
          ownerAccountId: 'account-2',
          character: { ...document().character, id: 'character-2', name: 'Feathers' },
        }),
      ],
    });

    expect(screen.getAllByText('Yours')).toHaveLength(1);
  });

  it('says nothing is here rather than showing an empty list', () => {
    renderPanel({ characters: [] });

    expect(screen.getByText(/Nobody has made a character here yet/)).toBeTruthy();
  });

  it('waits rather than claiming the table is empty', () => {
    renderPanel({ characters: [], isPending: true });

    expect(screen.getByText('Checking what is at this table…')).toBeTruthy();
    expect(screen.queryByText(/Nobody has made a character here yet/)).toBeNull();
  });

  it('offers to make one, and asks the caller to open the table’s rules', () => {
    const { onCreate } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Make a character here' }));

    expect(onCreate).toHaveBeenCalled();
  });

  it('cannot be pressed twice while the rules are opening', () => {
    const { onCreate } = renderPanel({ isOpening: true });

    fireEvent.click(screen.getByRole('button', { name: 'Opening the rules…' }));

    expect(onCreate).not.toHaveBeenCalled();
  });

  it('shows an archived table the reason rather than a button', () => {
    renderPanel({ canCreate: false });

    expect(screen.queryByRole('button', { name: 'Make a character here' })).toBeNull();
    expect(screen.getByText(/archived/)).toBeTruthy();
  });

  it('shows a refusal where the reader is looking', () => {
    renderPanel({ error: 'Could not read this table’s characters.' });

    expect(screen.getByRole('alert').textContent).toContain('Could not read');
  });

  it('says a character is built against this table’s copy of the rules', () => {
    renderPanel();

    // The thing a Player has to know before they spend an evening on one (D7)
    expect(screen.getByText(/copy of the rules this game plays by/)).toBeTruthy();
  });
});
