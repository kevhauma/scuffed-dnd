/**
 * `/signin` — the sign-in surface (TICKET-AUTH-01)
 *
 * A page rather than a dialog, because AUTH-03 sends an unauthenticated visitor here from a
 * protected route and then returns them (v3 Req 32.7) — which needs somewhere to *be*.
 *
 * The route owns where you go next; the form owns the fields and the refusal.
 *
 * **Validates: v3 Req 30.8**
 */

import { createFileRoute, useRouter } from '@tanstack/react-router';
import { AuthForm } from '../components/auth/AuthForm';
import { AUTH_MODE } from '../components/auth/useAuthForm';

export const Route = createFileRoute('/signin')({ component: SignInPage });

function SignInPage() {
  const router = useRouter();

  return (
    <div className="px-6 py-10 sm:px-10">
      <AuthForm
        mode={AUTH_MODE.SIGN_IN}
        onSuccess={() => {
          // Home rather than back: AUTH-03 brings the return-to-destination redirect, and guessing
          // at it now would be a second implementation for that ticket to unpick
          void router.navigate({ to: '/' });
        }}
      />
    </div>
  );
}
