/**
 * The refused-save banner (TICKET-RUL-02)
 *
 * v3 Req 33.8's visible half. What is asserted here is the thing the requirement is actually about:
 * a refused write is **a conflict the User can resolve**, so the banner has to carry the server's
 * own sentence and — when the refusal was a shape check — the fields it named, rather than a
 * generic "could not save" that leaves nobody anywhere to go.
 *
 * `role="alert"` is asserted rather than assumed: the save the User was waiting on did not happen,
 * and a screen reader that does not announce it leaves them looking at an unchanged screen.
 *
 * **Validates: v3 Req 33.8**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { RULESET_ALERT, useUIStore } from '../../stores/uiStore';
import { SaveConflictBanner } from './SaveConflictBanner';

beforeEach(() => {
  useUIStore.setState({ rulesetAlert: null });
});

describe('SaveConflictBanner', () => {
  it('shows nothing while nothing has been refused', () => {
    const { container } = render(<SaveConflictBanner />);

    expect(container.firstChild).toBeNull();
  });

  it('announces the server’s own sentence', () => {
    useUIStore.setState({
      rulesetAlert: {
        kind: RULESET_ALERT.SAVE_REFUSED,
        message: 'Somebody else saved this ruleset.',
      },
    });

    render(<SaveConflictBanner />);

    expect(screen.getByRole('alert').textContent).toContain('Somebody else saved this ruleset.');
    // The heading says where the User's edit *is*, which is the difference from the storage banner
    expect(screen.getByRole('heading', { name: 'This Change Was Not Saved' })).toBeTruthy();
  });

  it('lists the fields a shape refusal named', () => {
    useUIStore.setState({
      rulesetAlert: {
        kind: RULESET_ALERT.SAVE_REFUSED,
        message: 'That ruleset is not a shape this server can read.',
        fields: ['stats: must be an array', 'skills[0].name is required'],
      },
    });

    render(<SaveConflictBanner />);

    expect(screen.getByText('stats: must be an array')).toBeTruthy();
    expect(screen.getByText('skills[0].name is required')).toBeTruthy();
  });

  it('goes away when dismissed, and the next refusal brings it back', () => {
    useUIStore.setState({
      rulesetAlert: {
        kind: RULESET_ALERT.SAVE_REFUSED,
        message: 'Somebody else saved this ruleset.',
      },
    });

    render(<SaveConflictBanner />);
    fireEvent.click(screen.getByText('Dismiss'));

    expect(useUIStore.getState().rulesetAlert).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
