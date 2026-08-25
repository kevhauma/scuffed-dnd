/**
 * The sign-in and sign-up surfaces (TICKET-AUTH-01)
 *
 * `authClient` is mocked at its boundary, so what is exercised here is the *form*: what it sends,
 * what it does with a refusal, and the one thing v3 Req 30.10 requires it to say out loud before
 * anybody commits to a password they cannot recover.
 *
 * The server's own behaviour — that the refusal really is indistinguishable, that the password is
 * really hashed — is `src/server/auth/auth.test.ts`, against a real database. Asserting it here as
 * well would be asserting the mock.
 *
 * **Validates: v3 Req 30.1, 30.6, 30.8, 30.10**
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const signInEmail = vi.fn();
const signUpEmail = vi.fn();

vi.mock('./authClient', () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => signInEmail(...args) },
    signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
  },
}));

// The provider buttons are TICKET-AUTH-02's and have their own file; here the list is mocked so
// this one stays about the *form* — and so that its default, an unconfigured deployment, is the
// AUTH-01 card unchanged (v3 Req 31.6)
const useSocialProviders = vi.fn();
vi.mock('./useSocialProviders', () => ({
  useSocialProviders: () => useSocialProviders(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { AuthForm } from './AuthForm';
import { AUTH_MODE } from './useAuthForm';

/** Fill both fields and submit */
function submit(email = 'ada@example.com', password = 'correct-horse-battery') {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /sign in|create account/i }));
}

beforeEach(() => {
  signInEmail.mockReset().mockResolvedValue({ error: null });
  signUpEmail.mockReset().mockResolvedValue({ error: null });
  useSocialProviders.mockReset().mockReturnValue({ providers: [], isPending: false });
});

describe('AuthForm — signing in', () => {
  it('should send the address and password to the server', async () => {
    render(<AuthForm mode={AUTH_MODE.SIGN_IN} onSuccess={vi.fn()} />);

    submit();

    await waitFor(() =>
      expect(signInEmail).toHaveBeenCalledWith({
        email: 'ada@example.com',
        password: 'correct-horse-battery',
        // Checked by default: the common case is somebody's own machine (TICKET-AUTH-04)
        rememberMe: true,
      })
    );
  });

  it('should hand the route control once the Account is in', async () => {
    const onSuccess = vi.fn();
    render(<AuthForm mode={AUTH_MODE.SIGN_IN} onSuccess={onSuccess} />);

    submit();

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('should show the server’s refusal without adding a second opinion to it', async () => {
    signInEmail.mockResolvedValue({ error: { message: 'Invalid email or password' } });
    const onSuccess = vi.fn();
    render(<AuthForm mode={AUTH_MODE.SIGN_IN} onSuccess={onSuccess} />);

    submit();

    // The message is the server's, verbatim. v3 Req 30.6 makes wrong-password and unknown-email
    // identical, and a form that explained them differently would undo that from the outside.
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('should say something rather than nothing when the server cannot be reached', async () => {
    signInEmail.mockRejectedValue(new Error('offline'));
    render(<AuthForm mode={AUTH_MODE.SIGN_IN} onSuccess={vi.fn()} />);

    submit();

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not reach the server/i);
  });

  it('should refuse an empty submission before troubling the server', async () => {
    render(<AuthForm mode={AUTH_MODE.SIGN_IN} onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/an email address is required/i)).toBeTruthy();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it('should not carry the sign-up warning, which is about creating an account', () => {
    render(<AuthForm mode={AUTH_MODE.SIGN_IN} onSuccess={vi.fn()} />);

    expect(screen.queryByText(/no password reset/i)).toBeNull();
  });
});

describe('AuthForm — signing up', () => {
  it('should create the Account with the address as its name', async () => {
    render(<AuthForm mode={AUTH_MODE.SIGN_UP} onSuccess={vi.fn()} />);

    submit();

    await waitFor(() =>
      expect(signUpEmail).toHaveBeenCalledWith({
        email: 'ada@example.com',
        password: 'correct-horse-battery',
        name: 'ada@example.com',
      })
    );
  });

  it('should state that a password-only account cannot be recovered, before the button', () => {
    render(<AuthForm mode={AUTH_MODE.SIGN_UP} onSuccess={vi.fn()} />);

    const warning = screen.getByText(/no password reset/i);
    const button = screen.getByRole('button', { name: /create account/i });

    // v3 Req 30.10 — the price stated to the person paying it, at the moment they can still avoid
    // it. Below the button it would be read after the decision, which is not what "before" means.
    expect(warning).toBeTruthy();
    expect(warning.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should offer a linked identity as the way back in', () => {
    render(<AuthForm mode={AUTH_MODE.SIGN_UP} onSuccess={vi.fn()} />);

    // The other half of Req 30.10: naming the cost without naming the alternative is just bad news
    expect(screen.getByText(/google or discord/i)).toBeTruthy();
  });

  it('should refuse a short password before the round trip', async () => {
    render(<AuthForm mode={AUTH_MODE.SIGN_UP} onSuccess={vi.fn()} />);

    submit('ada@example.com', 'short');

    expect(await screen.findByText(/at least 8 characters/i)).toBeTruthy();
    expect(signUpEmail).not.toHaveBeenCalled();
  });
});

describe('AuthForm — either surface', () => {
  it('should say an account is not needed to build a ruleset in this browser', () => {
    // D6, on the one surface where somebody is most likely to think otherwise
    render(<AuthForm mode={AUTH_MODE.SIGN_IN} onSuccess={vi.fn()} />);

    expect(screen.getByText(/needs no account at all/i)).toBeTruthy();
  });

  it('should ask for a browser-lifetime session when the box is unchecked (v3 Req 48.11)', async () => {
    // **The affordance is the *unchecking*.** Asserting only the default would pass even if the
    // checkbox's `register` ref never reached the input, which is the whole of the wiring.
    render(<AuthForm mode={AUTH_MODE.SIGN_IN} onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByLabelText(/keep me signed in/i));
    submit();

    await waitFor(() =>
      expect(signInEmail).toHaveBeenCalledWith(expect.objectContaining({ rememberMe: false }))
    );
  });

  it('should not offer it on the sign-up surface', () => {
    // Creating an account on a machine you do not trust is a different decision, and nobody has
    // asked for it
    render(<AuthForm mode={AUTH_MODE.SIGN_UP} onSuccess={vi.fn()} />);

    expect(screen.queryByLabelText(/keep me signed in/i)).toBeNull();
  });

  it.each([AUTH_MODE.SIGN_IN, AUTH_MODE.SIGN_UP])(
    'should offer the configured providers on the %s surface (TICKET-AUTH-02)',
    (mode) => {
      // A first social sign-in *is* the sign-up, so the offer is the same on either card
      useSocialProviders.mockReturnValue({ providers: ['google'], isPending: false });

      render(<AuthForm mode={mode} onSuccess={vi.fn()} />);

      expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy();
    }
  );

  it.each([AUTH_MODE.SIGN_IN, AUTH_MODE.SIGN_UP])(
    'should show no provider button on the %s surface when none is configured (v3 Req 31.6)',
    (mode) => {
      render(<AuthForm mode={mode} onSuccess={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /continue with/i })).toBeNull();
    }
  );

  it('should compose primitives rather than raw form controls', () => {
    const { container } = render(<AuthForm mode={AUTH_MODE.SIGN_UP} onSuccess={vi.fn()} />);

    // The library's rule: a feature component never writes a bare <input> or <button>. Those exist
    // in the tree — `FormField` and `Button` render them — but they carry the primitives' classes.
    for (const input of container.querySelectorAll('input')) {
      expect(input.className, input.getAttribute('name') ?? '').not.toBe('');
    }
    for (const button of container.querySelectorAll('button')) {
      expect(button.className).not.toBe('');
    }
  });
});
