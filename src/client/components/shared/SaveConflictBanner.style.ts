/**
 * Class strings for the refused-ruleset banner (TICKET-RUL-02)
 *
 * A sibling `.style.ts` because the conventions ask for one — `StorageFailureBanner` next door
 * keeps its two class strings inline, which is drift this file declines to copy rather than a
 * precedent it follows.
 */

/** The message on the left, the way out of it on the right, wrapping on a narrow screen */
export const alertRowStyles = 'flex flex-wrap items-start justify-between gap-4';

/** What the server refused, listed in its own words */
export const refusedFieldListStyles = 'mt-2 flex list-disc flex-col gap-1 pl-4';
