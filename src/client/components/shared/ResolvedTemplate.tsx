/**
 * Resolved Template
 *
 * Template text with its placeholders filled in — prose and numbers in one line, and an error chip
 * wherever a number could not be worked out (v4 D4, TICKET-SPL-03).
 *
 * **The one rendering of a resolved template**, drawn by the spells panel's preview and by a
 * Player's Spellbook. Two spellings of *how a resolved effect reads* would eventually disagree
 * about the very thing the preview exists to promise: that what a User is shown while authoring is
 * what a Player is shown at the table.
 *
 * **An unresolvable placeholder chips rather than blanking the sentence** (Concept 00 §7). A spell
 * whose damage term names a deleted stat still says everything else it said — the reader loses one
 * number, learns which one, and can act on it. `describeFormulaError` writes the detail, so the
 * chip's wording is the engine's rather than this component's.
 *
 * In `components/shared/` rather than under `config/` or `play/` because it is drawn by both roots
 * of the app's own UI — the same reason `StatModifierBadges` lives here.
 *
 * **Validates: v4 systems/13 gap 4; Requirements 16.6, 21.1-21.5**
 */

import { asNumber, describeFormulaError, isFormulaError } from '#shared/engine/formula/errors';
import type { ResolvedSegment } from '#shared/engine/formula/template';
import { readable } from '../play/shared/readableNumber';
import { ErrorChip } from '../ui/ErrorChip/ErrorChip';
import { Text } from '../ui/Text/Text';

export interface ResolvedTemplateProps {
  segments: ResolvedSegment[];
  className?: string;
}

export function ResolvedTemplate({ segments, className = '' }: ResolvedTemplateProps) {
  return (
    <Text variant="body-small" as="p" className={className}>
      {segments.map((segment, index) => {
        // The index is the key, and it is the right one here: a segment has no identity of its own
        // — it *is* its position in one string — and two placeholders reading the same stat are
        // genuinely the same value in two places.
        const key = `${index}-${segment.kind}`;

        if (segment.kind === 'text') return <span key={key}>{segment.text}</span>;

        if (isFormulaError(segment.result)) {
          const detail = describeFormulaError(segment.result);

          return <ErrorChip key={key} label={segment.source} detail={detail} className="mx-1" />;
        }

        const value = asNumber(segment.result);

        return <span key={key}>{value === undefined ? '—' : readable(value)}</span>;
      })}
    </Text>
  );
}
