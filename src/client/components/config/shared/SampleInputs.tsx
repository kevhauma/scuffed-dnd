/**
 * Sample Inputs
 *
 * One editable box per input a preview reads, so a User can ask *what does this give for a
 * character like this* rather than imagining it (TICKET-FORM-08).
 *
 * Extracted from `FormulaPreview` by TICKET-SPL-03 when the template preview needed the same row of
 * boxes — the grid, the `Enter`-swallowing and the id wiring are display decisions, and two copies
 * of them is how one preview's boxes come to behave differently from the other's.
 *
 * **Validates: Requirements 16.4, 21.1-21.5**
 */

import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';

export interface SampleInputsProps {
  /** The stat abbreviations to offer a box for, in the order they were first seen */
  inputs: readonly string[];
  /** What each box holds now */
  values: Record<string, number>;
  onChange: (code: string, value: number) => void;
  /** Unique per preview, so two on one page do not collide on element ids */
  fieldPrefix: string;
}

export function SampleInputs({ inputs, values, onChange, fieldPrefix }: SampleInputsProps) {
  if (inputs.length === 0) return null;

  return (
    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {inputs.map((code) => (
        <div key={code} className="flex items-center gap-2">
          <Label htmlFor={`${fieldPrefix}-${code}`} className="w-12 font-mono">
            {code}
          </Label>
          <Input
            id={`${fieldPrefix}-${code}`}
            type="number"
            // These boxes live inside the owning dialog's form. Enter in one would otherwise
            // submit it, so typing a sample value would save the entity.
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
            }}
            value={values[code]}
            onChange={(event) => onChange(code, Number(event.target.value) || 0)}
            className="flex-1 text-sm"
          />
        </div>
      ))}
    </div>
  );
}
