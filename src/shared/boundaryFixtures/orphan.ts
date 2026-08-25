/**
 * Violates `no-orphans` (TICKET-DX-08)
 *
 * Imported by nothing, on purpose. `no-orphans` is the one rule that reports as a **warning**, so
 * this fixture also proves that a warning still reaches the report rather than being filtered out
 * on its way there.
 */

export const NOBODY_IMPORTS_THIS = 'and that is the point';
