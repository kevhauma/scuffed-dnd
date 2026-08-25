/**
 * Class strings for the linked-identities list (TICKET-AUTH-02)
 *
 * One row per provider, on parchment. The linked marker is `forest` rather than a tick glyph
 * because the list has to read at a glance as *what can get me back in*, and colour does that
 * faster than an icon does.
 */

/** One provider's row: its name on the left, its state or its button on the right */
export const identityRowStyles = [
  'flex flex-wrap items-center justify-between gap-3',
  'rounded border border-brass-dark/40 bg-parchment-100 px-3 py-2',
].join(' ');

/** *Linked* — stated, not iconified */
export const linkedMarkerStyles = 'font-heading text-sm tracking-wide text-forest';
