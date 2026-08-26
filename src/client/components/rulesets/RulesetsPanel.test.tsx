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

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const useRulesetManager = vi.fn();

// Only the hook is replaced. The module also exports `RULESET_DIALOG`, which `RulesetFormDialog`
// reads to pick its title — a whole-module factory left that `undefined` and the dialog threw.
vi.mock('./useRulesetManager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useRulesetManager')>()),
  useRulesetManager: () => useRulesetManager(),
}));

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
    // The Account's characters at no table (TICKET-CHAR-04) — none by default, which is what the
    // panel renders nothing for
    unseated: { characters: [], isPending: false, isBusy: false, error: null, remove: vi.fn() },
    removeUnseated: vi.fn(),
    dialogMode: null,
    form: { register: () => ({}), formState: { errors: {} } },
    openCreate: vi.fn(),
    openRename: vi.fn(),
    openCopy: vi.fn(),
    openAccount: vi.fn(),
    openLocal: vi.fn(),
    closeDialog: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    pendingDelete: null,
    confirmDelete: vi.fn(),
    cancelDelete: vi.fn(),
    // TICKET-IO-04's composed sub-hook. Signed out every one of these is inert, which is the point:
    // there is no Account to put anything on, so no affordance appears and nothing is requested.
    transfer: {
      result: null,
      failure: null,
      isBusy: false,
      dismissResult: vi.fn(),
      importFile: vi.fn(),
      pendingUpload: null,
      canUpload: false,
      openUpload: vi.fn(),
      cancelUpload: vi.fn(),
      confirmUpload: vi.fn(),
      downloadBackup: vi.fn(),
    },
    ...overrides,
  };
}

describe('RulesetsPanel', () => {
  it('shows the browser’s ruleset to a signed-out visitor, with a way to open it', () => {
    const openLocal = vi.fn();
    useRulesetManager.mockReturnValue(signedOut({ openLocal }));

    render(<RulesetsPanel />);

    expect(screen.getByText('Ducklets')).toBeTruthy();
    // A button rather than a link since TICKET-RUL-02: opening re-points the config store at this
    // home, that can fail, and a `<Link>` would navigate anyway — landing the User in Configuration
    // mode editing the *Account's* ruleset believing it was this browser's
    fireEvent.click(screen.getByText('Open'));
    expect(openLocal).toHaveBeenCalledTimes(1);
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

  describe('the two refusals do not mask each other (the IO-04 review)', () => {
    /** A manager with a stale listing error and a fresh transfer refusal at the same time */
    function bothFailing(transfer: Record<string, unknown> = {}) {
      const base = signedOut({ isSignedIn: true, error: 'Could not load your rulesets.' });

      return {
        ...base,
        transfer: {
          ...base.transfer,
          failure: { message: 'That ruleset is not a shape this server can read.', fields: [] },
          ...transfer,
        },
      };
    }

    it('shows both, rather than the account error swallowing the transfer one', () => {
      // `useAccountRulesets`'s error survives until the next *write*, so one failed listing on page
      // load used to hide every later import refusal behind a `??`
      useRulesetManager.mockReturnValue(bothFailing());

      render(<RulesetsPanel />);

      const announced = screen.getAllByRole('alert').map((node) => node.textContent ?? '');

      expect(announced.some((text) => text.includes('Could not load your rulesets.'))).toBe(true);
      expect(announced.some((text) => text.includes('not a shape this server can read'))).toBe(
        true
      );
    });

    it('lists the failing fields the server named', () => {
      useRulesetManager.mockReturnValue(
        bothFailing({
          failure: {
            message: 'That ruleset is not a shape this server can read.',
            fields: ["Field 'stats' must be an array"],
          },
        })
      );

      render(<RulesetsPanel />);

      expect(screen.getByText("Field 'stats' must be an array")).toBeTruthy();
    });

    it('leaves the transfer refusal to the dialog while the dialog is open', () => {
      // Otherwise it renders under a `fixed inset-0` blurred overlay, which is no message at all
      useRulesetManager.mockReturnValue(
        bothFailing({
          pendingUpload: { name: 'Ducklets', characterCount: 0, request: { configuration: {} } },
        })
      );

      render(<RulesetsPanel />);

      const announced = screen.getAllByRole('alert').map((node) => node.textContent ?? '');

      expect(announced.filter((text) => text.includes('not a shape this server can read'))).toEqual(
        ['That ruleset is not a shape this server can read.']
      );
    });
  });
});
