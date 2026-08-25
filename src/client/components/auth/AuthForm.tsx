/**
 * The sign-in and sign-up surfaces (TICKET-AUTH-01)
 *
 * One component for both, because they collect the same two fields and differ only in what the
 * button says and what the page has to warn about. Two components would be two places to fix a
 * focus ring.
 *
 * **The sign-up warning is a requirement, not a nicety** (v3 Req 30.10). A password-only Account
 * cannot be recovered — there is no reset email, because this application sends no email
 * ([D12](../../../../docs/v3.0_backend/overview.md#d12--no-outbound-email-at-all)) — and the person
 * paying that price is told at the moment they can still avoid it, rather than the day they cannot.
 *
 * Layout lives here; the primitives supply the styling.
 *
 * **Validates: v3 Req 30.1, 30.6, 30.8, 30.10**
 */

import { Link } from '@tanstack/react-router';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Checkbox } from '../ui/Checkbox/Checkbox';
import { FormField } from '../ui/FormField/FormField';
import { Text } from '../ui/Text/Text';
import { AuthAlert } from './AuthAlert';
import { switchLinkStyles, warningStyles } from './authSurfaces.style';
import { SocialSignInButtons } from './SocialSignInButtons';
import { AUTH_MODE, type AuthMode, MIN_PASSWORD_LENGTH, useAuthForm } from './useAuthForm';

export interface AuthFormProps {
  mode: AuthMode;
  /** Where to go once the Account is signed in */
  onSuccess: () => void;
}

/** What each surface calls itself */
const WORDING = {
  [AUTH_MODE.SIGN_IN]: {
    title: 'Sign in',
    submit: 'Sign in',
    busy: 'Signing in…',
    switchPrompt: 'No account yet?',
    switchLabel: 'Create one',
    switchTo: '/signup',
  },
  [AUTH_MODE.SIGN_UP]: {
    title: 'Create an account',
    submit: 'Create account',
    busy: 'Creating…',
    switchPrompt: 'Already have an account?',
    switchLabel: 'Sign in',
    switchTo: '/signin',
  },
} as const;

export function AuthForm({ mode, onSuccess }: AuthFormProps) {
  const { form, error, isSubmitting, submit } = useAuthForm(mode, onSuccess);
  const { register, formState } = form;
  const wording = WORDING[mode];

  return (
    <Card className="mx-auto w-full max-w-md">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Text variant="h2" as="h1">
          {wording.title}
        </Text>

        <Text variant="body" as="p">
          An account is only needed to play at a table with other people. Building a ruleset in this
          browser needs no account at all.
        </Text>

        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          required
          className="w-full"
          error={formState.errors.email?.message}
          {...register('email', { required: 'An email address is required.' })}
        />

        <FormField
          label="Password"
          type="password"
          autoComplete={mode === AUTH_MODE.SIGN_UP ? 'new-password' : 'current-password'}
          required
          className="w-full"
          helperText={
            mode === AUTH_MODE.SIGN_UP ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined
          }
          error={formState.errors.password?.message}
          {...register('password', {
            required: 'A password is required.',
            // Checked here so a too-short password is caught before a round trip; the server checks
            // it too, and the server's answer is the one that counts
            minLength:
              mode === AUTH_MODE.SIGN_UP
                ? {
                    value: MIN_PASSWORD_LENGTH,
                    message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
                  }
                : undefined,
          })}
        />

        {mode === AUTH_MODE.SIGN_IN && (
          // v3 Req 48.11. Checked by default because the common case is your own machine; the
          // affordance is for the case that is not, and it is worded as what unchecking *does*
          // rather than as a piece of jargon about session cookies.
          <Checkbox label="Keep me signed in on this device" {...register('rememberMe')} />
        )}

        {mode === AUTH_MODE.SIGN_UP && (
          <div className={warningStyles}>
            <Text variant="body" as="p">
              <strong>There is no password reset.</strong> This application sends no email, so an
              account with only a password cannot be recovered if you lose it. Linking a Google or
              Discord identity after you sign up is the way back in.
            </Text>
          </div>
        )}

        <AuthAlert message={error} />

        <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
          {isSubmitting ? wording.busy : wording.submit}
        </Button>

        {/* Below the password button on both surfaces, and absent entirely when the server has no
            provider configured (TICKET-AUTH-02, v3 Req 31.6). A first social sign-in *is* the
            sign-up, so the offer is the same on either card. */}
        <SocialSignInButtons />

        <Text variant="caption" as="p" className="text-center">
          {wording.switchPrompt}{' '}
          <Link to={wording.switchTo} className={switchLinkStyles}>
            {wording.switchLabel}
          </Link>
        </Text>
      </form>
    </Card>
  );
}
