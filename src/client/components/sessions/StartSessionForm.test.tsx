/**
 * Starting a table (TICKET-GAM-02)
 *
 * **The lead is asserted, not just the form.** D7 is the thing a DM will otherwise discover
 * mid-campaign — that the game plays a *copy* of the ruleset and retuning the original does nothing
 * — so the sentence saying so is part of the feature rather than decoration.
 *
 * **The three states are drawn differently**, matching `AccountRulesetHome`: signed out, signed in
 * with no rulesets, and ready. Each has a different next step, and collapsing any two would leave
 * somebody without one.
 *
 * **Validates: v3 Req 37.1, 37.2**
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RulesetSummary } from '#shared/types/api';
import { StartSessionForm } from './StartSessionForm';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

/** A ruleset on the account, as the listing carries it */
function ruleset(id: string, name: string): RulesetSummary {
  return { id, name, schemaVersion: 9, revision: 1, createdAt: 1, updatedAt: 1 };
}

/** The form with everything defaulted to "signed in, one ruleset" */
function renderForm(props: Partial<React.ComponentProps<typeof StartSessionForm>> = {}) {
  const onStart = vi.fn().mockResolvedValue(true);

  render(<StartSessionForm rulesets={[ruleset('r1', 'Ducklets')]} onStart={onStart} {...props} />);

  return { onStart };
}

describe('StartSessionForm', () => {
  it('says the game plays a copy, which is the thing a DM must know (D7)', () => {
    renderForm();

    expect(screen.getByText(/takes a copy of the ruleset/)).toBeTruthy();
    expect(screen.getByText(/will not change a game already running/)).toBeTruthy();
  });

  it('sends somebody with no rulesets where they need to go first', () => {
    renderForm({ rulesets: [] });

    expect(screen.getByText('Go to your rulesets').getAttribute('href')).toBe('/rulesets');
    expect(screen.queryByRole('button', { name: 'Start game' })).toBeNull();
  });

  it('will not start a nameless game', () => {
    const { onStart } = renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    expect(onStart).not.toHaveBeenCalled();
  });

  it('starts one from the chosen ruleset', async () => {
    const { onStart } = renderForm({
      rulesets: [ruleset('r1', 'Ducklets'), ruleset('r2', 'Emberfall')],
    });

    fireEvent.change(screen.getByLabelText('What to call it'), {
      target: { value: 'Tuesday night' },
    });
    fireEvent.change(screen.getByLabelText('Ruleset'), { target: { value: 'r2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    await waitFor(() => expect(onStart).toHaveBeenCalledWith('r2', 'Tuesday night'));
  });

  it('defaults to the first ruleset rather than to nothing', async () => {
    const { onStart } = renderForm();

    fireEvent.change(screen.getByLabelText('What to call it'), { target: { value: 'Friday' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    await waitFor(() => expect(onStart).toHaveBeenCalledWith('r1', 'Friday'));
  });

  it('trims what was typed rather than storing the spaces', async () => {
    const { onStart } = renderForm();

    fireEvent.change(screen.getByLabelText('What to call it'), {
      target: { value: '  Tuesday night  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    await waitFor(() => expect(onStart).toHaveBeenCalledWith('r1', 'Tuesday night'));
  });

  it('clears the name once the table exists', async () => {
    renderForm();

    const field = screen.getByLabelText('What to call it') as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'Tuesday night' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    await waitFor(() => expect(field.value).toBe(''));
  });

  it('keeps what was typed when the server refuses', async () => {
    const onStart = vi.fn().mockResolvedValue(false);
    render(<StartSessionForm rulesets={[ruleset('r1', 'Ducklets')]} onStart={onStart} />);

    const field = screen.getByLabelText('What to call it') as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'Tuesday night' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    // A form that emptied itself on a refusal would have thrown away what the User typed along
    // with the reason
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(field.value).toBe('Tuesday night');
  });
});
