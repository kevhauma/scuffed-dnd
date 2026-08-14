/**
 * Skills Configuration Panel
 *
 * Manages skills and the weighted stats they are derived from (Concept 02).
 *
 * **Validates: Concept 02; Requirements 21.1-21.5**
 */

import { NoConfigurationNotice } from '../../shared/ConfigPanelShell';
import { BaseSkillPanel } from '../shared/BaseSkillPanel';
import { SkillCard } from './SkillCard';
import { SkillFormDialog } from './SkillFormDialog';
import { useSkillManager } from './useSkillManager';

export function SkillsPanel() {
  const {
    config,
    currentSkills,
    weightableStats,
    isDialogOpen,
    setIsDialogOpen,
    editingSkill,
    blocked,
    dismissBlocked,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  } = useSkillManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <BaseSkillPanel
      title="Skills"
      description="Competences derived from weighted stats plus what a Player invests"
      addButtonText="Add Skill"
      emptyMessage="No skills configured yet. Click 'Add' to create your first skill."
      skills={currentSkills}
      blocked={blocked}
      onAdd={handleAdd}
      onCloseBlocked={dismissBlocked}
      renderSkillCard={(skill) => (
        <SkillCard
          skill={skill}
          stats={weightableStats}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
      renderFormDialog={() => (
        <SkillFormDialog
          isOpen={isDialogOpen}
          isEditing={!!editingSkill}
          form={form}
          weightableStats={weightableStats}
          onClose={() => setIsDialogOpen(false)}
          onSave={handleSave}
        />
      )}
    />
  );
}
