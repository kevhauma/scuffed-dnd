/**
 * What the two runners print when the artefact refuses to do its job (TICKET-POL-03)
 *
 * `serve.mjs` and `backup.mjs` are both three-line doors into `dist/server/entry.js`, and both meet
 * the same three failures: there is no build yet, a required variable is missing, or something
 * named refused. Each had its own copy of the handling until `fallow dupes` reported them as one
 * clone — correctly, and the copies had already begun to differ, since only one of them knew about
 * a missing `dist/`.
 *
 * **The distinction it exists to draw**: a refusal is a *message an operator acts on*, and Node's
 * default handling buries it under a stack trace and a code frame of this repository's internals.
 * A bug is the opposite — the stack is the useful part. So a named refusal prints its sentence and
 * nothing else, and anything unnamed prints the sentence *and* the error.
 */

/**
 * The errors that are messages rather than bugs
 *
 * All three in one set rather than a set per runner: `MigrationError` cannot arise in a backup and
 * `BackupError` cannot arise while serving, and a name that cannot occur costs nothing to carry —
 * where two nearly-identical sets cost the next reader a comparison.
 */
const NAMED_REFUSALS = new Set(['MissingEnvironmentError', 'MigrationError', 'BackupError']);

/**
 * What was thrown, if it was an `Error` at all
 *
 * Asked **once** and bound, rather than three times inline. The first draft repeated
 * `error instanceof Error` in each of the three decisions below and `fallow health` scored the
 * result at 6 cyclomatic — for a function whose whole job is to print one of two things.
 *
 * @param {unknown} thrown What was caught
 * @returns {Error | null} The error, or `null` if something else was thrown
 */
function asError(thrown) {
  return thrown instanceof Error ? thrown : null;
}

/**
 * The sentence to show
 *
 * @param {Error | null} error The error, if it was one
 * @param {unknown} thrown What was actually caught
 * @returns {string} What to print
 */
function messageFor(error, thrown) {
  return error ? error.message : String(thrown);
}

/**
 * Whether this is one of the failures that explain themselves
 *
 * @param {Error | null} error The error, if it was one
 * @returns {boolean} True when its message is the whole story
 */
function isNamedRefusal(error) {
  return error !== null && NAMED_REFUSALS.has(error.name);
}

/**
 * Print a start-up failure the way an operator needs to read it
 *
 * **Three questions, asked by three named functions rather than inline.** The first draft asked all
 * of them here and `fallow health` scored it at 6 cyclomatic with a CRAP of 42 — for seventeen lines
 * whose job is to print one of two things. Each question now has a name that says what it is
 * deciding, which is what the split is actually worth.
 *
 * @param {unknown} thrown What went wrong
 */
export function reportRefusal(thrown) {
  const error = asError(thrown);

  // The one an operator meets first, and the one whose default is least helpful: four frames of
  // module resolution in place of *run `yarn build`*
  if (error?.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('\nThere is no build here yet. Run `yarn build` first.\n');
    return;
  }

  const message = messageFor(error, thrown);
  console.error(`\n${message}\n`);

  // The stack is printed after the sentence rather than instead of it, so the readable half is
  // still the first thing read — and only for a failure that is a bug rather than a message
  if (!isNamedRefusal(error)) console.error(thrown);
}
