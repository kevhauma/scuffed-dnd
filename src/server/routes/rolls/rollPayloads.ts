/**
 * What the two roll routes share (TICKET-ROLL-07)
 *
 * **A folder of its own rather than a twelfth module in `routes/play/`**, and the split is real. Every
 * route there is a *write to the sheet*: it takes a `PLAYER_ACTION`, applies a Kernel rule, and
 * records a before and an after. A roll writes nothing to the character — it happens, and what it
 * produced is the whole `RollOutcome`. `routes/play/playerRules.test.ts` says in as many words that
 * a module there takes its rule from `playerActions.ts` and reaches nothing in `#shared/engine/`
 * directly; a roll's rule *is* the dice engine, so it belongs on the other side of that line rather
 * than as an exception to it.
 *
 * **Validates: v3 Req 41.6, 45.2**
 */

import { describeFormulaError, isFormulaError } from '#shared/engine/formula/errors';
import type { RollLogPayload, SessionRoll } from '#shared/types/api';
import type { FormulaError, RollOutcome } from '#shared/types/formula';
import { badRequest } from '../../http/appError';
import type { EventRow } from '../../repositories/eventRepository';

/**
 * The fields a **result** is made of, which a client therefore may not send
 *
 * `characterPayloads`' `DERIVED_FIELDS` one aggregate over, and for the sharper reason: a stat value
 * a client invents is a claim about arithmetic anybody can redo, and a die a client invents is a
 * claim nobody can check. The refusal names the field rather than stripping it, because a client
 * that sent `total: 20` and got a 200 has every reason to believe the 20 was honoured.
 */
const RESULT_FIELDS: (keyof RollOutcome | 'results' | 'pool')[] = [
  // Every field of the outcome except the one a client is *supposed* to send. Typed against
  // `RollOutcome` rather than listed by hand, which the review found mattered: the first draft named
  // `results` and `pool` — which are not fields of it — and omitted `rollName` and `timestamp`,
  // which are, so a body carrying a timestamp got a 200 and a server-chosen one. Adding a field to
  // the outcome is now a compile error here rather than a hole.
  'rollName',
  'input',
  'dice',
  'diceTotal',
  'flat',
  'total',
  'notation',
  'timestamp',
  // …plus the two spellings the ticket used, which no shape has but a client might reasonably send
  'results',
  'pool',
];

/**
 * Which roll a request asked for (v3 Req 45.2)
 *
 * @param body Whatever arrived
 * @returns The roll's id
 * @throws {AppError} 400 naming the first result field it carried, or a missing `rollId`
 */
export function rollIdFrom(body: unknown): string {
  const sent = (body ?? {}) as Record<string, unknown>;

  const result = RESULT_FIELDS.find((field) => sent[field] !== undefined);

  if (result !== undefined) {
    throw badRequest(
      `A roll's ${result} is worked out by the server, so it cannot be sent. Send only which roll ` +
        'to make.'
    );
  }

  const rollId = sent.rollId;

  if (typeof rollId !== 'string' || rollId.trim() === '') {
    throw badRequest('A roll needs a rollId.');
  }

  return rollId;
}

/**
 * Turn a roll the engine refused into a refusal a Player can read
 *
 * A roll whose input does not evaluate, or whose ladder has been deleted, comes back as a
 * `FormulaError` rather than as zero dice (Concept 00 §7) — so the route answers **400** with the
 * engine's own description rather than logging a roll that did not happen.
 *
 * @param outcome What the engine produced
 * @returns The outcome, now known to be a real roll
 * @throws {AppError} 400 describing why there were no dice
 */
export function rolledOrRefused(outcome: RollOutcome | FormulaError): RollOutcome {
  if (isFormulaError(outcome)) throw badRequest(describeFormulaError(outcome));

  return outcome;
}

/**
 * What one logged roll looks like on the wire
 *
 * **The payload is passed in rather than parsed here**, because the caller has already parsed it to
 * find out whose roll it was — the review caught this parsing the same string twice per row.
 *
 * @param row The Event
 * @param payload What that Event stored, already parsed
 * @param names Resolved at read time, so a rename does not rewrite the past
 * @returns The roll as a Member reads it
 */
export function toSessionRoll(
  row: Pick<EventRow, 'id' | 'seq'>,
  payload: RollLogPayload,
  names: { characterName: string; rolledBy: string | null }
): SessionRoll {
  return {
    ...payload.outcome,
    id: row.id,
    seq: row.seq,
    characterId: payload.characterId,
    characterName: names.characterName,
    rolledBy: names.rolledBy,
  };
}
