/**
 * Which handler answers a request, and whether one should at all (TICKET-SRV-01)
 *
 * The server entry hands every request here first. Anything outside {@link API_PREFIX} comes back
 * as `null` and falls through to TanStack Start's SSR handler — one process serving the client
 * bundle, the API and (from LIVE-01) the socket, which is D1's whole point.
 *
 * **Two tables, because there are two kinds of path** (TICKET-RUL-01). Most routes are a literal
 * string and are looked up in a map. `/api/rulesets/:id` is not, so {@link PATTERN_ROUTES} matches
 * by segment shape — checked only when the exact table misses, so the common path stays a map
 * lookup. The matcher is deliberately the smallest thing that works: one parameter per segment,
 * no optional segments, no regular expressions, no wildcards. A router with features no route uses
 * is a router nobody can predict.
 *
 * **A matched parameter is not handed to the handler**, which reads it back off `context.url`. The
 * alternative was a `params` channel through `RequestScope`, and `pipeline.test.ts` asserts that
 * exactly two modules name that type — it is the seam that lets a caller say *who is asking*, and
 * widening it to carry path segments would trade a real security guard for a convenience.
 *
 * **Validates: v3 Req 47.6**
 */

import { AUTH_PREFIX, handleAuthRequest } from '../auth/authRoutes';
import { authProviders } from '../routes/authProviders';
import { deleteCharacter, listMyCharacters, readCharacter } from '../routes/characters';
import {
  dmAdjustPurse,
  dmAwardExperience,
  dmBuildItem,
  dmDeductExperience,
  dmDropItem,
  dmEquipItem,
  dmGrantPassive,
  dmGrantPoints,
  dmRevokePassive,
  dmSetDreamLevel,
  dmSetLevel,
  dmSetPurse,
  dmSetResource,
  dmUnequipItem,
  listAdjustments,
} from '../routes/dm';
import { health } from '../routes/health';
import {
  acceptInvitation,
  declineInvitation,
  listInvitations,
  revokeInvitation,
} from '../routes/invitations';
import { previewInvite, redeemInvite } from '../routes/invites';
import {
  adjustResource,
  buildItem,
  castSpell,
  dropItem,
  equipItem,
  investSkillPoints,
  investStatPoints,
  learnSpell,
  resetResource,
  setFocusSkills,
  setResource,
  unequipItem,
  unlearnSpell,
} from '../routes/play';
import { listRolls, rollDice } from '../routes/rolls';
import {
  copyRuleset,
  createRuleset,
  deleteRuleset,
  getRuleset,
  importRuleset,
  listRulesets,
  renameRuleset,
  saveRuleset,
} from '../routes/rulesets';
import {
  archiveSession,
  createCharacter,
  createSession,
  inviteByEmail,
  issueInvite,
  listCharacters,
  listMembers,
  listSessionInvites,
  listSessions,
  readSession,
  refreshSnapshot,
  removeMember,
  revokeInvite,
  transferDm,
} from '../routes/sessions';
import { uploadPrompt } from '../routes/uploadPrompt';
import { methodNotAllowed, notFound } from './appError';
import { defineHandler } from './pipeline';

/** Everything under here is the API; everything else is the app */
export const API_PREFIX = '/api/';

/**
 * The route table, keyed `METHOD /path`
 *
 * A plain object rather than a registration call: the whole API is readable in one place, and a
 * route that exists is a line here rather than a side effect of importing a file.
 *
 * Typed as *request in, response out* rather than as {@link Route}, and deliberately so: a
 * `Route`'s second parameter is a test seam (TICKET-DX-06), and narrowing the table's type is what
 * makes it a compile error for anything here to reach for it.
 */
export const ROUTES: Record<string, (request: Request) => Promise<Response>> = {
  'GET /api/health': health,
  // Not `/api/auth/providers`: the whole `/api/auth` subtree is handed to Better Auth above,
  // before this table is consulted, so a path under it would never be reached (TICKET-AUTH-02)
  'GET /api/auth-providers': authProviders,
  'GET /api/rulesets': listRulesets,
  'POST /api/rulesets': createRuleset,
  // A literal path in the **exact** table, and it has to be: `POST /api/rulesets/:id` is not a route,
  // so a pattern-only lookup would answer this 405. Exact matches are tried first, which also means
  // this cannot be shadowed by a ruleset that happens to be called `import` (TICKET-IO-04)
  'POST /api/rulesets/import': importRuleset,
  'POST /api/account/upload-prompt': uploadPrompt,
  'GET /api/sessions': listSessions,
  'POST /api/sessions': createSession,
  // Scoped to the caller's own email address rather than to a session — an invitee is not a Member
  // of the table that wrote to them, so there is no session id they could put in this path
  // (TICKET-GAM-03)
  'GET /api/invitations': listInvitations,
  // Also scoped to the caller: the characters they uploaded, which sit at no table and are reached
  // through no session (TICKET-CHAR-04)
  'GET /api/characters': listMyCharacters,
};

/**
 * The routes whose path names a resource, keyed `METHOD /path/with/:parameter`
 *
 * Separate from {@link ROUTES} rather than mixed into it, so the cost of pattern matching is paid
 * only by the requests that need it and so the exact table stays a map lookup that cannot surprise
 * anyone.
 */
export const PATTERN_ROUTES: Record<string, (request: Request) => Promise<Response>> = {
  'GET /api/rulesets/:id': getRuleset,
  'PUT /api/rulesets/:id': saveRuleset,
  'PATCH /api/rulesets/:id': renameRuleset,
  'DELETE /api/rulesets/:id': deleteRuleset,
  'POST /api/rulesets/:id/copy': copyRuleset,
  'GET /api/sessions/:id': readSession,
  'POST /api/sessions/:id/archive': archiveSession,
  'POST /api/sessions/:id/snapshot': refreshSnapshot,
  'POST /api/sessions/:id/invite': issueInvite,
  'DELETE /api/sessions/:id/invite': revokeInvite,
  // Addressed invitations — the DM's half, which is about *this table's* outbox (TICKET-GAM-03).
  // `invite` and `invitations` are different collections rather than a singular and a plural: one
  // is the session's shared door, the other is the letters it has sent.
  'POST /api/sessions/:id/invitations': inviteByEmail,
  'GET /api/sessions/:id/invitations': listSessionInvites,
  // Membership (TICKET-GAM-04). Removing and leaving are one route because they are one act with
  // two actors — who may ask is three comparisons in the handler, not a second path
  'GET /api/sessions/:id/members': listMembers,
  'DELETE /api/sessions/:id/members/:accountId': removeMember,
  // The **role**, not a person: `POST` sets who runs this table, and the outgoing DM stays at it
  'POST /api/sessions/:id/dm': transferDm,
  // Characters belong to the table they were built against (TICKET-CHAR-04), so they are reached
  // through it — every Member reads them all, and `DELETE /api/characters/:id` is deliberately not
  // the same collection: it removes an **uploaded** character, which is at no table at all
  'POST /api/sessions/:id/characters': createCharacter,
  'GET /api/sessions/:id/characters': listCharacters,
  'GET /api/characters/:id': readCharacter,
  'DELETE /api/characters/:id': deleteCharacter,
  // The player's own writes (TICKET-PLY-01). Each path's last segment **is** the `PLAYER_ACTION`
  // value it performs, so a route, the Event type it appends and the client call that reaches it are
  // one spelling rather than three that have to be kept in step. Deliberately not one
  // `PATCH /api/characters/:id` taking a patch: a named intent is what makes the Event log readable,
  // and what stops a client sending a field the engine owns.
  'POST /api/characters/:id/invest-stat-points': investStatPoints,
  'POST /api/characters/:id/invest-skill-points': investSkillPoints,
  'POST /api/characters/:id/set-focus-skills': setFocusSkills,
  'POST /api/characters/:id/set-resource': setResource,
  'POST /api/characters/:id/adjust-resource': adjustResource,
  'POST /api/characters/:id/reset-resource': resetResource,
  'POST /api/characters/:id/equip-item': equipItem,
  'POST /api/characters/:id/unequip-item': unequipItem,
  'POST /api/characters/:id/build-item': buildItem,
  'POST /api/characters/:id/drop-item': dropItem,
  // Spells unlock by hand and a cast is a resource spend (TICKET-SPL-02) — three more of the same
  // kind of write, which is why they need no new surface: `learn`/`unlearn` set the sheet's own
  // `locked`/`Learned` flag, and `cast-spell` ends in the same `adjustResourceValue` the two
  // resource routes above reach
  'POST /api/characters/:id/learn-spell': learnSpell,
  'POST /api/characters/:id/unlearn-spell': unlearnSpell,
  'POST /api/characters/:id/cast-spell': castSpell,
  // The dice are the server's (TICKET-ROLL-07). Beside the ten above because it is the same kind
  // of request — a Player acting on their own character — even though it writes an Event and not
  // the sheet. The path names the **character**, not the session, so a request cannot disagree with
  // itself about which table it is at; the row already says.
  // The DM's writes to somebody else's sheet (TICKET-DM-01). Same collection as the ten above,
  // and the `dm-` prefix is not decoration: the Event log holds both kinds in one `type` column, so
  // a DM's *set-resource* and a Player's have to be tellable apart by a reader six months later —
  // and the path, the Event type and the client call stay one spelling, as PLY-01 established.
  'POST /api/characters/:id/dm-award-experience': dmAwardExperience,
  'POST /api/characters/:id/dm-deduct-experience': dmDeductExperience,
  // The body names a level and the server stores **experience** — see the route's own note
  'POST /api/characters/:id/dm-set-level': dmSetLevel,
  'POST /api/characters/:id/dm-grant-points': dmGrantPoints,
  'POST /api/characters/:id/dm-set-resource': dmSetResource,
  // …and this body names a dream level and stores exactly that: player state nothing derives
  // (TICKET-RES-04), which is why it is the one `dm-set-*` whose before/after is what was typed
  'POST /api/characters/:id/dm-set-dream-level': dmSetDreamLevel,
  // The passive handout (TICKET-PAS-01) — a pair rather than one whole-list write, because the
  // revoke deliberately consults no ruleset and so can clear an id the catalog has lost. **There is
  // no player counterpart to either**, which is what puts the handout behind the DM's guard at a
  // table while the local sheet keeps writing the field itself (there is no DM signed out).
  'POST /api/characters/:id/dm-grant-passive': dmGrantPassive,
  'POST /api/characters/:id/dm-revoke-passive': dmRevokePassive,
  // The money and the pack (TICKET-DM-02), which complete v3 Req 42.5. **There is no player
  // counterpart to the purse pair** — a purse at a table is the DM's, as experience is — while the
  // four inventory routes each shadow one of the Player's own above, differing in the guard and the
  // Event type and in nothing else: the Kernel rule behind each is the identical function, so a
  // helmet does not fit a boot slot for a DM either
  'POST /api/characters/:id/dm-set-purse': dmSetPurse,
  'POST /api/characters/:id/dm-adjust-purse': dmAdjustPurse,
  'POST /api/characters/:id/dm-build-item': dmBuildItem,
  'POST /api/characters/:id/dm-drop-item': dmDropItem,
  'POST /api/characters/:id/dm-equip-item': dmEquipItem,
  'POST /api/characters/:id/dm-unequip-item': dmUnequipItem,
  // …and what a Player reads back about their own sheet (v3 Req 42.7). A *read* rather than an
  // action, so it is a `GET` and its noun is what happened rather than what to do
  'GET /api/characters/:id/adjustments': listAdjustments,
  'POST /api/characters/:id/roll': rollDice,
  // …and the log is the table's, so that half is session-scoped and every Member reads it
  'GET /api/sessions/:id/rolls': listRolls,
  // …and the invitee's half, addressed by the invitation's own id
  'POST /api/invitations/:id/accept': acceptInvitation,
  'POST /api/invitations/:id/decline': declineInvitation,
  'DELETE /api/invitations/:id': revokeInvitation,
  // The two routes reached without a membership — redeeming a code is how one begins (TICKET-GAM-02)
  'GET /api/invites/:code': previewInvite,
  'POST /api/invites/:code': redeemInvite,
};

/** The path half of a `METHOD /path` key */
function patternOf(key: string): string {
  return key.split(' ')[1] ?? '';
}

/** A path split into its segments, with the leading empty one dropped */
function segments(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '');
}

/**
 * Whether a concrete path is what a pattern describes
 *
 * A `:name` segment matches exactly one non-empty segment. Everything else is compared literally.
 *
 * @param pattern The pattern half of a {@link PATTERN_ROUTES} key
 * @param pathname The path that arrived
 * @returns True when the two have the same shape
 */
function matchesPattern(pattern: string, pathname: string): boolean {
  const expected = segments(pattern);
  const actual = segments(pathname);

  if (expected.length !== actual.length) return false;

  return expected.every((segment, index) => segment.startsWith(':') || segment === actual[index]);
}

/** The literal paths the exact table answers, whatever the method — built once, not per request */
const KNOWN_PATHS = new Set(Object.keys(ROUTES).map(patternOf));

/** The patterns the other table answers, likewise */
const KNOWN_PATTERNS = [...new Set(Object.keys(PATTERN_ROUTES).map(patternOf))];

/** The paths either table answers, whatever the method — patterns matched by shape */
function pathIsKnown(pathname: string): boolean {
  return (
    KNOWN_PATHS.has(pathname) || KNOWN_PATTERNS.some((pattern) => matchesPattern(pattern, pathname))
  );
}

/**
 * The handler for a request, if there is one
 *
 * @param method The method to look up as — `HEAD` has already become `GET`
 * @param pathname The path that arrived
 * @returns The route, or `undefined` when nothing answers this method at this path
 */
function findRoute(
  method: string,
  pathname: string
): ((request: Request) => Promise<Response>) | undefined {
  const exact = ROUTES[`${method} ${pathname}`];
  if (exact) return exact;

  const key = Object.keys(PATTERN_ROUTES).find(
    (candidate) =>
      candidate.startsWith(`${method} `) && matchesPattern(patternOf(candidate), pathname)
  );

  return key ? PATTERN_ROUTES[key] : undefined;
}

/**
 * What a request is looked up as
 *
 * `HEAD` is answered by the `GET` route — that is what HEAD *is*, and uptime probes and load
 * balancers use it. The body is dropped below rather than by the handler, so no route has to know.
 */
function lookupMethod(method: string): string {
  return method === 'HEAD' ? 'GET' : method;
}

/**
 * Answer an API request, or decline to
 *
 * @param request The incoming request
 * @returns A response, or `null` when this is not an API request at all
 */
export async function handleApiRequest(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(API_PREFIX)) return null;

  // Better Auth owns a whole subtree rather than a list of paths, and its handler already produces
  // a finished `Response` with `Set-Cookie` on it (TICKET-AUTH-01). It is matched before the table
  // for that reason: there is nothing here to route, only a prefix to hand over.
  if (pathname === AUTH_PREFIX || pathname.startsWith(`${AUTH_PREFIX}/`)) {
    return handleAuthRequest(request);
  }

  const route = findRoute(lookupMethod(request.method), pathname);

  if (route) {
    const response = await route(request);
    // A HEAD response carries the headers and none of the body
    return request.method === 'HEAD'
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  }

  // A known path with the wrong verb is a different mistake from a path that does not exist, and
  // saying so costs nothing here — no authorization has run yet, so neither answer leaks anything.
  // Neither message repeats the path or the method back: the status carries the meaning, and an
  // unbounded echo of attacker-controlled text into a response body earns nothing.
  return defineHandler(() => {
    throw pathIsKnown(pathname)
      ? methodNotAllowed('That method is not allowed on this path.')
      : notFound('No API route matches that path.');
  })(request);
}
