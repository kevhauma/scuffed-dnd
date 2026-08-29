/**
 * Character Summary Line
 *
 * The one-line "Level 3 · Dream level 1 · 900 XP · Elf, Human · Ranger" a character is identified
 * by, shared by the sheet header and the character list card (CR-27) so the two cannot drift about
 * how a level that failed to derive is shown.
 *
 * The level is curve-derived since TICKET-RES-01, so it can fail — a ruleset with no
 * `xp_thresholds` curve chips here rather than claiming everyone is level 1.
 *
 * **Validates: Requirements 11.1, 8.5, 21.1-21.5**
 */

import { ErrorChip } from '../../ui/ErrorChip/ErrorChip';
import { Text } from '../../ui/Text/Text';
import type { DerivedValue } from './derivedValue';

export interface CharacterSummaryLineProps {
  /** Curve-derived, so it can fail — an unavailable level chips in place of the number */
  level: DerivedValue;
  raceNames: string[];
  /**
   * How far the character stands in their dream, shown beside the level (TICKET-RES-04)
   *
   * Optional for `experience`'s reason rather than because a character might not have one — every
   * character has one, absent-means-1 — but only the sheet's identity block has room to say so. A
   * list card is scanned, and the sheet is what the workbook prints it on.
   */
  dreamLevel?: number;
  /** Shown after the level where the surface has room for it (the sheet header) */
  experience?: number;
  /** The character's archetype, by name — what replaced the focus stat (TICKET-ARC-03) */
  archetypeName?: string;
  /**
   * What to say when the character has no races. Omit to drop the segment entirely, which is the
   * list card's choice: a card is scanned, and "No races" is noise there but information on the
   * sheet the Player is editing.
   */
  noRacesLabel?: string;
}

export function CharacterSummaryLine({
  level,
  raceNames,
  dreamLevel,
  experience,
  archetypeName,
  noRacesLabel,
}: CharacterSummaryLineProps) {
  const segments = [
    // First, because the workbook's identity block prints the two levels together
    dreamLevel !== undefined ? `Dream level ${dreamLevel}` : undefined,
    experience !== undefined ? `${experience} XP` : undefined,
    raceNames.length > 0 ? raceNames.join(', ') : noRacesLabel,
    archetypeName,
  ].filter((segment): segment is string => Boolean(segment));

  return (
    <Text variant="body-small-secondary" as="span">
      {level.error === null ? `Level ${level.value}` : 'Level '}
      {level.error !== null && <ErrorChip label="unavailable" detail={level.error} />}
      {segments.map((segment) => ` · ${segment}`).join('')}
    </Text>
  );
}
