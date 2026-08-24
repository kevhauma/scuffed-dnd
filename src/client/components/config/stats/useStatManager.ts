/**
 * Stat Manager Hook
 *
 * Manages stat CRUD operations, ordering, and form state.
 *
 * Carries every field of the unified stat (TICKET-STAT-02): an empty `formula` means the stat is
 * **invested** rather than derived, which is why it is stripped rather than stored as an empty
 * string — the two are different stats, not different spellings of one. `min`/`max` are the same
 * shape: empty means unbounded and the key stays off the record.
 *
 * Two kinds of refusal live here, and they are not the same thing. A **refusal** stops the save:
 * a malformed or colliding abbreviation, a formula that will not compute. A **warning** does not:
 * Concept 01 says a resource with no ceiling is worth telling the User about, not worth refusing,
 * because the ruleset is still coherent — the sheet just cannot draw a bar for it.
 *
 * One rule moved here with the merge: **an abbreviation is a formula spelling**, so it has to be
 * identifier-shaped and unique. It shared that flat namespace with the combat skill codes until
 * TICKET-ROLL-06 retired them, and with the speciality codes until TICKET-SKL-02 — the space holds
 * stat abbreviations and nothing else now, so this manager is the only side enforcing the rule.
 *
 * **A rename no longer has a character half.** `investedStatPoints` is keyed by stat id
 * (TICKET-STAT-01) and `investedSkillPoints` by skill id (TICKET-SKL-02), so re-spelling an
 * abbreviation cannot orphan either, and `useSkillCodeRename` was deleted rather than kept for a
 * job that no longer exists. **And nothing is left behind**: the last code-keyed character field
 * went with the focus stat in TICKET-ARC-03, so no rename has a character half at all any more.
 *
 * **Validates: Concept 01; Concept 00 §6; Requirements 2.3, 16.5, 16.6**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { validateFormulaChange } from '#shared/engine/formula/formulaChange';
import { scopeFor } from '#shared/engine/formula/scoping';
import type { Stat, StatRounding } from '#shared/types';
import { useConfigStore } from '../../../stores/configStore';
import { useEntityDialog } from '../shared/useEntityDialog';
import { useGuardedDelete } from '../shared/useGuardedDelete';

/** What a spelling in the flat formula space must look like — `STR`, never `Str Total` */
const ABBREVIATION_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * The form's shape
 *
 * `min` and `max` are **strings**, not numbers: the field has three states — a bound, no bound,
 * and "the User is midway through typing `-`" — and only a string can hold all three. They become
 * numbers, or absent keys, at save time.
 */
export interface StatFormData {
  name: string;
  abbreviation: string;
  description: string;
  formula: string;
  countsTowardTotal: boolean;
  isResource: boolean;
  min: string;
  max: string;
  rounding: StatRounding;
}

const EMPTY_FORM: StatFormData = {
  name: '',
  abbreviation: '',
  description: '',
  formula: '',
  countsTowardTotal: true,
  isResource: false,
  min: '',
  max: '',
  rounding: 'none',
};

/** How the composed value is rounded, in the order the dialog offers them (Concept 01) */
export const ROUNDING_OPTIONS: { value: StatRounding; label: string }[] = [
  { value: 'none', label: 'None — keep the fraction' },
  { value: 'nearest', label: 'Nearest' },
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
];

/**
 * Read a bounds field, where empty means unbounded rather than zero
 *
 * @param raw - What the User typed
 * @returns The number, or undefined when the field is empty or not a number
 */
function boundValue(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function useStatManager() {
  const config = useConfigStore((state) => state.config);
  const addStat = useConfigStore((state) => state.addStat);
  const updateStat = useConfigStore((state) => state.updateStat);
  const deleteStat = useConfigStore((state) => state.deleteStat);
  const reorderStats = useConfigStore((state) => state.reorderStats);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  // Which card is mid-drag, by position. A half-finished drag is nobody else's business, so the
  // store hears about it once — when the card lands.
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const form = useForm<StatFormData>({ defaultValues: EMPTY_FORM });
  const dialog = useEntityDialog(form);

  // Sorted here as well as in the store's `reorderStats`, so an imported ruleset whose `order`
  // values disagree with its array order still lists the way the User arranged it
  const currentStats = [...(config?.stats ?? [])].sort((a, b) => a.order - b.order);
  // What a derived stat's formula may name in the flat space. Taken from `scopeFor` rather than
  // mapped by hand so the editor's completions and `FormulaPreview`'s validation read the same
  // table — today they would agree either way, but a new row in `LEGACY_CODE_SCOPES` should not
  // be able to make them disagree (TICKET-FORM-08).
  const availableSkillCodes = config
    ? Array.from(scopeFor(config, 'stat').codes)
    : ([] as string[]);

  const handleAdd = () => {
    dialog.openForAdd(EMPTY_FORM);
  };

  const handleEdit = (id: string) => {
    const stat = currentStats.find((s) => s.id === id);
    if (!stat) return;

    dialog.openForEdit(id, {
      name: stat.name,
      abbreviation: stat.abbreviation,
      description: stat.description,
      formula: stat.formula ?? '',
      countsTowardTotal: stat.countsTowardTotal,
      isResource: stat.isResource,
      // Absent stays empty rather than becoming '0' — unbounded is not a bound of zero
      min: stat.min === undefined ? '' : String(stat.min),
      max: stat.max === undefined ? '' : String(stat.max),
      rounding: stat.rounding,
    });
  };

  /**
   * Put the stat at `from` at position `to`, and persist the whole ordering
   *
   * @param from - The stat's current position in the displayed list
   * @param to - Where it should land
   */
  const handleReorder = (from: number, to: number) => {
    if (to < 0 || to >= currentStats.length || from === to) return;

    const ids = currentStats.map((stat) => stat.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);

    reorderStats(ids);
  };

  /**
   * Move one stat up or down the list (TICKET-STAT-02)
   *
   * The keyboard-reachable half of reordering; a drag ends in the same `handleReorder`. A move
   * off either end is a no-op rather than a wrap.
   *
   * @param id - Which stat
   * @param delta - -1 for up, 1 for down
   */
  const handleMove = (id: string, delta: number) => {
    const from = currentStats.findIndex((stat) => stat.id === id);
    if (from === -1) return;

    handleReorder(from, from + delta);
  };

  /**
   * The drag half of reordering, as one prop bundle per card (TICKET-STAT-02)
   *
   * Lives here rather than in the panel so both reorder paths end in the same `handleReorder` —
   * the panel spreads what it is given and holds no state of its own, which is the rule every
   * other config panel follows.
   *
   * @param index - The card's position in the displayed list
   * @returns The drag props for that card, plus whether it is the one being dragged
   */
  const dragHandlers = (index: number) => ({
    isDragging: draggingIndex === index,
    draggable: true,
    onDragStart: () => setDraggingIndex(index),
    onDragEnd: () => setDraggingIndex(null),
    onDragOver: (event: { preventDefault: () => void }) => event.preventDefault(),
    onDrop: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      if (draggingIndex !== null) handleReorder(draggingIndex, index);
      setDraggingIndex(null);
    },
  });

  const handleDelete = (id: string) => {
    const stat = config?.stats.find((candidate) => candidate.id === id);
    attemptDelete(`Stat ${stat?.name ?? id}`, (options) => deleteStat(id, options));
  };

  /**
   * What refuses a stat save, and on which field — or nothing, when it may go through
   *
   * Kept apart from the save itself so the two rules read as two rules: the abbreviation is a
   * formula spelling free in the one flat space, and the formula computes.
   */
  const statFormError = (
    id: string,
    abbreviation: string,
    formula: string
  ): { field: keyof StatFormData; message: string } | null => {
    if (!config) return null;

    if (!ABBREVIATION_PATTERN.test(abbreviation)) {
      return {
        field: 'abbreviation',
        message: 'Use letters, digits and underscores, starting with a letter',
      };
    }

    // The abbreviation-is-taken rule is **not** checked here any more (CR-17): it lives in
    // `addStat`/`updateStat`, which every write path goes through, and this hook renders whatever
    // they refuse. Duplicating it would be the advisory check the store's own `guardedDelete`
    // docstring rejects as insufficient.

    // An empty formula is not a broken one — it is an invested stat, with nothing to validate
    if (!formula) return null;

    const validation = validateFormulaChange(config, {
      owner: 'stat',
      id,
      formula,
      previousId: dialog.editingId ?? undefined,
    });

    return validation.isValid ? null : { field: 'formula', message: validation.errors.join(' ') };
  };

  const handleSave = form.handleSubmit((data) => {
    if (!config) return;

    const id = dialog.editingId || crypto.randomUUID();
    const abbreviation = data.abbreviation.trim().toUpperCase();
    const formula = data.formula.trim();

    // Refuses the save rather than persisting it (Req 16.5, 16.6)
    const refusal = statFormError(id, abbreviation, formula);
    if (refusal) {
      form.setError(refusal.field, { type: 'validate', message: refusal.message });
      return;
    }

    const existing = currentStats.find((candidate) => candidate.id === dialog.editingId);
    const min = boundValue(data.min);
    const max = boundValue(data.max);
    const stat: Stat = {
      id,
      name: data.name,
      abbreviation,
      description: data.description,
      order: existing?.order ?? currentStats.length,
      countsTowardTotal: data.countsTowardTotal,
      isResource: data.isResource,
      // Absent rather than empty: absence is what makes the stat invested
      ...(formula ? { formula } : {}),
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
      rounding: data.rounding,
    };

    // The store owns the uniqueness invariant and hands back its refusal (CR-17); the dialog stays
    // open with the message on the field that collided
    const collision = dialog.editingId
      ? // Spelled out rather than merged: `formula` and the bounds are optional, and a shallow
        // merge would keep a bound or a formula the User just cleared
        updateStat(dialog.editingId, { ...stat, formula: formula || undefined, min, max })
      : addStat(stat);

    if (collision) {
      // An id collision cannot come from this dialog — ids are minted here — so the only field a
      // User can act on is the abbreviation
      form.setError(collision.field === 'abbreviation' ? 'abbreviation' : 'name', {
        type: 'validate',
        message: collision.message,
      });
      return;
    }

    dialog.close();
  });

  // Live off the form, so the User sees the consequence of a flag as they set it rather than
  // after saving. Watched fields only — `watch` with no argument would rerender on every keystroke.
  const isResource = form.watch('isResource');
  const watchedFormula = form.watch('formula');
  const watchedMax = form.watch('max');

  /**
   * Whether the stat being edited is **derived** — its value is the formula, not an investment
   *
   * Mutually exclusive with investment by construction rather than by a second flag that could
   * disagree with this one (Concept 01): a formula is present, or the stat takes points.
   */
  const isDerived = watchedFormula.trim().length > 0;

  /**
   * What is worth telling the User without stopping the save (Concept 01, "Validation")
   *
   * A resource pool needs a ceiling to draw a bar against, and there are two ways to have one: a
   * formula that derives the maximum, or a literal `max`. A resource with neither has no ceiling
   * at all, which is the case Concept 01 asks to be flagged — as a warning, because the ruleset
   * is still coherent; the sheet simply cannot draw a bar for it.
   */
  const warnings: string[] = [];
  if (isResource && !isDerived && boundValue(watchedMax) === undefined) {
    warnings.push(
      'A resource with no formula and no maximum has no ceiling, so the sheet cannot draw a bar ' +
        'for it. Give it a max, or a formula that derives one.'
    );
  }

  return {
    blocked,
    dismissBlocked,
    config,
    currentStats,
    availableSkillCodes,
    isDialogOpen: dialog.isOpen,
    closeDialog: dialog.close,
    editingStatId: dialog.editingId,
    form,
    isDerived,
    warnings,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    handleMove,
    handleReorder,
    dragHandlers,
  };
}
