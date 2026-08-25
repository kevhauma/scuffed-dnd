/**
 * The signed-out account card (TICKET-AUTH-02)
 *
 * One behaviour worth pinning, and it is the one AUTH-03 will take over: a visitor who is not
 * signed in is *pointed at* `/signin` rather than left on a blank page. When AUTH-03 turns that
 * into a redirect, this test is what says out loud that the behaviour moved rather than vanished.
 *
 * **Validates: v3 Req 31.9**
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { SignedOutNotice } from './SignedOutNotice';

describe('SignedOutNotice', () => {
  it('should send an unauthenticated visitor to sign in', () => {
    render(<SignedOutNotice />);

    expect(screen.getByRole('link', { name: /sign in/i }).getAttribute('href')).toBe('/signin');
  });

  it('should say plainly why the page is empty', () => {
    render(<SignedOutNotice />);

    expect(screen.getByText(/not signed in/i)).toBeTruthy();
  });
});
