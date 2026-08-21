/**
 * Skills Configuration Panel
 *
 * Manages skills and the weighted stats they are derived from (Concept 02).
 *
 * Composes `ConfigPanelShell` directly like the other ten panels (CR-37). It went through a
 * `BaseSkillPanel` render-prop wrapper while there were two kinds of skill to share it; combat
 * skills left in TICKET-ROLL-06, and a one-caller wrapper costs more indirection than it saves.
 *
 * **Validates: Concept 02; Requirements 21.1-21.5, 21.7**
 */

import { Button } from '../../../ui/Button/Button';
import { ConfigEmptyState } from '../../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../../shared/ConfigPanelShell';
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
    editingSkillId,
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
    <ConfigPanelShell
      title="Skills"
      description="Competences derived from weighted stats plus what a Player invests"
      actions={
        <Button variant="primary" onClick={handleAdd}>
          Add Skill
        </Button>
      }
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {currentSkills.length === 0 ? (
        <ConfigEmptyState message="No skills configured yet. Click 'Add' to create your first skill." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              stats={weightableStats}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <SkillFormDialog
        isOpen={isDialogOpen}
        isEditing={!!editingSkillId}
        form={form}
        weightableStats={weightableStats}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />
    </ConfigPanelShell>
  );
}
