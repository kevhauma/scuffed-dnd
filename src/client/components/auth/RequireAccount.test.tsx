/**
 * The protected-route wrapper (TICKET-AUTH-03)
 *
 * Three states and three behaviours, and the *pending* one is the reason this is tested rather than
 * eyeballed: treating "nobody knows yet" as "signed out" would throw an already-signed-in Account
 * off the page they asked for, every time they opened the app. It is asserted on the rendered
 * output rather than by timing, which is the shape TICKET-AUTH-04's criterion 8 also needs.
 *
 * **Validates: v3 Req 32.6, 32.7**
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
const location = { href: '/account' };

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useLocation: () => location,
}));

const useAuth = vi.fn();
vi.mock('./useAuth', () => ({ useAuth: () => useAuth() }));

import { RequireAccount } from './RequireAccount';

/** The three answers `useAuth` can give */
const AUTH = {
  unknown: { email: null, isPending: true, isSignedIn: false },
  signedOut: { email: null, isPending: false, isSignedIn: false },
  signedIn: { email: 'ada@example.com', isPending: false, isSignedIn: true },
};

beforeEach(() => {
  navigate.mockReset();
  useAuth.mockReset();
  location.href = '/account';
});

describe('RequireAccount', () => {
  it('renders the protected content to a signed-in Account', () => {
    useAuth.mockReturnValue(AUTH.signedIn);

    render(
      <RequireAccount>
        <p>your rulesets</p>
      </RequireAccount>
    );

    expect(screen.getByText('your rulesets')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not redirect while the answer is still unknown', async () => {
    useAuth.mockReturnValue(AUTH.unknown);

    const { container } = render(
      <RequireAccount>
        <p>your rulesets</p>
      </RequireAccount>
    );

    // The load-bearing case: redirecting here would sign an already-signed-in Account out of the
    // page they asked for on every first paint
    expect(container.innerHTML).toBe('');
    await waitFor(() => expect(navigate).not.toHaveBeenCalled());
  });

  it('sends a signed-out visitor to sign in, carrying where to come back to (v3 Req 32.7)', async () => {
    useAuth.mockReturnValue(AUTH.signedOut);

    render(
      <RequireAccount>
        <p>your rulesets</p>
      </RequireAccount>
    );

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/signin',
        search: { redirect: '/account' },
        replace: true,
      })
    );
  });

  it('keeps the query string of the route that was asked for', async () => {
    useAuth.mockReturnValue(AUTH.signedOut);
    location.href = '/account?tab=identities';

    render(
      <RequireAccount>
        <p>your rulesets</p>
      </RequireAccount>
    );

    // Half a destination is a worse answer than none — v3 Req 32.7 says the *requested* route
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({ search: { redirect: '/account?tab=identities' } })
      )
    );
  });

  it('never renders the protected content to a signed-out visitor, not even for one paint', () => {
    useAuth.mockReturnValue(AUTH.signedOut);

    const { container } = render(
      <RequireAccount>
        <p>your rulesets</p>
      </RequireAccount>
    );

    // The redirect is asynchronous; what must not happen is the content flashing in the meantime
    expect(container.innerHTML).toBe('');
  });

  it('sends one redirect, whatever the location does afterwards', async () => {
    // **The regression test for a loop the browser check found.** The destination used to be read
    // live from the location, so once the redirect started, `/signin?redirect=/account` became the
    // new destination and was sent again — compounding `%25253Fredirect` until it filled the
    // address bar. The route a guard was mounted under is fixed at mount.
    useAuth.mockReturnValue(AUTH.signedOut);

    const { rerender } = render(
      <RequireAccount>
        <p>your rulesets</p>
      </RequireAccount>
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));

    // The router has begun moving; the guard is still mounted and must not react to it
    location.href = '/signin?redirect=%2Faccount';
    rerender(
      <RequireAccount>
        <p>your rulesets</p>
      </RequireAccount>
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: { redirect: '/account' } })
    );
  });

  it('says nothing about expiry to somebody who was never signed in (v3 Req 48.9)', async () => {
    useAuth.mockReturnValue(AUTH.signedOut);

    render(
      <RequireAccount>
        <p>your rulesets</p>
      </RequireAccount>
    );

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({ search: { redirect: '/account' } })
      )
    );
  });

  it('marks the redirect as an expiry when the session went away mid-use (v3 Req 48.9)', async () => {
    // **The difference is the transition, not the state**: both cases are `isSignedIn: false`, and
    // only a component that saw the *other* answer first can tell them apart. Without this an
    // Account whose ninety-day ceiling arrived would be shown the same blank sign-in form as a
    // stranger, which is exactly the "silently failed action" the requirement rules out.
    useAuth.mockReturnValue(AUTH.signedIn);

    const { rerender } = render(
      <RequireAccount>
        <p>your rulesets</p>
      </RequireAccount>
    );

    useAuth.mockReturnValue(AUTH.signedOut);
    rerender(
      <RequireAccount>
        <p>your rulesets</p>
      </RequireAccount>
    );

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({ search: { redirect: '/account', expired: true } })
      )
    );
  });

  it('replaces rather than pushes, so Back does not bounce off the guard', async () => {
    useAuth.mockReturnValue(AUTH.signedOut);

    render(
      <RequireAccount>
        <p>your rulesets</p>
      </RequireAccount>
    );

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ replace: true }))
    );
  });
});
