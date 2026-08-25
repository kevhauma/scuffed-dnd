/**
 * The sign-in and account routes (TICKET-AUTH-03)
 *
 * The half of v3 Req 32.7 that `RequireAccount` cannot test: **landing back**. The guard sends
 * somebody to `/signin?redirect=…`; this is where that value is honoured, and where an off-origin
 * one is refused a second time.
 *
 * `AuthForm` is mocked down to a button, deliberately — what is under test is the *route's*
 * decision about where to go next, not the form, which has its own file.
 *
 * **Validates: v3 Req 32.6, 32.7**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
const search = { redirect: undefined as string | undefined };

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({
    ...(options as object),
    useSearch: () => search,
  }),
  useLocation: () => ({ href: '/account' }),
}));

// The sign-in return is a full document navigation — see `signin.tsx` for the three router APIs
// that silently did nothing first
vi.stubGlobal('location', { replace });

vi.mock('../components/auth/AuthForm', () => ({
  AuthForm: ({ onSuccess }: { onSuccess: () => void }) => (
    <button type="button" onClick={onSuccess}>
      pretend to sign in
    </button>
  ),
}));

// **Marked rather than transparent.** A passthrough mock makes "renders behind RequireAccount"
// unfalsifiable: delete the wrapper from `account.tsx` and the test still finds the card.
vi.mock('../components/auth/RequireAccount', () => ({
  RequireAccount: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="require-account">{children}</div>
  ),
}));

vi.mock('../components/auth/LinkedIdentities', () => ({
  LinkedIdentities: () => <p>linked identities</p>,
}));

import { AccountPage } from './account';
import { SignInPage, Route as SignInRoute } from './signin';

/** The route's own `validateSearch`, which runs on every arrival */
const validateSearch = (
  SignInRoute as unknown as {
    validateSearch: (raw: Record<string, unknown>) => { redirect?: string };
  }
).validateSearch;

beforeEach(() => {
  replace.mockReset();
  search.redirect = undefined;
});

describe('/signin', () => {
  it('goes home when nobody asked for anywhere in particular', () => {
    render(<SignInPage />);
    fireEvent.click(screen.getByRole('button'));

    expect(replace).toHaveBeenCalledWith('/');
  });

  it('lands back on the route that was originally requested (v3 Req 32.7)', () => {
    search.redirect = '/account';

    render(<SignInPage />);
    fireEvent.click(screen.getByRole('button'));

    expect(replace).toHaveBeenCalledWith('/account');
  });

  it('preserves the query string of that route', () => {
    search.redirect = '/account?tab=identities';

    render(<SignInPage />);
    fireEvent.click(screen.getByRole('button'));

    expect(replace).toHaveBeenCalledWith('/account?tab=identities');
  });

  it('navigates by built URL rather than by route template', () => {
    // **A regression test for a silent no-op two browser checks found.** `navigate({ to })` wants a
    // route *template* (`/play/character/$id`), so a destination carrying a query string matched
    // nothing and the call did nothing — signed in, still looking at the sign-in form. Asserted as
    // a single string argument, because that is the shape only a built URL has.
    search.redirect = '/account?tab=identities';

    render(<SignInPage />);
    fireEvent.click(screen.getByRole('button'));

    expect(replace).toHaveBeenCalledWith('/account?tab=identities');
  });

  it('replaces rather than pushes, so Back does not return to a used sign-in page', () => {
    render(<SignInPage />);
    fireEvent.click(screen.getByRole('button'));

    expect(replace).toHaveBeenCalledTimes(1);
  });

  describe('its validateSearch', () => {
    it('carries a same-origin destination through', () => {
      expect(validateSearch({ redirect: '/account' })).toEqual({ redirect: '/account' });
    });

    it('refuses an off-origin one at the door', () => {
      expect(validateSearch({ redirect: 'https://evil.example' })).toEqual({ redirect: '/' });
    });

    it('adds no key when no destination was asked for', () => {
      // So a plain *Sign in* link stays a plain link rather than growing a `?redirect=/`
      expect(validateSearch({})).toEqual({});
    });
  });

  it('refuses an off-origin destination a second time, on the way out', () => {
    // The route sanitises on arrival; this proves the page does not simply trust what it was
    // handed, so a future caller reaching `SignInPage` another way cannot bypass the check
    search.redirect = 'https://evil.example';

    render(<SignInPage />);
    fireEvent.click(screen.getByRole('button'));

    expect(replace).toHaveBeenCalledWith('/');
  });
});

describe('/account', () => {
  it('renders behind RequireAccount rather than deciding for itself', () => {
    render(<AccountPage />);

    // The nesting, not merely the presence: the route composes the one mechanism and carries no
    // signed-out branch of its own, which is what AUTH-02's `SignedOutNotice` was and why this
    // ticket deleted it
    expect(
      screen.getByTestId('require-account').contains(screen.getByText('linked identities'))
    ).toBe(true);
  });
});
