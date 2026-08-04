/**
 * Error Chip
 *
 * A compact crimson marker that stands in for a value that could not be calculated, so one broken
 * formula costs the reader that one number rather than the whole surface (Concept 00 §7).
 *
 * Deliberately generic: it takes plain strings, not a `FormulaError`. Callers turn an error value
 * into words with `describeFormulaError` and place the chip; that keeps the primitive free of the
 * engine and reusable for anything else that fails to compute.
 *
 * **Validates: Requirements 16.6, 21.1, 21.2, 21.3, 22.1**
 */

import { Text } from '../Text/Text';
import { containerStyles, iconStyles } from './ErrorChip.style';

export interface ErrorChipProps {
  /** Short text on the chip itself, naming what is unavailable */
  label?: string;
  /** The full explanation, reachable by hover, keyboard focus, and assistive technology */
  detail: string;
  className?: string;
}

export function ErrorChip({ label = 'error', detail, className = '' }: ErrorChipProps) {
  return (
    <span
      className={`${containerStyles} ${className}`}
      title={detail}
      // `role="img"` makes the chip a single labelled node — a bare span cannot carry an
      // accessible name. That flattens the visible label away, so it is folded into the name
      // rather than lost.
      //
      // Deliberately not focusable: a tab stop on a non-interactive element is its own
      // accessibility problem, and the lint rule that forbids it is right. The consequence is
      // that `title` reaches a mouse but not a sighted keyboard-only user — the detail is
      // complete in the accessible name, and a persistent-detail treatment belongs with the
      // provenance-tree UI Concept 00 §7 describes, not with this marker.
      role="img"
      aria-label={`${label}: ${detail}`}
    >
      <span aria-hidden="true" className={iconStyles}>
        !
      </span>
      <Text variant="caption" as="span">
        {label}
      </Text>
    </span>
  );
}
