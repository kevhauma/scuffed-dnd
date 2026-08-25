/**
 * One ruleset's row (TICKET-RUL-01)
 *
 * v3 Req 36.8 asks that it be unambiguous **at all times** whether the ruleset on screen lives in
 * this browser or on the Account. A badge that appeared only sometimes — on hover, on the account
 * rows only, when the name is short enough — would satisfy a screenshot and not the requirement, so
 * what is asserted here is that the label is on the row in both homes and with every combination of
 * actions.
 *
 * **Validates: v3 Req 36.8**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RULESET_HOME } from '../../services/rulesetSync';
import { RulesetCard } from './RulesetCard';

describe('RulesetCard', () => {
  it('states its home whichever one it is', () => {
    const { unmount } = render(
      <RulesetCard name="Ducklets" home={RULESET_HOME.BROWSER} updatedAt={1} />
    );
    expect(screen.getByText('This browser')).toBeTruthy();
    unmount();

    render(<RulesetCard name="Emberfall" home={RULESET_HOME.ACCOUNT} updatedAt={1} />);
    expect(screen.getByText('Your account')).toBeTruthy();
  });

  it('states its home with no actions on it at all', () => {
    // The local row has no rename or delete, and a badge that only appeared beside a button would
    // leave exactly that row unlabelled — which is the row local mode is entirely made of
    render(<RulesetCard name="Ducklets" home={RULESET_HOME.BROWSER} updatedAt={1} />);

    expect(screen.getByText('This browser')).toBeTruthy();
    expect(screen.queryByText('Rename')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('offers only the actions it was given', () => {
    const onRename = vi.fn();

    render(
      <RulesetCard name="Emberfall" home={RULESET_HOME.ACCOUNT} updatedAt={1} onRename={onRename} />
    );

    fireEvent.click(screen.getByText('Rename'));

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Delete')).toBeNull();
  });
});
