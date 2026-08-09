/**
 * Speciality Skills Configuration Panel
 *
 * Manages speciality skills with base levels and bonus formulas.
 *
 * **Validates: Requirements 4.1, 21.1-21.5**
 */

import { Card } from '../../../ui/Card/Card';
import { Text } from '../../../ui/Text/Text';
import { BaseSkillPanel } from '../shared/BaseSkillPanel';
import { SpecialitySkillCard } from './SpecialitySkillCard';
import { SpecialitySkillFormDialog } from './SpecialitySkillFormDialog';
import { useSpecialitySkillManager } from './useSpecialitySkillManager';

export function SpecialitySkillsPanel() {
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
      blocked={blocked}
      onAdd={handleAdd}
      onCloseBlocked={dismissBlocked}
      renderSkillCard={(skill) => (
        <SpecialitySkillCard skill={skill} onEdit={handleEdit} onDelete={handleDelete} />
      )}
      renderFormDialog={() => (
        <SpecialitySkillFormDialog
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
