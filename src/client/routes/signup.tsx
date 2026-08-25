/**
 * `/signup` — creating an Account (TICKET-AUTH-01)
 *
 * The surface that has to say the unwelcome thing: a password-only Account cannot be recovered,
 * because this application sends no email
 * ([D12](../../../docs/v3.0_backend/overview.md#d12--no-outbound-email-at-all)). The warning lives
 * in `AuthForm`, above the button rather than under it, so it is read before the decision rather
 * than after (v3 Req 30.10).
 *
 * **Validates: v3 Req 30.8, 30.10**
 */

import { createFileRoute, useRouter } from '@tanstack/react-router';
import { AuthForm } from '../components/auth/AuthForm';
import { AUTH_MODE } from '../components/auth/useAuthForm';

export const Route = createFileRoute('/signup')({ component: SignUpPage });

function SignUpPage() {
  const router = useRouter();

  return (
    <div className="px-6 py-10 sm:px-10">
      <AuthForm
        mode={AUTH_MODE.SIGN_UP}
        onSuccess={() => {
          // Better Auth signs the new Account in as it creates it, so there is nowhere to send
          // them but on — asking for the same password twice in a row would be the app's doing
          void router.navigate({ to: '/' });
        }}
      />
    </div>
  );
}
