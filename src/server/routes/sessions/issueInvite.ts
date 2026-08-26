/**
 * `POST /api/sessions/:id/invite` — hand the table a code (TICKET-GAM-02)
 *
 * **Issuing and reissuing are one route**, because they are one act: a DM who wants a new code wants
 * the old one to stop working, and `issueSessionInvite` revokes and inserts in one transaction so
 * there is never a moment with two live codes or none.
 *
 * **The DM's alone** (v3 Req 38.1). A player who could mint an invitation could seat the table's
 * next member, which is the DM's decision.
 *
 * **Refused on an archived session**, through the same `requireActive` every other write uses —
 * inviting somebody to a game that has ended is not a thing to let happen quietly.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 37.5, 38.1, 38.2**
 */

import type { SessionInvite } from '#shared/types/api';
import { requireDM } from '../../auth/guards';
import { notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { findGameSession } from '../../repositories/gameSessionRepository';
import { issueSessionInvite } from '../../repositories/sessionInviteRepository';
import { formatInviteCode, generateInviteCode } from '../invites/inviteCode';
import { requireActive, sessionIdFrom } from './sessionPayloads';

/**
 * How long a code lives
 *
 * Long enough that a DM can hand it out on Monday for a game on Saturday and nobody has to think
 * about it; short enough that a code pasted into a group chat two years ago is not a way in. It is
 * not configurable for `redemptionLimit`'s reason — nobody tunes this, and a variable is one more
 * thing to set wrong.
 */
const INVITE_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

export const issueInvite = defineHandler((context): SessionInvite => {
  const sessionId = sessionIdFrom(context.url);
  requireDM(context, sessionId);

  const row = findGameSession(sessionId);
  if (!row) throw notFound();

  requireActive(row);

  const now = Date.now();

  const invite = issueSessionInvite({
    id: crypto.randomUUID(),
    sessionId,
    // **Stored in the normal form**, so the comparison at redemption is between two normal forms
    // rather than between a normal form and whatever shape the database happens to hold
    code: generateInviteCode(),
    expiresAt: now + INVITE_LIFETIME_MS,
    now,
  });

  // Hyphenated on the way out, because that is the form a human reads aloud
  return { code: formatInviteCode(invite.code), expiresAt: invite.expiresAt };
});
