/**
 * The two-homes ruleset list (TICKET-RUL-01)
 *
 * Two of RUL-01's criteria are about what a **signed-out** visitor sees, and they are the ones
 * worth a test rather than an eyeball: the page shows the browser's own ruleset and opens it for
 * editing — no redirect, no sign-in wall, no empty state (v3 Req 36.1) — and every row says which
 * home it lives in, with the two never merged into one list (v3 Req 36.8).
 *
 * The manager is mocked, so this is about the surface rather than about the fetch; the fetch has
 * its own file.
 *
 * **Validates: v3 Req 36.1, 36.8**
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const useRulesetManager = vi.fn();

vi.mock('./useRulesetManager', () => ({ useRulesetManager: () => useRulesetManager() }));

// `Link` needs a router context this test has no reason to build — the assertion is that an *open*
// affordance is on the page, not that TanStack navigates, which is its own library's test
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

import { RulesetsPanel } from './RulesetsPanel';

/** The manager as it stands for a signed-out visitor with a ruleset in this browser */
function signedOut(overrides: Record<string, unknown> = {}) {
  return {
    localRuleset: { name: 'Ducklets', updatedAt: Date.parse('2026-08-01T10:00:00.000Z') },
    isLocalLoaded: true,
    createLocalRuleset: vi.fn(),
    isSignedIn: false,
    isAccountPending: false,
    accountRulesets: [],
    error: null,
    isDialogOpen: false,
    isRenaming: false,
    form: { register: () => ({}), formState: { errors: {} } },
    openCreate: vi.fn(),
    openRename: vi.fn(),
    closeDialog: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    pendingDelete: null,
    confirmDelete: vi.fn(),
    cancelDelete: vi.fn(),
    ...overrides,
  };
}

describe('RulesetsPanel', () => {
  it('shows the browser’s ruleset to a signed-out visitor, with a way to open it', () => {
    useRulesetManager.mockReturnValue(signedOut());

    render(<RulesetsPanel />);

    expect(screen.getByText('Ducklets')).toBeTruthy();
    expect(screen.getByText('Open').getAttribute('href')).toBe('/config');
  });

  it('offers a sign-in prompt rather than a wall or an empty state', () => {
    useRulesetManager.mockReturnValue(signedOut());

    render(<RulesetsPanel />);

    // The account home says "sign in to have one", not "you have none" — and the browser's ruleset
    // above it is untouched by the absence of an Account (D6)
    expect(screen.getByText('Sign in').getAttribute('href')).toBe('/signin');
    expect(screen.queryByText('No rulesets on your account yet.')).toBeNull();
    expect(screen.getByText('Ducklets')).toBeTruthy();
  });

  it('offers to start one when this browser holds none, without mentioning an account', () => {
    useRulesetManager.mockReturnValue(signedOut({ localRuleset: null }));

    render(<RulesetsPanel />);

    expect(screen.getByText('This browser holds no ruleset yet.')).toBeTruthy();
    expect(screen.getByText('Start one in this browser')).toBeTruthy();
  });

  it('names both homes and keeps them apart (v3 Req 36.8)', () => {
    useRulesetManager.mockReturnValue(
      signedOut({
        isSignedIn: true,
        accountRulesets: [
          {
            id: 'r1',
            name: 'Emberfall',
            schemaVersion: 9,
            revision: 2,
            createdAt: 1_760_000_000_000,
            updatedAt: 1_760_000_000_000,
          },
        ],
      })
    );

    render(<RulesetsPanel />);

    // Two headings and two badges: one row of each kind, each stating where it lives. A single
    // merged list would show one heading and would leave "where does this save to?" unanswerable.
    expect(screen.getByRole('heading', { name: 'This browser' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Your account' })).toBeTruthy();
    expect(screen.getAllByText('This browser').length).toBe(2);
    expect(screen.getAllByText('Your account').length).toBe(2);
  });

  it('shows the server’s own sentence when a delete needs confirming', () => {
    useRulesetManager.mockReturnValue(
      signedOut({
        isSignedIn: true,
        pendingDelete: {
          id: 'r1',
          name: 'Emberfall',
          message: '2 game sessions were started from this ruleset.',
        },
      })
    );

    render(<RulesetsPanel />);

    expect(screen.getByText('2 game sessions were started from this ruleset.')).toBeTruthy();
    expect(screen.getByText('Delete anyway')).toBeTruthy();
  });

  it('announces a refusal so a screen reader hears it', () => {
    useRulesetManager.mockReturnValue(signedOut({ error: 'Could not reach the server.' }));

    render(<RulesetsPanel />);

    expect(screen.getByRole('alert').textContent).toContain('Could not reach the server.');
  });
});
