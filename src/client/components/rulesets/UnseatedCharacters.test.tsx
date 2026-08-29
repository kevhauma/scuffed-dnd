/**
 * The characters at no table (TICKET-CHAR-04)
 *
 * **The criterion is worded in User terms, so this is what proves it.** v3 Req 40.7 asks that an
 * uploaded character not be *silently invisible*; a route that lists one satisfies half of that, and
 * the other half is a surface that renders it and says what it is. The review found this ticket had
 * shipped the first half only.
 *
 * Three claims:
 *
 * - **Absent, not empty**, when this Account has uploaded nothing — which is most Accounts, forever.
 * - **It says they are at no table**, in words, rather than leaving the reader to wonder why these
 *   are not in a game.
 * - **Deleting one is offered and reported**, which is criterion 8's User-facing half.
 *
 * **Validates: v3 Req 36.5, 40.7, 40.8**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterDocument } from '#shared/types/api';
import { UnseatedCharacters } from './UnseatedCharacters';

/** One uploaded character, as the listing carries it */
function uploaded(overrides: Partial<CharacterDocument> = {}): CharacterDocument {
  return {
    id: 'character-1',
    // The pair that says what it is: at no table, built against a ruleset
    sessionId: null,
    rulesetId: 'ruleset-1',
    ownerAccountId: 'account-1',
    name: 'Quackers',
    revision: 1,
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    character: {
      id: 'character-1',
      name: 'Quackers',
      configurationId: 'ruleset-1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: { equippedItems: {}, composedItems: [] },
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    ...overrides,
  };
}

/** The panel with everything defaulted to "one uploaded character" */
function renderPanel(props: Partial<React.ComponentProps<typeof UnseatedCharacters>> = {}) {
  const onRemove = vi.fn();

  const { container } = render(
    <UnseatedCharacters
      characters={[uploaded()]}
      isBusy={false}
      error={null}
      onRemove={onRemove}
      {...props}
    />
  );

  return { container, onRemove };
}

describe('UnseatedCharacters', () => {
  it('renders nothing at all when this Account has uploaded none', () => {
    // Most Accounts are in this state forever; a permanent "no characters" panel is noise
    const { container } = renderPanel({ characters: [] });

    expect(container.firstChild).toBeNull();
  });

  it('names each one', () => {
    renderPanel({
      characters: [
        uploaded(),
        uploaded({
          id: 'character-2',
          character: { ...uploaded().character, id: 'character-2', name: 'Feathers' },
        }),
      ],
    });

    expect(screen.getByText('Quackers')).toBeTruthy();
    expect(screen.getByText('Feathers')).toBeTruthy();
  });

  it('says in words that they are in no game, and where they came from', () => {
    renderPanel();

    // *Not silently invisible* is the criterion, and *at no table* is not a defect to apologise
    // for — it is what they are
    expect(screen.getByText('Characters at no table')).toBeTruthy();
    expect(screen.getByText(/not in any session/)).toBeTruthy();
  });

  it('warns that deleting the ruleset takes them too', () => {
    renderPanel();

    // The cascade, said before somebody is surprised by it
    expect(screen.getByText(/deleting that ruleset deletes them too/)).toBeTruthy();
  });

  it('offers to delete one, and names which', () => {
    const { onRemove } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onRemove).toHaveBeenCalledWith('character-1');
  });

  it('cannot delete twice while one is on the wire', () => {
    const { onRemove } = renderPanel({ isBusy: true });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onRemove).not.toHaveBeenCalled();
  });

  it('shows a refusal even when the list has emptied under it', () => {
    renderPanel({ characters: [], error: 'Could not read your characters.' });

    expect(screen.getByRole('alert').textContent).toContain('Could not read');
  });
});
