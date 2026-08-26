/**
 * `/signup` — creating an Account (TICKET-AUTH-01)
 *
 * The surface that has to say the unwelcome thing: a password-only Account cannot be recovered,
 * because this application sends no email
 * ([D12](../../../docs/v3.0_backend/overview.md#d12--no-outbound-email-at-all)). The warning lives
 * in `AuthForm`, above the button rather than under it, so it is read before the decision rather
 * than after (v3 Req 30.10).
 *
 * **It returns somebody to where they were headed since TICKET-GAM-02**, which `/signin` has done
 * since AUTH-03 and this page did not. The gap only became visible when invitations arrived, and
 * then it was the *common* path rather than an edge: somebody follows an invite link, has no
 * account, is sent to sign-in, clicks *Create one* — and used to land on the home page with the
 * invitation gone. The mechanism is AUTH-03's, unchanged, applied to a second door (v3 Req 32.7).
 *
 * **Validates: v3 Req 30.8, 30.10, 32.7**
 */

import { createFileRoute } from '@tanstack/react-router';
import { AuthForm } from '../components/auth/AuthForm';
import { destinationSearch, safeDestination } from '../components/auth/signInDestination';
import { AUTH_MODE } from '../components/auth/useAuthForm';

export const Route = createFileRoute('/signup')({
  // Validated at the door, so nothing downstream handles a raw destination — `safeDestination`
  // refuses anything that is not a path on this origin
  validateSearch: destinationSearch,
  component: SignUpPage,
});

function SignUpPage() {
  const { redirect } = Route.useSearch();

  return (
    <div className="px-6 py-10 sm:px-10">
      <AuthForm
        mode={AUTH_MODE.SIGN_UP}
        // The destination travels on to `/signin` too, so somebody who realises they *do* have an
        // account does not lose it by going back the other way
        switchSearch={redirect === undefined ? undefined : { redirect }}
        onSuccess={() => {
          // Better Auth signs the new Account in as it creates it, so there is nowhere to send them
          // but on — and `window.location.replace` for the reason `/signin` records at length: a
          // returned-to destination is a built URL rather than a route, and the shell has to
          // re-read who is signed in
          window.location.replace(safeDestination(redirect));
        }}
      />
    </div>
  );
}
