/**
 * Main Skills Configuration Panel
 *
 * Manages main skills with 3-letter codes and max levels.
 *
 * **Validates: Requirements 2.1, 21.1-21.5**
 */

import { Card } from '../../../ui/Card/Card';
import { Text } from '../../../ui/Text/Text';
import { BaseSkillPanel } from '../shared/BaseSkillPanel';
import { MainSkillCard } from './MainSkillCard';
import { MainSkillFormDialog } from './MainSkillFormDialog';
import { MainSkillPointBudget } from './MainSkillPointBudget';
import { useMainSkillManager } from './useMainSkillManager';

export function MainSkillsPanel() {
  const {
    config,
    currentSkills,
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
  } = useMainSkillManager();

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
    <div className="space-y-4">
      <BaseSkillPanel
        title="Main Skills"
        description="Foundational skills with 3-letter codes and levels"
        addButtonText="Add Main Skill"
        emptyMessage="No main skills configured yet. Click 'Add' to create your first skill."
        skills={currentSkills}
        blocked={blocked}
        onAdd={handleAdd}
        onCloseBlocked={dismissBlocked}
        renderSkillCard={(skill) => (
          <MainSkillCard skill={skill} onEdit={handleEdit} onDelete={handleDelete} />
        )}
        renderFormDialog={() => (
          <MainSkillFormDialog
            isOpen={isDialogOpen}
            isEditing={!!editingSkill}
            form={form}
            validateCode={validateCode}
            onClose={() => setIsDialogOpen(false)}
            onSave={handleSave}
          />
        )}
      />

      <MainSkillPointBudget />
    </div>
  );
}
