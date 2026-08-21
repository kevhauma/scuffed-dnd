/**
 * Constant Manager Hook
 *
 * Constants CRUD, form state, and the reverse index the cards show (Concept 05). The panel
 * renders; this decides.
 *
 * Two rules live here that the entity could not enforce on its own. **The identifier rule** —
 * `name` is what a formula spells as `const.<name>`, so it has to be a lowercase identifier and
 * unique — was enforced only at the import boundary by TICKET-CST-01, because there was no form
 * to enforce it in. This is that form's half. **The usage index** answers Concept 05's editor
 * requirement, "show where it's used", from TICKET-REF-01's walker rather than from a substring
 * scan: `10 / const.bonus_divider` counts, a stat named `bonus_divider` does not.
 *
 * Characters are deliberately not passed to `findReferences` — a constant is only ever named from
 * a configuration formula, and no character field can point at one.
 *
 * **Validates: Concept 05; Concept 00 §6; Requirements 2.5, 2.6**
 */

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { type EntityReference, findReferences } from '../../../engine/dependencies';
import { useConfigStore } from '../../../stores/configStore';
import type { Constant } from '../../../types';
import { useGuardedDelete } from '../shared/useGuardedDelete';

/** A constant's identifier as the formula parser reads it — `bonus_divider`, never `Bonus Divider` */
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;

export interface ConstantFormData {
  name: string;
  displayName: string;
  description: string;
  value: number;
  unit: string;
}

const EMPTY_FORM: ConstantFormData = {
  name: '',
  displayName: '',
  description: '',
  value: 0,
  unit: '',
};

export function useConstantManager() {
  const config = useConfigStore((state) => state.config);
  const addConstant = useConfigStore((state) => state.addConstant);
  const updateConstant = useConfigStore((state) => state.updateConstant);
  const deleteConstant = useConfigStore((state) => state.deleteConstant);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConstantId, setEditingConstantId] = useState<string | null>(null);

  const form = useForm<ConstantFormData>({ defaultValues: EMPTY_FORM });

  const constants = useMemo(() => config?.constants ?? [], [config]);

  /**
   * Which formulas name each constant, keyed by id
   *
   * Built once per configuration rather than per card, so a ruleset with many constants parses
   * each formula once per constant instead of once per constant per render.
   */
  const usages = useMemo(() => {
    if (!config) return new Map<string, EntityReference[]>();

    return new Map(
      constants.map((constant) => [
        constant.id,
        findReferences({ kind: 'constant', id: constant.id }, config),
      ])
    );
  }, [config, constants]);

  const handleAdd = () => {
    setEditingConstantId(null);
    form.reset(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    const constant = constants.find((candidate) => candidate.id === id);
    if (!constant) return;

    setEditingConstantId(id);
    form.reset({
      name: constant.name,
      displayName: constant.displayName,
      description: constant.description,
      value: constant.value,
      unit: constant.unit ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const constant = constants.find((candidate) => candidate.id === id);
    attemptDelete(`Constant ${constant?.displayName ?? id}`, (options) =>
      deleteConstant(id, options)
    );
  };

  const handleSave = form.handleSubmit((data) => {
    const name = data.name.trim();

    if (!IDENTIFIER_PATTERN.test(name)) {
      form.setError('name', {
        message: 'Use lowercase letters, digits and underscores, starting with a letter',
      });
      return;
    }

    const taken = constants.some(
      (constant) => constant.name === name && constant.id !== editingConstantId
    );
    if (taken) {
      // Two constants sharing a name split identity from value: a formula points at one id while
      // the resolver reads the other's number (TICKET-CST-01).
      form.setError('name', { message: `A constant named ${name} already exists` });
      return;
    }

    const unit = data.unit.trim();
    const constant: Constant = {
      id: editingConstantId ?? crypto.randomUUID(),
      name,
      displayName: data.displayName,
      description: data.description,
      value: data.value,
      // Absent rather than empty — the field is optional and an empty suffix is not a suffix
      ...(unit ? { unit } : {}),
    };

    if (editingConstantId) {
      // Goes through the store's rename-safe update, so renaming re-spells every formula. The
      // unit is spelled out rather than omitted: `updateConstant` shallow-merges, where a missing
      // key means "unchanged", so an emptied field would otherwise come straight back.
      updateConstant(editingConstantId, { ...constant, unit: unit || undefined });
    } else {
      addConstant(constant);
    }

    setIsDialogOpen(false);
  });

  return {
    config,
    constants,
    usages,
    isDialogOpen,
    setIsDialogOpen,
    editingConstantId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    blocked,
    dismissBlocked,
  };
}
