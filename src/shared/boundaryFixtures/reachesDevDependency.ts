/**
 * Violates `no-dev-dep-in-production` (TICKET-DX-08)
 *
 * `fast-check` is a devDependency and is used correctly by a dozen property tests. This module is
 * not a test, so importing it here is the mistake the rule exists for: it resolves on this machine
 * and is absent from a production install, which is the worst place to discover a missing package.
 *
 * fallow would report the same thing from the other direction and would be right, which is why
 * `.fallowrc.jsonc` drops `boundaryFixtures/` from its analysis entirely rather than arguing with
 * it file by file.
 */

import fc from 'fast-check';

export const anArbitraryInShippedCode = fc.integer;
