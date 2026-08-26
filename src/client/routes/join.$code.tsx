/**
 * `/join/$code` — following an invitation (TICKET-GAM-02)
 *
 * **Protected, and that is what closes criterion six.** Following the link while signed out reaches
 * `RequireAccount`, which redirects to `/signin` carrying the whole `href` — code and all — and
 * `safeDestination` brings the visitor back here afterwards. That is AUTH-03's return-to-route
 * behaviour reused rather than a second implementation, which the ticket asks for by name.
 *
 * **The code is a path segment rather than a query parameter**, so the link reads as a link:
 * `…/join/A1B2C-3D4E5` is something a person can retype from a photograph of a whiteboard.
 *
 * **Validates: v3 Req 32.6, 32.7, 38.1**
 */

import { createFileRoute } from '@tanstack/react-router';
import { RequireAccount } from '../components/auth/RequireAccount';
import { JoinSessionPanel } from '../components/sessions/JoinSessionPanel';
import { useJoinSession } from '../components/sessions/useJoinSession';

export const Route = createFileRoute('/join/$code')({ component: JoinPage });

export function JoinPage() {
  return (
    <RequireAccount>
      <JoinRoute />
    </RequireAccount>
  );
}

/**
 * The join, once there is an Account
 *
 * Split from the page so the hook is never called without one: `RequireAccount` renders nothing
 * while the answer is unknown, and a preview request fired during that window would be an anonymous
 * request whose 401 the User would read as a bad invitation.
 */
function JoinRoute() {
  const { code } = Route.useParams();
  const join = useJoinSession(code);

  return (
    <JoinSessionPanel
      preview={join.preview}
      isPending={join.isPending}
      isBusy={join.isBusy}
      error={join.error}
      outcome={join.outcome}
      session={join.session}
      onJoin={join.join}
    />
  );
}
