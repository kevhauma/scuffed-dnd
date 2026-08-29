/**
 * Part Picker — one column of the sheet's *Item selecter*: a family, and a rung of it
 *
 * The material column and the inlay column of {@link ItemBuilder} are the same control twice — pick
 * a family, then pick one of its tiers — differing only in whether *no part at all* is an option.
 * Extracted to delete that duplicate rather than in anticipation of a third caller, which is the
 * distinction the no-abstraction-before-the-third-caller rule draws.
 *
 * **Only the rungs a family actually has are offered.** `Material.levels` and `Inlay.tiers` both
 * carry the rung number on the row and neither array is kept dense or sorted — the sheet's Zircon
 * has tiers 1–9 and a blank tenth (TICKET-INL-01) — so the list is built from the stored rows and
 * sorted by number here. That is what makes an absent rung unpickable rather than a refusal a Player
 * has to read; a request that names one anyway meets `buildItem`'s.
 *
 * **Validates: Requirement 12.2; v4 systems/12**
 */

import { useId } from 'react';
import { Label } from '../../ui/Label/Label';
import { Select, type SelectOption } from '../../ui/Select/Select';

/** One family this column offers, reduced to what the control needs of it */
export interface PartFamily {
  id: string;
  name: string;
  /** Every rung the family stores, in whatever order it stores them */
  rungs: { rung: number; name?: string }[];
}

export interface PartPickerProps {
  /** What this column is called — also the tier control's accessible name */
  label: string;
  families: PartFamily[];
  /**
   * What "no part" reads as, when leaving the column empty is legal.
   *
   * The inlay column has one (the sheet writes `with empty inlay`) and the material column has none,
   * which is the only difference between the two callers.
   */
  noneLabel?: string;
  /** The family currently picked, or `''` for none */
  familyId: string;
  /** The rung currently picked, as the control speaks it */
  rung: string;
  onFamily: (familyId: string) => void;
  onRung: (rung: string) => void;
}

/**
 * A family's rungs as options, lowest first
 *
 * A copy is sorted rather than the stored array, which belongs to the ruleset.
 *
 * @param rungs - Each stored row's rung number and the name to show it by, if it has one
 * @returns One option per rung, ascending
 */
function tierOptions(rungs: PartFamily['rungs']): SelectOption[] {
  const ascending = [...rungs].sort((left, right) => left.rung - right.rung);

  return ascending.map(({ rung, name }) => ({
    value: String(rung),
    label: name ? `${rung} · ${name}` : `Tier ${rung}`,
  }));
}

export function PartPicker({
  label,
  families,
  noneLabel,
  familyId,
  rung,
  onFamily,
  onRung,
}: PartPickerProps) {
  const familySelectId = useId();
  const tierSelectId = useId();

  const picked = families.find((candidate) => candidate.id === familyId);
  const named = families.map((family) => ({ value: family.id, label: family.name }));
  const options = noneLabel ? [{ value: '', label: noneLabel }, ...named] : named;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Label htmlFor={familySelectId}>{label}</Label>
        <Select
          id={familySelectId}
          value={familyId}
          {...(noneLabel ? {} : { placeholder: `Choose a ${label.toLowerCase()}` })}
          options={options}
          onChange={(event) => onFamily(event.target.value)}
          className="mt-1 w-full"
        />
      </div>
      <Select
        id={tierSelectId}
        aria-label={`${label} tier`}
        value={rung}
        placeholder="Choose a tier"
        options={tierOptions(picked?.rungs ?? [])}
        disabled={familyId === ''}
        onChange={(event) => onRung(event.target.value)}
        className="w-full"
      />
    </div>
  );
}
