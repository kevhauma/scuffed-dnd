/**
 * Combat Skill Manager Hook
 *
 * Manages combat skill CRUD operations and form state.
 *
 * **Validates: Requirements 4.4, 16.5, 16.6, 2.5, 2.6**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { validateFormulaChange } from '../../../../engine/formula/formulaChange';
import { useConfigStore } from '../../../../stores/configStore';
import type { CombatSkill, DiceConfig } from '../../../../types';
import { useGuardedDelete } from '../../shared/useGuardedDelete';
import { resolveSkillId } from '../shared/skillIdentity';

interface SkillFormData {
  code: string;
  name: string;
  description: string;
  maxLevel: number;
  bonusFormula: string;
  dice: DiceConfig;
}

export function useCombatSkillManager() {
  const config = useConfigStore((state) => state.config);
  const addCombatSkill = useConfigStore((state) => state.addCombatSkill);
  const updateCombatSkill = useConfigStore((state) => state.updateCombatSkill);
  const deleteCombatSkill = useConfigStore((state) => state.deleteCombatSkill);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const form = useForm<SkillFormData>({
    defaultValues: {
      code: '',
      name: '',
      description: '',
      maxLevel: 10,
      bonusFormula: '',
      dice: { d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0 },
    },
  });

  const currentSkills = config?.combatSkills || [];

  // Stat abbreviations only since TICKET-SKL-02 — a skill is reached as `skills.<name>`, not by
  // a code in the flat space
  const availableSkillCodes = config ? config.stats.map((s) => s.abbreviation.toUpperCase()) : [];

  const validateCode = (code: string): string | true => {
    if (!config) return 'No configuration loaded';

    if (code.length !== 3) return 'Code must be exactly 3 letters';
    if (!/^[A-Z]{3}$/.test(code)) return 'Code must be 3 uppercase letters';

    const allCodes = [
      ...config.stats.map((s) => s.abbreviation.toUpperCase()),
      ...config.combatSkills.map((s) => s.code),
    ];

    if (!editingSkill && allCodes.includes(code)) {
      return 'Code already exists';
    }

    return true;
  };

  const handleAdd = () => {
    setEditingSkill(null);
    form.reset({
      code: '',
      name: '',
      description: '',
      maxLevel: 10,
      bonusFormula: '',
      dice: { d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0 },
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (code: string) => {
    const skill = currentSkills.find((s) => s.code === code);
    if (!skill) return;

    setEditingSkill(code);
    form.reset({
      code: skill.code,
      name: skill.name,
      description: skill.description,
      maxLevel: 10,
      bonusFormula: skill.bonusFormula,
      dice: skill.dice,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (code: string) => {
    attemptDelete(`Combat skill ${code}`, (options) => deleteCombatSkill(code, options));
  };

  const handleSave = form.handleSubmit((data) => {
    if (!config) return;

    const code = data.code.toUpperCase();

    // Refuse the save if the bonus formula would not compute (Req 16.5, 16.6)
    const validation = validateFormulaChange(config, {
      owner: 'combat-skill',
      id: code,
      formula: data.bonusFormula,
      previousId: editingSkill ?? undefined,
    });

    if (!validation.isValid) {
      form.setError('bonusFormula', { type: 'validate', message: validation.errors.join(' ') });
      return;
    }

    const skill: CombatSkill = {
      id: resolveSkillId(currentSkills, editingSkill),
      code,
      name: data.name,
      description: data.description,
      dice: data.dice,
      bonusFormula: data.bonusFormula,
    };

    if (editingSkill) {
      updateCombatSkill(editingSkill, skill);
    } else {
      addCombatSkill(skill);
    }

    setIsDialogOpen(false);
  });

  return {
    config,
    currentSkills,
    availableSkillCodes,
    isDialogOpen,
    setIsDialogOpen,
    editingSkill,
    blocked,
    dismissBlocked,
    form,
    validateCode,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  };
}
