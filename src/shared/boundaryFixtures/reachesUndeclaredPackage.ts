/**
 * Violates `no-undeclared-dependency` (TICKET-DX-08)
 *
 * `clsx` is in `node_modules` and is not in `package.json` — it is there because something else
 * depends on it. An import like this works until that something bumps a major or drops it, at
 * which point the breakage has no record anywhere in this repo.
 *
 * If this fixture ever stops resolving, that is the rule's own subject matter happening to the
 * fixture, and the failing test is the correct outcome: pick another transitive package.
 */

import clsx from 'clsx';

export const anUndeclaredImport = clsx;
