/**
 * Combat Skills Configuration Panel
 * 
 * Manages combat skills with dice rolls and bonus formulas.
 */

import { useCombatSkillManager } from './useCombatSkillManager';
import { BaseSkillPanel } from '../shared/BaseSkillPanel';
import { CombatSkillCard } from './CombatSkillCard';
import { CombatSkillFormDialog } from './CombatSkillFormDialog';
import { Card } from '../../../ui/Card/Card';
import { Text } from '../../../ui/Text/Text';

export function CombatSkillsPanel() {
  const {
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
  } = useCombatSkillManager();

  if (!config) {
    return (
      <Card className="p-6">
        <Text variant="body-secondary">
          No configuration loaded. Please initialize a configuration first.
        </Text>
      </Card>
    );
  }

  return (
    <BaseSkillPanel
      title="Combat Skills"
      description="Combat skills with dice rolls and bonus formulas"
      addButtonText="Add Combat Skill"
      emptyMessage="No combat skills configured yet. Click 'Add' to create your first skill."
      skills={currentSkills}
      isDialogOpen={isDialogOpen}
      deleteWarning={deleteWarning}
      onAdd={handleAdd}
      onCloseDialog={() => setIsDialogOpen(false)}
      onCloseWarning={() => setDeleteWarning(null)}
      renderSkillCard={(skill) => (
        <CombatSkillCard
          skill={skill}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
      renderFormDialog={() => (
        <CombatSkillFormDialog
          isOpen={isDialogOpen}
          isEditing={!!editingSkill}
          form={form}
          availableSkillCodes={availableSkillCodes}
          validateCode={validateCode}
          onClose={() => setIsDialogOpen(false)}
          onSave={handleSave}
        />
      )}
    />
  );
}
