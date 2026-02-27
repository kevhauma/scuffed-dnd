/**
 * Combat Skill Manager Hook
 * 
 * Manages combat skill CRUD operations and form state.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useConfigStore } from '../../../../stores/configStore';
import { useSkillDependencies } from '../shared/useSkillDependencies';
import type { CombatSkill, DiceConfig } from '../../../../types';

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
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  const { checkDependencies } = useSkillDependencies();

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
  
  const availableSkillCodes = config ? [
    ...config.mainSkills.map(s => s.code),
    ...config.specialitySkills.map(s => s.code),
  ] : [];

  const validateCode = (code: string): string | true => {
    if (!config) return 'No configuration loaded';
    
    if (code.length !== 3) return 'Code must be exactly 3 letters';
    if (!/^[A-Z]{3}$/.test(code)) return 'Code must be 3 uppercase letters';
    
    const allCodes = [
      ...config.mainSkills.map(s => s.code),
      ...config.specialitySkills.map(s => s.code),
      ...config.combatSkills.map(s => s.code),
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
    const skill = currentSkills.find(s => s.code === code);
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
    const dependencies = checkDependencies(code);
    
    if (dependencies.length > 0) {
      setDeleteWarning(`Cannot delete ${code}. It is referenced by:\n${dependencies.join('\n')}`);
      return;
    }
    
    deleteCombatSkill(code);
  };

  const handleSave = form.handleSubmit((data) => {
    const skill: CombatSkill = {
      code: data.code.toUpperCase(),
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
    deleteWarning,
    setDeleteWarning,
    form,
    validateCode,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  };
}
