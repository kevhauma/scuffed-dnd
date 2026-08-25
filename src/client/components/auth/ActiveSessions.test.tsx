/**
 * The active-sessions card (TICKET-AUTH-04)
 *
 * v3 Req 48.7's visible half. The case worth a test rather than an eyeball is the **current**
 * session: it is listed and labelled rather than hidden, so somebody deciding which one to end can
 * tell which one they are sitting in — and so the count on the page matches the count on the server.
 *
 * **Validates: v3 Req 48.7**
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listSessions = vi.fn();
const getSession = vi.fn();
const revokeSession = vi.fn();
const revokeSessions = vi.fn();

vi.mock('./authClient', () => ({
  authClient: {
    listSessions: () => listSessions(),
    getSession: () => getSession(),
    revokeSession: (...args: unknown[]) => revokeSession(...args),
    revokeSessions: () => revokeSessions(),
  },
}));

import { ActiveSessions } from './ActiveSessions';

/** Two sessions, the second of which is the one this page is being read in */
const THIS_BROWSER = 'token-here';
const OTHER_BROWSER = 'token-elsewhere';

beforeEach(() => {
  listSessions.mockReset().mockResolvedValue({
    data: [
      { token: OTHER_BROWSER, createdAt: '2026-01-01T00:00:00.000Z', userAgent: 'An old laptop' },
      { token: THIS_BROWSER, createdAt: '2026-02-01T00:00:00.000Z', userAgent: null },
    ],
  });
  getSession.mockReset().mockResolvedValue({ data: { session: { token: THIS_BROWSER } } });
  revokeSession.mockReset().mockResolvedValue({ error: null });
  revokeSessions.mockReset().mockResolvedValue({ error: null });
  vi.stubGlobal('location', { replace: vi.fn() });
});

describe('ActiveSessions', () => {
  it('lists every session, including the one being read in', async () => {
    render(<ActiveSessions />);

    // Two rows, not one: a list that hides the current session is a list whose count is wrong
    expect(await screen.findByText('This browser')).toBeTruthy();
    expect(screen.getByText('An old laptop')).toBeTruthy();
  });

  it('offers to end the others and not this one', async () => {
    render(<ActiveSessions />);

    await screen.findByText('This browser');

    // One *End* button — the current session is ended by "sign out everywhere" or by signing out,
    // both of which say what they do
    expect(screen.getAllByRole('button', { name: 'End' })).toHaveLength(1);
  });

  it('ends the session that was chosen', async () => {
    render(<ActiveSessions />);

    fireEvent.click(await screen.findByRole('button', { name: 'End' }));

    await waitFor(() => expect(revokeSession).toHaveBeenCalledWith({ token: OTHER_BROWSER }));
  });

  it('reloads the list afterwards, so the page is not lying about what is left', async () => {
    render(<ActiveSessions />);

    fireEvent.click(await screen.findByRole('button', { name: 'End' }));

    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
  });

  it('signs out everywhere, including this browser (v3 Req 48.7)', async () => {
    render(<ActiveSessions />);

    fireEvent.click(await screen.findByRole('button', { name: /sign out everywhere/i }));

    await waitFor(() => expect(revokeSessions).toHaveBeenCalled());
    // Every cookie is gone, so the next thing the page does has to be re-asking the server
    await waitFor(() => expect(vi.mocked(location.replace)).toHaveBeenCalledWith('/'));
  });

  it('says so when a revocation is refused', async () => {
    revokeSession.mockResolvedValue({ error: { message: 'Session not found' } });

    render(<ActiveSessions />);
    fireEvent.click(await screen.findByRole('button', { name: 'End' }));

    expect((await screen.findByRole('alert')).textContent).toMatch('Session not found');
  });

  it('warns that signing out everywhere ends this session too', async () => {
    render(<ActiveSessions />);

    // The one control on the page that logs the reader out; saying so is the difference between a
    // deliberate act and a surprise
    expect(await screen.findByText(/including this one/i)).toBeTruthy();
  });
});
