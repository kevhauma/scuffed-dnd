/**
 * Combat Skills Configuration Panel
 *
 * Manages combat skills with dice rolls and bonus formulas.
 *
 * **Validates: Requirements 5.1, 21.1-21.5**
 */

import { NoConfigurationNotice } from '../../shared/ConfigPanelShell';
import { BaseSkillPanel } from '../shared/BaseSkillPanel';
import { CombatSkillCard } from './CombatSkillCard';
import { CombatSkillFormDialog } from './CombatSkillFormDialog';
import { useCombatSkillManager } from './useCombatSkillManager';

export function CombatSkillsPanel() {
  const {
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
  } = useCombatSkillManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <BaseSkillPanel
      title="Combat Skills"
      description="Combat skills with dice rolls and bonus formulas"
      addButtonText="Add Combat Skill"
      emptyMessage="No combat skills configured yet. Click 'Add' to create your first skill."
      skills={currentSkills}
      blocked={blocked}
      onAdd={handleAdd}
      onCloseBlocked={dismissBlocked}
      renderSkillCard={(skill) => (
        <CombatSkillCard skill={skill} onEdit={handleEdit} onDelete={handleDelete} />
      )}
      renderFormDialog={() => (
        <CombatSkillFormDialog
          isOpen={isDialogOpen}
          isEditing={!!editingSkill}
          form={form}
          availableSkillCodes={availableSkillCodes}
          config={config}
          validateCode={validateCode}
          onClose={() => setIsDialogOpen(false)}
          onSave={handleSave}
        />
      )}
    />
  );
}
