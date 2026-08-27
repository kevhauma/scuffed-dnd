/**
 * `POST /api/characters/:id/roll` — the dice are the server's (TICKET-ROLL-07)
 *
 * **The randomness moves and nothing else does.** `rollRollDefinition` stays exactly where it is,
 * keeps its injectable `RandomSource`, and the server becomes its caller — which is v3 Req 45.2 in
 * one sentence. What changes is that a client-submitted result is now invalid input.
 *
 * ## Why the path names the character and not the session
 *
 * The ticket drafted this as `POST /api/sessions/:id/characters/:cid/roll`. It is at
 * `/api/characters/:id/roll` instead, beside TICKET-PLY-01's eleven, because the session is a fact
 * the **row** already carries: taking it from the path as well would create a request that can
 * disagree with itself — session A in the URL, a character belonging to session B — and a check to
 * catch that is a check somebody has to remember. `redeemInvite` refuses to spell `sessionId` for
 * the same reason. Nothing about the behaviour differs; the divergence is recorded on the ticket.
 *
 * ## The character is recomputed, never accepted
 *
 * `calculateCharacter` runs here against the **Snapshot**, so `rollInputs` is the server's own
 * arithmetic. Trusting a client-supplied `CalculatedCharacter` would hand the Player a roll bonus
 * field, which is the ticket's own note.
 *
 * **A DM rolling for a player is out of scope** and this says so by using `requireCharacterPlayer`:
 * a Player rolls their own.
 *
 * **Validates: v3 Req 32.4, 41.6, 45.1, 45.2**
 */

import { calculateCharacter } from '#shared/engine/calculator';
import type { RandomSource } from '#shared/engine/dice/diceSimulator';
import { rollRollDefinition } from '#shared/engine/dice/rollDefinition';
import { ROLL_EVENT, type RollRequest, type SessionRoll } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { badRequest } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { findAccountById } from '../../repositories/accountRepository';
import { appendEvent } from '../../repositories/eventRepository';
import { characterIdFrom } from '../characters/characterPayloads';
import { playedAt, playerStateOf } from '../play/playPayloads';
import { type RollLogPayload, rolledOrRefused, rollIdFrom, toSessionRoll } from './rollPayloads';

/**
 * Build the handler, with the randomness a test can replace (v3 Req 45.3)
 *
 * **A factory rather than a module-level seam**, which is the shape the Kernel already uses: the
 * engine takes its `RandomSource` as a defaulted parameter, and this passes one down. A test builds
 * its own handler with a seeded source, so no test ever spies on `Math.random` — the rule
 * TICKET-ROLL-04 set and this keeps.
 *
 * @param rng Source of randomness; defaults to the engine's own
 * @returns The route
 */
export function rollDiceHandler(rng: RandomSource = Math.random) {
  return defineHandler(async (context): Promise<SessionRoll> => {
    const account = requireAccount(context);

    const rollId = rollIdFrom(await context.json<RollRequest>());

    // Guarded after the body for `playPayloads`' reason — nothing suspends between this and the
    // append, so a burst of rolls cannot interleave their sequence numbers
    const row = requireCharacterPlayer(context, characterIdFrom(context.url));
    const { sessionId, rules } = playedAt(row);

    const roll = (rules.rollDefinitions ?? []).find((candidate) => candidate.id === rollId);
    if (!roll) throw badRequest('This game has no such roll.');

    // Recomputed here, never accepted: `rollInputs` is what the pool is decomposed from, so a
    // client that could supply it could supply its own dice
    const calculated = calculateCharacter(playerStateOf(row), rules);
    const outcome = rolledOrRefused(rollRollDefinition(roll, calculated, rules, rng));

    const payload: RollLogPayload = { characterId: row.id, outcome };

    const logged = appendEvent({
      id: crypto.randomUUID(),
      sessionId,
      actorAccountId: account.id,
      type: ROLL_EVENT,
      payload: JSON.stringify(payload),
      now: Date.now(),
    });

    // **The logged entry, not the bare outcome.** The review found the client re-reading the whole
    // log after every roll for the one row it had just created — a round trip per roll, and a window
    // in which the sheet showed a result its own history did not have. The Event row is right here.
    return toSessionRoll(logged, payload, {
      characterName: row.name,
      rolledBy: findAccountById(account.id)?.name ?? null,
    });
  });
}

export const rollDice = rollDiceHandler();
