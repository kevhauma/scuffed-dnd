/**
 * Curve Grid Styles
 *
 * The one thing carrying meaning rather than decoration is `overriddenCellInputStyles`: Concept 06
 * says cells that differ from the generator are highlighted *always*, because that highlight is
 * the feature that would have caught all four of the source sheet's anomalies. It is amber — the
 * theme's "look at this" tone — rather than crimson, which reads as broken.
 */

export const tableStyles = 'w-full border-collapse text-left';

export const headerCellStyles = 'p-2 border-b border-stone-300 align-bottom';

export const keyCellStyles = 'p-2 border-b border-stone-200 font-mono text-ink-800';

export const cellStyles = 'p-2 border-b border-stone-200 align-top';

export const cellInputStyles = 'w-24 font-mono';

/** A hand-tuned cell — deviating from its generator on purpose */
export const overriddenCellInputStyles = 'w-24 font-mono bg-amber/20 border-amber';
