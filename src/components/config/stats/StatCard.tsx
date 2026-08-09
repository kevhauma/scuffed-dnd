/**
 * Stat Card Component
 *
 * One stat as the panel lists it: what kind it is, what bounds it, its formula if it has one, and
 * a sample-value preview of that formula. Carries the reorder controls too, so a keyboard reaches
 * the ordering the drag handle offers a mouse (TICKET-STAT-02).
 *
 * The preview here is the interim one — TICKET-FORM-08's `FormulaPreview` replaces it, and this
 * card's sample-value block retires with it.
 *
 * **Validates: Concept 01; Requirements 3.1, 3.2, 21.1-21.5**
 */

import { useMemo, useState } from 'react';
import { asNumber } from '../../../engine/formula/errors';
import { evaluateFormulaString } from '../../../engine/formula/evaluator';
import type { NamespaceSource } from '../../../engine/formula/namespaces';
import { namespacesFor } from '../../../engine/formula/namespaces';
import { validateFormula } from '../../../engine/formula/validator';
import type { Stat } from '../../../types';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Input } from '../../ui/Input/Input';
import { Text } from '../../ui/Text/Text';

export interface StatCardProps {
  stat: Stat;
  availableSkillCodes: string[];
  /** The ruleset, so the preview resolves `const.*` and `curve.*(x)` the way the sheet does */
  namespaceSource: NamespaceSource;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** Move this stat one place up or down — the keyboard half of reordering (TICKET-STAT-02) */
  onMove: (id: string, delta: number) => void;
  /** False for the first stat, so "up" is not offered where it would do nothing */
  canMoveUp: boolean;
  /** False for the last stat */
  canMoveDown: boolean;
}

/**
 * The short labels describing what kind of stat this is, in the order they read best
 *
 * Derived by the same rule the model uses — a formula makes a stat derived, and nothing else does
 * (Concept 01) — so a card can never disagree with the engine about what it is showing.
 *
 * @param stat - The stat being described
 * @returns One badge label per property worth naming, possibly empty
 */
function statBadges(stat: Stat): string[] {
  const badges = [stat.formula === undefined ? 'Invested' : 'Derived'];

  if (stat.isResource) badges.push('Resource');
  if (stat.countsTowardTotal) badges.push('Counts toward total');
  if (stat.min !== undefined) badges.push(`Min ${stat.min}`);
  if (stat.max !== undefined) badges.push(`Max ${stat.max}`);
  if (stat.rounding !== 'none') badges.push(`Round ${stat.rounding}`);

  return badges;
}

export function StatCard({
  stat,
  availableSkillCodes,
  namespaceSource,
  onEdit,
  onDelete,
  onMove,
  canMoveUp,
  canMoveDown,
}: StatCardProps) {
  // Sample input values for preview (default to 10 for each skill)
  const [sampleValues, setSampleValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    availableSkillCodes.forEach((code) => {
      initial[code] = 10;
    });
    return initial;
  });

  // Validate formula. An invested stat has none, which is not a broken formula — an empty string
  // *is* one to the validator, so the absent case never reaches it (TICKET-STAT-01)
  const validation = useMemo(() => {
    if (stat.formula === undefined) {
      return { isValid: true, errors: [], referencedVariables: [], namespacedReferences: [] };
    }
    return validateFormula(stat.formula, new Set(availableSkillCodes));
  }, [stat.formula, availableSkillCodes]);

  // Calculate preview value. A formula that cannot produce a number yields an error value
  // rather than throwing, and the preview simply shows nothing for it.
  const previewValue = useMemo(() => {
    if (!validation.isValid || stat.formula === undefined) return null;

    const value = evaluateFormulaString(stat.formula, {
      variables: sampleValues,
      // The same resolvers the sheet uses, so the preview and the real value never disagree
      namespaces: namespacesFor(namespaceSource, 'stat'),
    });
    const number = asNumber(value);

    return number === undefined ? null : Math.round(number * 100) / 100;
  }, [stat.formula, sampleValues, validation.isValid, namespaceSource]);

  return (
    <Card variant="bordered" className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <Text variant="h5" as="h3" className="mb-1">
            {stat.name} <span className="font-mono text-ink-500">{stat.abbreviation}</span>
          </Text>
          {stat.description && (
            <Text variant="body-small-secondary" as="p" className="mb-2">
              {stat.description}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => onMove(stat.id, -1)}
            disabled={!canMoveUp}
            aria-label={`Move ${stat.name} up`}
            className="text-sm px-2 py-1"
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            onClick={() => onMove(stat.id, 1)}
            disabled={!canMoveDown}
            aria-label={`Move ${stat.name} down`}
            className="text-sm px-2 py-1"
          >
            ↓
          </Button>
          <Button variant="secondary" onClick={() => onEdit(stat.id)} className="text-sm px-2 py-1">
            Edit
          </Button>
          <Button variant="danger" onClick={() => onDelete(stat.id)} className="text-sm px-2 py-1">
            Delete
          </Button>
        </div>
      </div>

      {/* What kind of stat this is, and what bounds it */}
      <div className="flex flex-wrap gap-2 mb-3">
        {statBadges(stat).map((badge) => (
          <Text
            key={badge}
            variant="body-small-secondary"
            className="px-2 py-0.5 bg-parchment-100 border border-stone-200 rounded"
          >
            {badge}
          </Text>
        ))}
      </div>

      {/* Formula Display — absent means the stat is invested rather than derived */}
      <div className="mb-3">
        <Text variant="body-small-secondary" className="mb-1">
          Formula:
        </Text>
        {stat.formula === undefined ? (
          <Text variant="muted" as="p">
            Invested — its value is the points put into it, plus race and equipment.
          </Text>
        ) : (
          <Text variant="body-small" className="font-mono bg-parchment-100 px-2 py-1 rounded">
            {stat.formula}
          </Text>
        )}
      </div>

      {/* Validation Errors */}
      {!validation.isValid && (
        <div className="mb-3 p-2 bg-crimson/10 border border-crimson rounded">
          <Text variant="body-small" className="text-crimson">
            {validation.errors.join(', ')}
          </Text>
        </div>
      )}

      {/* Preview Section */}
      {validation.isValid && validation.referencedVariables.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-200">
          <Text variant="body-small-secondary" className="mb-2">
            Preview with sample values:
          </Text>

          {/* Sample Input Controls */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {validation.referencedVariables.map((code) => (
              <div key={code} className="flex items-center gap-2">
                <Text variant="body-small" className="w-12">
                  {code}:
                </Text>
                <Input
                  type="number"
                  value={sampleValues[code] || 0}
                  onChange={(e) =>
                    setSampleValues((prev) => ({
                      ...prev,
                      [code]: Number(e.target.value) || 0,
                    }))
                  }
                  className="flex-1 text-sm"
                />
              </div>
            ))}
          </div>

          {/* Calculated Result */}
          <div className="flex justify-between items-center p-2 bg-forest/10 border border-forest rounded">
            <Text variant="body-small-secondary">Calculated Value:</Text>
            <Text variant="body" className="font-semibold text-forest">
              {previewValue !== null ? previewValue : 'Error'}
            </Text>
          </div>
        </div>
      )}
    </Card>
  );
}
