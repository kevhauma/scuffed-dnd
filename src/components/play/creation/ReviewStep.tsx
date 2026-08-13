/**
 * Creation Step 4 — Review
 *
 * Every derived value, read from the composed calculator. No arithmetic happens here.
 *
 * **Validates: Requirements 11.5, 13.1, 21.1-21.5**
 */

import { numberOr } from '../../../engine/formula/errors';
import type { CalculatedCharacter } from '../../../types/character';
import type { Configuration, Stat } from '../../../types/config';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export interface ReviewStepProps {
  config: Configuration;
  /** The ruleset's stats in display order — decided by the hook, not re-derived here */
  stats: Stat[];
  characterName: string;
  raceNames: string[];
  preview: CalculatedCharacter | null;
  /** A formula in the ruleset that does not evaluate, described for display */
  previewError: string | null;
}

/** One label/value row of the derived summary */
function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-stone-200 py-1 last:border-b-0">
      <Text variant="body-small" as="span">
        {label}
      </Text>
      <Text variant="highlight" as="span">
        {value}
      </Text>
    </div>
  );
}

export function ReviewStep({
  config,
  stats,
  characterName,
  raceNames,
  preview,
  previewError,
}: ReviewStepProps) {
  // A broken formula must not be summarised as a confident zero, so the whole preview is
  // withheld rather than partly wrong (per-value chips arrive with TICKET-FORM-06).
  if (!preview || previewError) {
    return (
      <Card className="p-6">
        <Text variant="h4" as="h2" className="mb-2">
          Review
        </Text>
        <Text variant="error" as="p">
          The derived values cannot be calculated — this ruleset has a formula that does not
          evaluate. You can still create the character, but fix the ruleset in configuration mode
          before playing.
        </Text>
        {previewError && (
          <Text variant="body-small" as="p" className="mt-2 font-mono">
            {previewError}
          </Text>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <Text variant="h4" as="h2" className="mb-1">
          {characterName || 'Unnamed character'}
        </Text>
        <Text variant="body-small-secondary">
          {raceNames.length > 0 ? raceNames.join(', ') : 'No races'}
          {preview.focusStatCode && ` · focus: ${preview.focusStatCode}`}
        </Text>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <Text variant="h5" as="h3" className="mb-3">
            Stats
          </Text>
          {stats.length === 0 ? (
            <Text variant="body-small-secondary">No stats configured.</Text>
          ) : (
            stats.map((stat) => (
              <SummaryRow
                key={stat.id}
                label={`${stat.name} (${stat.abbreviation})`}
                value={numberOr(preview.statValues[stat.id], 0)}
              />
            ))
          )}
        </Card>

        <Card className="p-6">
          <Text variant="h5" as="h3" className="mb-3">
            Total
          </Text>
          <SummaryRow label="Stat total" value={preview.statTotal} />
        </Card>

        {config.skills.length > 0 && (
          <Card className="p-6">
            <Text variant="h5" as="h3" className="mb-3">
              Skills
            </Text>
            {config.skills.map((skill) => (
              <SummaryRow
                key={skill.id}
                label={skill.name}
                value={numberOr(preview.skillBonuses[skill.id], 0)}
              />
            ))}
          </Card>
        )}

        {config.combatSkills.length > 0 && (
          <Card className="p-6">
            <Text variant="h5" as="h3" className="mb-3">
              Combat Bonuses
            </Text>
            {config.combatSkills.map((skill) => (
              <SummaryRow
                key={skill.code}
                label={`${skill.name} (${skill.code})`}
                value={numberOr(preview.combatSkillBonuses[skill.code], 0)}
              />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
