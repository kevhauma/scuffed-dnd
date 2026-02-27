/**
 * Speciality Skills Configuration Panel
 * 
 * Manages speciality skills with base levels and bonus formulas.
 */

import { useSpecialitySkillManager } from './useSpecialitySkillManager';
import { BaseSkillPanel } from '../shared/BaseSkillPanel';
import { SpecialitySkillCard } from './SpecialitySkillCard';
import { SpecialitySkillFormDialog } from './SpecialitySkillFormDialog';
import { Card } from '../../../ui/Card/Card';
import { Text } from '../../../ui/Text/Text';

export function SpecialitySkillsPanel() {
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
  } = useSpecialitySkillManager();

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
      title="Speciality Skills"
      description="Skills with base levels and bonus formulas"
      addButtonText="Add Speciality Skill"
      emptyMessage="No speciality skills configured yet. Click 'Add' to create your first skill."
      skills={currentSkills}
      isDialogOpen={isDialogOpen}
      deleteWarning={deleteWarning}
      onAdd={handleAdd}
      onCloseDialog={() => setIsDialogOpen(false)}
      onCloseWarning={() => setDeleteWarning(null)}
      renderSkillCard={(skill) => (
        <SpecialitySkillCard
          skill={skill}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
      renderFormDialog={() => (
        <SpecialitySkillFormDialog
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
