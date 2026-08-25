/**
 * `/signin` — the sign-in surface (TICKET-AUTH-01, TICKET-AUTH-02, TICKET-AUTH-03)
 *
 * A page rather than a dialog, because AUTH-03 sends an unauthenticated visitor here from a
 * protected route and then returns them (v3 Req 32.7) — which needs somewhere to *be*.
 *
 * The route owns where you go next; the form owns the fields and the refusal.
 *
 * **`validateSearch` is what makes the destination a typed part of this route** rather than a
 * string somebody reads out of `window.location`. It runs on every arrival, so
 * `safeDestination`'s refusal of an off-origin `redirect` happens once, at the door, and every
 * reader downstream gets a path this application will actually navigate to.
 *
 * **Validates: v3 Req 30.8, 32.7**
 */

import { createFileRoute } from '@tanstack/react-router';
import { AuthForm } from '../components/auth/AuthForm';
import { REDIRECT_PARAM, safeDestination } from '../components/auth/signInDestination';
import { AUTH_MODE } from '../components/auth/useAuthForm';

export const Route = createFileRoute('/signin')({
  // **Optional, so a plain *Sign in* link stays a plain link.** Declaring it required would make
  // every navigation here — the beam's link, the sign-up page's — carry `?redirect=/`, which is a
  // query string that says nothing and a type error at four call sites that have nothing to say.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const raw = search[REDIRECT_PARAM];
    return raw === undefined ? {} : { redirect: safeDestination(raw) };
  },
  component: SignInPage,
});

export function SignInPage() {
  const { redirect } = Route.useSearch();

  return (
    <div className="px-6 py-10 sm:px-10">
      <AuthForm
        mode={AUTH_MODE.SIGN_IN}
        onSuccess={() => {
          // Back where they were headed, or home when they came here on purpose.
          //
          // **A full document navigation, and it took three browser checks to settle on one.**
          // Against `@tanstack/react-router` 1.163.2 — the version matters, because "three router
          // APIs no-opped" is a statement about one — each looked right and each silently did
          // nothing: `navigate({ to })`
          // wants a route *template* (`/play/character/$id`), so a destination carrying a query
          // string matches no route; `navigate({ href })` without a `to` builds the *current*
          // location in this version, sees the URL unchanged and returns; `router.history.replace`
          // moved nothing either. All three fail the same way — signed in, still looking at the
          // sign-in form — which is the worst possible failure, because nothing errors.
          //
          // A returned-to destination is a **built URL**, not a route, and `location.replace` is
          // the browser API for one. It is also right on its own terms for *this* transition: the
          // whole shell has to re-read who is signed in, and a document load does that from the
          // server rather than reconciling a dozen cached client answers. `replace` rather than
          // `assign` so Back does not return to a sign-in page already used.
          //
          // **This is the reason `safeDestination` exists.** `location.replace` will happily leave
          // the origin, so the guard in front of it is load-bearing rather than defensive.
          window.location.replace(safeDestination(redirect));
        }}
      />
    </div>
  );
}
