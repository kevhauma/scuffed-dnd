/**
 * What somebody following an invite link sees (TICKET-GAM-02)
 *
 * **It shows before it joins.** The name of the table is on screen and nothing has happened yet; a
 * link that silently seated you at a stranger's game would be a link nobody could safely click.
 *
 * **Every refusal is the server's sentence, rendered.** v3 Req 38.4 asks for a distinct message for
 * expired, revoked, unknown and archived, and all four are written where the decision is made — so
 * this component has no opinion about which one it is showing, which is exactly what stops a fifth
 * wording appearing here.
 *
 * **Already a member is a welcome, not an error** (v3 Req 38.7).
 *
 * The four states live in {@link Body} rather than in a ternary chain, which is `AccountRulesetHome`'s
 * shape and the reason is the same: a component that branches four ways is a component whose branches
 * are the thing to read.
 *
 * **Validates: v3 Req 38.1, 38.4, 38.7**
 */

import { Link } from '@tanstack/react-router';
import type { GameSessionSummary, InvitePreview } from '#shared/types/api';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { alertStyles, sectionStyles } from './sessions.style';
import { JOIN_OUTCOME, type JoinOutcome } from './useJoinSession';

export interface JoinSessionPanelProps {
  preview: InvitePreview | null;
  isPending: boolean;
  isBusy: boolean;
  error: string | null;
  outcome: JoinOutcome | null;
  session: GameSessionSummary | null;
  onJoin: () => void;
}

/** What to say once a seat is taken — the two outcomes read differently and should */
function welcome(outcome: JoinOutcome, name: string): string {
  return outcome === JOIN_OUTCOME.JOINED
    ? `You have joined “${name}”.`
    : `You are already at “${name}” — nothing changed.`;
}

/** The invitation, once the preview has landed and nothing has been decided */
function Invitation({
  preview,
  isBusy,
  onJoin,
}: Pick<JoinSessionPanelProps, 'isBusy' | 'onJoin'> & { preview: InvitePreview }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Text variant="body" as="p">
        You have been invited to <strong>“{preview.sessionName}”</strong>. You will join as a
        player.
      </Text>
      {preview.isJoinable ? (
        <Button variant="primary" disabled={isBusy} onClick={onJoin}>
          {isBusy ? 'Joining…' : 'Join this game'}
        </Button>
      ) : (
        <Text variant="warning" as="p">
          This game has been archived, so nobody new can join it.
        </Text>
      )}
    </div>
  );
}

/** What fills the card, given which of the four states it is in */
function Body({
  preview,
  isPending,
  isBusy,
  error,
  outcome,
  session,
  onJoin,
}: JoinSessionPanelProps) {
  if (outcome && session) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Text variant="success" as="p">
          {welcome(outcome, session.name)}
        </Text>
        <Link
          to="/sessions"
          className="font-heading text-sm text-royal underline underline-offset-4"
        >
          Go to your games
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className={alertStyles}>
        <Text variant="error" as="p">
          {error}
        </Text>
      </div>
    );
  }

  if (isPending) {
    return (
      <Text variant="caption" as="p">
        Checking that invitation…
      </Text>
    );
  }

  if (!preview) return null;

  return <Invitation preview={preview} isBusy={isBusy} onJoin={onJoin} />;
}

export function JoinSessionPanel(props: JoinSessionPanelProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-10">
      <Text variant="h1" as="h1">
        Join a game
      </Text>

      <Card className="p-6">
        <section className={sectionStyles}>
          <Body {...props} />
        </section>
      </Card>
    </div>
  );
}
