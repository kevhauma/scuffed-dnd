/**
 * The account badge on the beam (TICKET-AUTH-01)
 *
 * Three states, and the third is the one worth having a test for: **unknown**. The first paint has
 * not heard back from the server, and rendering *Sign in* during that moment makes the beam flicker
 * for everybody who is already signed in — which reads as having been signed out.
 *
 * **Validates: v3 Req 30.8**
 */

import { fireEvent } from '@testing-library/dom';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useSession = vi.fn();
const signOut = vi.fn();
const invalidate = vi.fn();

vi.mock('./authClient', () => ({
  authClient: {
    useSession: () => useSession(),
    signOut: () => signOut(),
  },
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate }),
  Link: ({ to, children, className }: { to: string; children: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { AccountBadge } from './AccountBadge';

/** What Better Auth's `useSession` hands back in each of the three states */
const SESSION = {
  unknown: { data: null, isPending: true },
  signedOut: { data: null, isPending: false },
  signedIn: { data: { user: { email: 'ada@example.com' } }, isPending: false },
};

beforeEach(() => {
  useSession.mockReset();
  signOut.mockReset().mockResolvedValue(undefined);
  invalidate.mockReset().mockResolvedValue(undefined);
});

describe('AccountBadge', () => {
  it('should render nothing while nobody knows yet', () => {
    useSession.mockReturnValue(SESSION.unknown);

    const { container } = render(<AccountBadge />);

    // Not "Sign in", and not a spinner either — the beam simply has one fewer thing on it for a
    // moment, which nobody notices, where a flash of the wrong state is noticed every time
    expect(container.textContent).toBe('');
  });

  it('should offer a way in when nobody is signed in', () => {
    useSession.mockReturnValue(SESSION.signedOut);

    render(<AccountBadge />);

    // A link, not a wall: local mode is the whole app signed out (D6)
    expect(screen.getByRole('link', { name: /sign in/i }).getAttribute('href')).toBe('/signin');
  });

  it('should show the signed-in email', () => {
    useSession.mockReturnValue(SESSION.signedIn);

    render(<AccountBadge />);

    expect(screen.getByText('ada@example.com')).toBeTruthy();
  });

  it('should make the email the way to the account page (TICKET-AUTH-02)', () => {
    useSession.mockReturnValue(SESSION.signedIn);

    render(<AccountBadge />);

    // This link is the app's **only** navigation to `/account`, so the destination is asserted
    // rather than left to the previous test's text check, which passes for any `to`
    expect(screen.getByRole('link', { name: 'ada@example.com' }).getAttribute('href')).toBe(
      '/account'
    );
  });

  it('should sign out and let the router re-decide what it can show', async () => {
    useSession.mockReturnValue(SESSION.signedIn);

    render(<AccountBadge />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    // The invalidate is what makes a route currently showing account data stop showing it
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it('should not offer sign-out twice while the first one is in flight', async () => {
    useSession.mockReturnValue(SESSION.signedIn);
    render(<AccountBadge />);

    const button = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByRole('button')).toHaveProperty('disabled', true));
  });
});
