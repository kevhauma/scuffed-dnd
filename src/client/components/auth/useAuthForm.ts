/**
 * The form state behind sign-in and sign-up (TICKET-AUTH-01)
 *
 * The `useXManager` shape the config panels use, applied to the two auth forms: `react-hook-form`
 * for the fields, the submit path, and the one message the server is allowed to give back. The
 * components below it destructure this and render.
 *
 * **One message, whatever went wrong.** v3 Req 30.6 requires a wrong password and an unknown email
 * to be indistinguishable, and the server already makes them so. This does not *add* a second
 * opinion by explaining the failure differently depending on what it thinks happened — whatever the
 * server said is what the User sees, and it says the same thing both times.
 *
 * **Validates: v3 Req 30.1, 30.6, 30.8**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { authClient } from './authClient';

/** What either form collects */
export interface AuthFormValues {
  email: string;
  password: string;
  /**
   * Whether this browser should remember the Account after it closes (TICKET-AUTH-04)
   *
   * Checked by default, because the common case is somebody's own machine and D13's whole point is
   * that sitting down to play should not start with a password. Unchecking it is the affordance
   * v3 Req 48.11 asks for: a session that ends with the browser, for a device that is not yours.
   */
  rememberMe: boolean;
}

/** Which form this is */
export const AUTH_MODE = {
  SIGN_IN: 'sign-in',
  SIGN_UP: 'sign-up',
} as const;

export type AuthMode = (typeof AUTH_MODE)[keyof typeof AUTH_MODE];

/** The shortest password the server will accept — stated here so the form says so before the trip */
export const MIN_PASSWORD_LENGTH = 8;

/** What a form component needs */
export interface AuthFormManager {
  form: ReturnType<typeof useForm<AuthFormValues>>;
  /** The server's refusal, or null */
  error: string | null;
  /** True while the request is in flight */
  isSubmitting: boolean;
  submit: (event: React.FormEvent<HTMLFormElement>) => void;
}

/** What a refusal from Better Auth looks like, as much of it as this reads */
interface AuthFailure {
  error?: { message?: string } | null;
}

/** The message to show, preferring the server's own words */
function messageFrom(result: AuthFailure): string | null {
  if (!result.error) return null;
  return result.error.message ?? 'That did not work. Check your details and try again.';
}

/**
 * Drive one of the two auth forms
 *
 * @param mode Which form this is
 * @param onSuccess What to do once the Account is signed in — the route decides where to go
 * @returns The form, the error, and the submit handler
 */
export function useAuthForm(mode: AuthMode, onSuccess: () => void): AuthFormManager {
  const form = useForm<AuthFormValues>({
    defaultValues: { email: '', password: '', rememberMe: true },
  });
  const [error, setError] = useState<string | null>(null);

  const submit = form.handleSubmit(async (values) => {
    setError(null);

    try {
      const result =
        mode === AUTH_MODE.SIGN_UP
          ? await authClient.signUp.email({
              email: values.email,
              password: values.password,
              // Better Auth requires a display name and this application has nowhere to ask for
              // one. The address is what the app shows, so asking for a second label to show
              // instead would be a field with no reader.
              name: values.email,
            })
          : await authClient.signIn.email({
              email: values.email,
              password: values.password,
              // `false` is what produces a cookie with no persisted expiry (v3 Req 48.11). Sign-up
              // does not offer it: creating an account on a machine you do not trust is a
              // different decision, and nobody has asked for it.
              rememberMe: values.rememberMe,
            });

      const message = messageFrom(result);
      if (message) {
        setError(message);
        return;
      }

      onSuccess();
    } catch {
      // A network failure rather than a refusal — the server said nothing at all
      setError('Could not reach the server. Check your connection and try again.');
    }
  });

  // `react-hook-form` already tracks this for an async `handleSubmit` callback; a `useState`
  // beside it would be a second copy of the same fact, which is the hand-rolled form state the
  // conventions rule out
  return { form, error, isSubmitting: form.formState.isSubmitting, submit };
}
