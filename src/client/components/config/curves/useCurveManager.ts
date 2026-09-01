/**
 * Curve Manager Hook
 *
 * Curves CRUD, grid editing, and the regeneration reports the cards show (Concept 06). The panel
 * renders; this decides.
 *
 * Three things live here that the entity could not enforce on its own. **The identifier rules** —
 * a curve's `name` is what a formula spells as `curve.<name>`, and a column's is the third
 * segment — were enforced only at the import boundary by TICKET-CRV-01, because there was no form
 * to enforce them in. This is that form's half, and the same argument
 * [TICKET-CST-02](../constants/useConstantManager.ts) makes for constants: a duplicate splits
 * identity from behaviour, because a stored formula points at one curve's id while the resolver
 * reads whichever one won the name. **Structural edits go through the store's column and row
 * actions**, never through an assembled `updateCurve` patch, because `columns`, `values` and
 * `overridden` are three arrays on one index. **The reports** are session state — what the last
 * regeneration did — so they are local rather than persisted.
 *
 * **Validates: Concept 06; Concept 00 §1.1, §6**
 */

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { RegenerationReport } from '#shared/engine/curveGenerator';
import { flagColumnAsOverridden } from '#shared/engine/curveGenerator';
import {
  type EntityReference,
  findReferences,
  REFERENCE_TARGET_KIND,
} from '#shared/engine/dependencies';
import { validateFormulaChange } from '#shared/engine/formula/formulaChange';
import { FORMULA_OWNER, scopeFor } from '#shared/engine/formula/scoping';
import type { Curve, CurveColumn } from '#shared/types';
import type { UniquenessRefusal } from '../../../stores/configStore';
import { useConfigStore } from '../../../stores/configStore';
import { useGuardedDelete } from '../shared/useGuardedDelete';

/** What a name a formula spells must look like — the same rule the importer applies */
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;

const IDENTIFIER_MESSAGE = 'Use lowercase letters, digits and underscores, starting with a letter';

export interface CurveFormData {
  name: string;
  displayName: string;
  description: string;
  keyName: string;
}

export interface ColumnFormData {
  name: string;
  generator: string;
}

const EMPTY_CURVE: CurveFormData = { name: '', displayName: '', description: '', keyName: '' };

const EMPTY_COLUMN: ColumnFormData = { name: '', generator: '' };

/** Which column is being edited, and in which curve; a null `columnId` means "adding one" */
interface ColumnTarget {
  curveId: string;
  columnId: string | null;
}

export function useCurveManager() {
  const config = useConfigStore((state) => state.config);
  const addCurve = useConfigStore((state) => state.addCurve);
  const updateCurve = useConfigStore((state) => state.updateCurve);
  const deleteCurve = useConfigStore((state) => state.deleteCurve);
  const regenerateCurve = useConfigStore((state) => state.regenerateCurve);
  const addCurveColumn = useConfigStore((state) => state.addCurveColumn);
  const deleteCurveColumn = useConfigStore((state) => state.deleteCurveColumn);
  const addCurveRow = useConfigStore((state) => state.addCurveRow);
  const deleteCurveRow = useConfigStore((state) => state.deleteCurveRow);
  const setCurveCell = useConfigStore((state) => state.setCurveCell);
  const clearCurveOverride = useConfigStore((state) => state.clearCurveOverride);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const [editingCurveId, setEditingCurveId] = useState<string | null>(null);
  const [isCurveDialogOpen, setIsCurveDialogOpen] = useState(false);
  const [columnTarget, setColumnTarget] = useState<ColumnTarget | null>(null);
  const [reports, setReports] = useState<Record<string, RegenerationReport>>({});

  const curveForm = useForm<CurveFormData>({ defaultValues: EMPTY_CURVE });
  const columnForm = useForm<ColumnFormData>({ defaultValues: EMPTY_COLUMN });

  const curves = useMemo(() => config?.curves ?? [], [config]);

  /** Which formulas call each curve, keyed by id — the blast radius a delete would hit */
  const usages = useMemo(() => {
    if (!config) return new Map<string, EntityReference[]>();

    return new Map(
      curves.map((curve) => [
        curve.id,
        findReferences({ kind: REFERENCE_TARGET_KIND.CURVE, id: curve.id }, config),
      ])
    );
  }, [config, curves]);

  /**
   * What a generator may name, from the scoping table rather than from a guess
   *
   * `key` and the constants — a generator runs per row with nothing else in hand (Concept 06).
   */
  const generatorVariables = useMemo(
    () => (config ? [...scopeFor(config, FORMULA_OWNER.CURVE_GENERATOR).codes] : []),
    [config]
  );

  const findCurve = (id: string) => curves.find((candidate) => candidate.id === id);

  const handleAddCurve = () => {
    setEditingCurveId(null);
    curveForm.reset(EMPTY_CURVE);
    setIsCurveDialogOpen(true);
  };

  const handleEditCurve = (id: string) => {
    const curve = findCurve(id);
    if (!curve) return;

    setEditingCurveId(id);
    curveForm.reset({
      name: curve.name,
      displayName: curve.displayName,
      description: curve.description,
      keyName: curve.keyName,
    });
    setIsCurveDialogOpen(true);
  };

  const handleDeleteCurve = (id: string) => {
    const curve = findCurve(id);
    attemptDelete(`Curve ${curve?.displayName ?? id}`, (options) => deleteCurve(id, options));
  };

  const handleSaveCurve = curveForm.handleSubmit((data) => {
    const name = data.name.trim();

    if (!IDENTIFIER_PATTERN.test(name)) {
      curveForm.setError('name', { message: IDENTIFIER_MESSAGE });
      return;
    }

    // The name-is-taken rule lives in `addCurve`/`updateCurve` (CR-17), which every write path goes
    // through; this renders what they refuse
    let collision: UniquenessRefusal | null = null;

    if (editingCurveId) {
      // The rename-safe update, so re-spelling a curve re-spells every formula calling it
      collision = updateCurve(editingCurveId, {
        name,
        displayName: data.displayName,
        description: data.description,
        keyName: data.keyName,
      });
    } else {
      // A new curve starts with one column and one row: an empty table has nothing to type into,
      // and Concept 06's single-column shape is the common one
      const curve: Curve = {
        id: crypto.randomUUID(),
        name,
        displayName: data.displayName,
        description: data.description,
        keyName: data.keyName,
        columns: [{ id: crypto.randomUUID(), name: 'value' }],
        rows: [{ key: 0, values: [0] }],
        interpolation: 'step',
        // Concept 06's recommended default — silent clamping is how a level-50 character ends up
        // with a level-15 stat gain and nobody notices
        outOfRange: 'error',
        lookupDirection: 'forward',
      };
      collision = addCurve(curve);
    }

    if (collision) {
      curveForm.setError('name', { message: collision.message });
      return;
    }

    setIsCurveDialogOpen(false);
  });

  const handleAddColumn = (curveId: string) => {
    setColumnTarget({ curveId, columnId: null });
    columnForm.reset(EMPTY_COLUMN);
  };

  const handleEditColumn = (curveId: string, columnId: string) => {
    const column = findCurve(curveId)?.columns.find((candidate) => candidate.id === columnId);
    if (!column) return;

    setColumnTarget({ curveId, columnId });
    columnForm.reset({ name: column.name, generator: column.generator ?? '' });
  };

  /**
   * What refuses a column save, and on which field — or nothing, when it may go through
   *
   * Kept apart from the save itself so the three rules read as three rules: the name is an
   * identifier, the name is free *within this curve*, and the generator passes the same gate
   * every other formula save passes.
   */
  const columnFormError = (
    curve: Curve,
    columnId: string | null,
    name: string,
    generator: string
  ): { field: keyof ColumnFormData; message: string } | null => {
    if (!IDENTIFIER_PATTERN.test(name)) {
      return { field: 'name', message: IDENTIFIER_MESSAGE };
    }

    // Scoped to this curve: `main` in two different curves is two different columns, and the
    // stored form keys a column by its curve for exactly that reason
    if (curve.columns.some((column) => column.name === name && column.id !== columnId)) {
      return {
        field: 'name',
        message: `${curve.displayName} already has a column named ${name}`,
      };
    }

    if (!generator || !config) return null;

    // A generator naming a constant that isn't there would otherwise persist and only surface as
    // a failed cell after the User presses Regenerate
    const validation = validateFormulaChange(config, {
      owner: FORMULA_OWNER.CURVE_GENERATOR,
      id: columnId ?? name,
      formula: generator,
      ...(columnId ? { previousId: columnId } : {}),
    });

    return validation.isValid
      ? null
      : { field: 'generator', message: validation.errors.join('; ') };
  };

  const handleSaveColumn = columnForm.handleSubmit((data) => {
    if (!columnTarget) return;

    const curve = findCurve(columnTarget.curveId);
    if (!curve) return;

    const name = data.name.trim();
    const generator = data.generator.trim();

    const refusal = columnFormError(curve, columnTarget.columnId, name, generator);
    if (refusal) {
      columnForm.setError(refusal.field, { message: refusal.message });
      return;
    }

    if (columnTarget.columnId) {
      const columnId = columnTarget.columnId;
      const previous = curve.columns.find((column) => column.id === columnId);

      // Giving a hand-entered column a generator would otherwise let the next regeneration
      // overwrite every number somebody typed. Flag them first: the User then decides, cell by
      // cell, which ones to hand back to the pattern (Concept 06's import behaviour).
      const gainedGenerator = !!generator && previous?.generator === undefined;
      const kept = gainedGenerator ? flagColumnAsOverridden(curve, columnId) : curve;

      // A column edit is a rename, so it goes through `updateCurve` — the one curve action that
      // re-spells formulas. It rewrites `columns` only, which is safe **because** it changes no
      // column's position; adding and removing go through the splicing actions instead.
      updateCurve(curve.id, {
        columns: kept.columns.map((column) =>
          column.id === columnId
            ? { id: column.id, name, ...(generator ? { generator } : {}) }
            : column
        ),
        ...(gainedGenerator ? { rows: kept.rows } : {}),
      });
    } else {
      const column: CurveColumn = {
        id: crypto.randomUUID(),
        name,
        ...(generator ? { generator } : {}),
      };
      addCurveColumn(curve.id, column);
    }

    setColumnTarget(null);
  });

  const handleDeleteColumn = (curveId: string, columnId: string) => {
    const curve = findCurve(curveId);
    const column = curve?.columns.find((candidate) => candidate.id === columnId);
    attemptDelete(
      `Column ${curve?.displayName ?? curveId} · ${column?.name ?? columnId}`,
      (options) => deleteCurveColumn(curveId, columnId, options)
    );
  };

  const handleAddRow = (curveId: string, key: number) => {
    addCurveRow(curveId, key);
  };

  const handleDeleteRow = (curveId: string, key: number) => {
    deleteCurveRow(curveId, key);
  };

  const handleCellChange = (curveId: string, key: number, columnName: string, value: number) => {
    setCurveCell(curveId, key, columnName, value);
  };

  const handleClearOverride = (curveId: string, key: number, columnName: string) => {
    clearCurveOverride(curveId, key, columnName);
  };

  const handleRegenerate = (curveId: string) => {
    setReports((current) => ({ ...current, [curveId]: regenerateCurve(curveId) }));
  };

  const handleSettingChange = (curveId: string, updates: Partial<Curve>) => {
    updateCurve(curveId, updates);
  };

  return {
    config,
    curves,
    usages,
    reports,
    generatorVariables,
    curveForm,
    columnForm,
    editingCurveId,
    isCurveDialogOpen,
    closeCurveDialog: () => setIsCurveDialogOpen(false),
    columnTarget,
    closeColumnDialog: () => setColumnTarget(null),
    handleAddCurve,
    handleEditCurve,
    handleDeleteCurve,
    handleSaveCurve,
    handleAddColumn,
    handleEditColumn,
    handleSaveColumn,
    handleDeleteColumn,
    handleAddRow,
    handleDeleteRow,
    handleCellChange,
    handleClearOverride,
    handleRegenerate,
    handleSettingChange,
    blocked,
    dismissBlocked,
  };
}
