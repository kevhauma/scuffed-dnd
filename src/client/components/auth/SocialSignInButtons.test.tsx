/**
 * The provider buttons (TICKET-AUTH-02)
 *
 * The criterion worth a test of its own is the *absence*: with a provider unconfigured its button
 * is not on the page, and with neither configured this component renders nothing at all (v3 Req
 * 31.6). A button that exists and fails is the failure mode this exists against.
 *
 * **Validates: v3 Req 31.6, 31.9**
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SOCIAL_PROVIDER, type SocialProvider } from '#shared/types/socialProvider';

const signInSocial = vi.fn();

vi.mock('./authClient', () => ({
  authClient: { signIn: { social: (...args: unknown[]) => signInSocial(...args) } },
}));

const useSocialProviders = vi.fn();
vi.mock('./useSocialProviders', () => ({
  useSocialProviders: () => useSocialProviders(),
}));

import { SocialSignInButtons } from './SocialSignInButtons';

/** What the hook would say for a given deployment */
function configured(providers: SocialProvider[], isPending = false) {
  useSocialProviders.mockReturnValue({ providers, isPending });
}

beforeEach(() => {
  signInSocial.mockReset().mockResolvedValue({ error: null });
  useSocialProviders.mockReset();
});

describe('SocialSignInButtons', () => {
  it('should render nothing while the answer is unknown', () => {
    configured([], true);

    const { container } = render(<SocialSignInButtons />);

    // Not an empty rule and not a placeholder: the card must not jump as the answer arrives
    expect(container.innerHTML).toBe('');
  });

  it('should render nothing when the deployment configured no provider', () => {
    configured([]);

    const { container } = render(<SocialSignInButtons />);

    expect(container.innerHTML).toBe('');
  });

  it('should offer both providers when both are configured', () => {
    configured([SOCIAL_PROVIDER.GOOGLE, SOCIAL_PROVIDER.DISCORD]);

    render(<SocialSignInButtons />);

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /continue with discord/i })).toBeTruthy();
  });

  it.each([SOCIAL_PROVIDER.GOOGLE, SOCIAL_PROVIDER.DISCORD])(
    'should offer only %s when only it is configured (v3 Req 31.6)',
    (provider) => {
      configured([provider]);

      render(<SocialSignInButtons />);

      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(
        screen.getByRole('button', { name: new RegExp(`continue with ${provider}`, 'i') })
      ).toBeTruthy();
    }
  );

  it('should start the flow for the provider that was clicked', async () => {
    configured([SOCIAL_PROVIDER.GOOGLE, SOCIAL_PROVIDER.DISCORD]);

    render(<SocialSignInButtons />);
    fireEvent.click(screen.getByRole('button', { name: /continue with discord/i }));

    await waitFor(() =>
      expect(signInSocial).toHaveBeenCalledWith({
        provider: SOCIAL_PROVIDER.DISCORD,
        callbackURL: '/',
      })
    );
  });

  it('should say so when the server refuses to start the flow', async () => {
    configured([SOCIAL_PROVIDER.GOOGLE]);
    signInSocial.mockResolvedValue({ error: { message: 'Provider not found' } });

    render(<SocialSignInButtons />);
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    // Silence here would leave a button that visibly does nothing
    expect((await screen.findByRole('alert')).textContent).toMatch('Provider not found');
  });

  it('should say so when the server cannot be reached at all', async () => {
    configured([SOCIAL_PROVIDER.GOOGLE]);
    signInSocial.mockRejectedValue(new Error('offline'));

    render(<SocialSignInButtons />);
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/connection/i);
  });
});
