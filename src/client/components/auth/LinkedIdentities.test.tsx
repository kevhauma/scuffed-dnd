/**
 * The linked-identities view (TICKET-AUTH-02)
 *
 * v3 Req 31.9's two halves: an Account is shown which identities it holds, and is offered the one
 * it does not. The third case is the one a card without a test would get wrong — a deployment with
 * no provider configured, where an Account came looking for the recovery path sign-up promised it
 * and has to be told there is none.
 *
 * **Validates: v3 Req 31.9**
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SOCIAL_PROVIDER } from '#shared/types/socialProvider';

const listAccounts = vi.fn();
const linkSocial = vi.fn();

vi.mock('./authClient', () => ({
  authClient: {
    listAccounts: () => listAccounts(),
    linkSocial: (...args: unknown[]) => linkSocial(...args),
  },
}));

const useSocialProviders = vi.fn();
vi.mock('./useSocialProviders', () => ({
  useSocialProviders: () => useSocialProviders(),
}));

import { LinkedIdentities } from './LinkedIdentities';

beforeEach(() => {
  listAccounts.mockReset().mockResolvedValue({ data: [] });
  linkSocial.mockReset().mockResolvedValue({ error: null });
  useSocialProviders.mockReset().mockReturnValue({
    providers: [SOCIAL_PROVIDER.GOOGLE, SOCIAL_PROVIDER.DISCORD],
    isPending: false,
  });
});

describe('LinkedIdentities', () => {
  it('should say why linking matters, because sign-up promised this page', async () => {
    render(<LinkedIdentities />);

    // The D12 consequence, stated where the Account can still act on it
    expect(await screen.findByText(/no password reset/i)).toBeTruthy();
  });

  it('should mark a linked provider and offer only the other one', async () => {
    listAccounts.mockResolvedValue({
      data: [{ providerId: SOCIAL_PROVIDER.GOOGLE }, { providerId: 'credential' }],
    });

    render(<LinkedIdentities />);

    expect(await screen.findByText('Linked')).toBeTruthy();
    expect(screen.getByRole('button', { name: /link discord/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /link google/i })).toBeNull();
  });

  it('should not treat the password credential as a provider', async () => {
    // `credential` is Better Auth's name for the password row; it is not something to link
    listAccounts.mockResolvedValue({ data: [{ providerId: 'credential' }] });

    render(<LinkedIdentities />);

    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(2));
    expect(screen.queryByText('Linked')).toBeNull();
  });

  it('should start the link for the provider that was clicked', async () => {
    render(<LinkedIdentities />);

    fireEvent.click(await screen.findByRole('button', { name: /link google/i }));

    await waitFor(() =>
      expect(linkSocial).toHaveBeenCalledWith({
        provider: SOCIAL_PROVIDER.GOOGLE,
        callbackURL: '/account',
      })
    );
  });

  it('should say the deployment has none rather than showing a blank card', async () => {
    useSocialProviders.mockReturnValue({ providers: [], isPending: false });

    render(<LinkedIdentities />);

    expect(await screen.findByText(/no sign-in providers configured/i)).toBeTruthy();
  });

  it('should say so when the link cannot be started', async () => {
    linkSocial.mockResolvedValue({ error: { message: 'Provider not found' } });

    render(<LinkedIdentities />);
    fireEvent.click(await screen.findByRole('button', { name: /link google/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch('Provider not found');
  });
});
