/**
 * Duplicating a ruleset so that the two share nothing (TICKET-RUL-03)
 *
 * **A helper rather than an inline `structuredClone`**, and that is the whole reason the module
 * exists: TICKET-GAM-01 takes a Snapshot, which is the same operation with a different destination,
 * and it must not reach for its own. One implementation, tested structurally — because the failure
 * this prevents is silent. A shallow copy of a `Configuration` looks right in every screenshot and
 * shares `curve.rows[].values`, `statWeights`, `statValues` and `dieSizes` by reference, so
 * retuning the copy retunes the original and nobody finds out until a table plays it.
 *
 * ## Entity ids are kept, not regenerated
 *
 * The interesting decision, and it goes the other way from what "make it independent" suggests.
 * Regenerating them would mean rewriting every id-resolved formula reference, every `statValues`
 * key, every `statWeights` row and every material modifier — a re-implementation of
 * [`references.ts`](../engine/formula/references.ts) with nothing to gain, because **an entity id
 * only ever has to be unique within a document**. Two rulesets holding a stat called `stat-speed`
 * are two rulesets, not a collision: nothing joins across them.
 *
 * What *is* replaced is the **ruleset's own** id, which is the one identity that leaves the
 * document — `POST /api/rulesets` stores it as the row's primary key.
 *
 * **Validates: v3 Req 34.1, 34.2, 34.3**
 */

import type { Configuration } from '../types/config';

/**
 * What a copy may be told about itself; everything else comes from the source
 *
 * **One option, because one caller passes one.** A draft had `id` and `now` beside it, and the
 * RUL-03 review was right that nothing outside the tests wanted either — `crypto.randomUUID()` and
 * the clock already cover every real call, and an option nothing passes is a promise this module
 * has not been asked to keep. GAM-01 is not a caller until it exists.
 */
export interface CopyOptions {
  /** What to call it. Defaults to {@link copyName} of the source's. */
  name?: string;
}

/**
 * What a copy is called by default
 *
 * Visibly a derivative rather than clever: the list is how a User tells two rulesets apart, and
 * silently reusing the name would leave them unable to. Repeated copying stacks — *"Ducklets (copy)
 * (copy)"* — which is ugly and honest, and is a better failure than *"Ducklets"* three times.
 *
 * @param name The source's name
 * @returns The copy's default name
 */
export function copyName(name: string): string {
  return `${name} (copy)`;
}

/**
 * An independent copy of a ruleset
 *
 * `structuredClone` is the shortest correct answer and is used deliberately: it is a deep copy the
 * platform performs, so it cannot miss a nested array the way a hand-written walker does the first
 * time somebody adds one.
 *
 * @param source The ruleset to copy. **Left completely unchanged** (v3 Req 34.3).
 * @param options What to call it; defaulted
 * @returns A `Configuration` sharing no object with `source`
 */
export function copyConfiguration(source: Configuration, options: CopyOptions = {}): Configuration {
  const copy = structuredClone(source);
  const now = new Date().toISOString();

  return {
    ...copy,
    id: crypto.randomUUID(),
    name: options.name ?? copyName(source.name),
    // Both, and the same moment: a copy was not *created* before it was copied, so a `createdAt`
    // inherited from the source would date it to the original's birthday
    createdAt: now,
    updatedAt: now,
  };
}
