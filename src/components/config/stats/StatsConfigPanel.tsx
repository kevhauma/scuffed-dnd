/**
 * Stats Configuration Panel
 *
 * The one place every numeric axis is defined (Concept 01, TICKET-STAT-02). Stats replaced the
 * v1 main-skill/stat split, so "add a Sanity stat" is one record here rather than two records in
 * two sections.
 *
 * Reordering is offered twice on purpose: dragging is what the concept page describes, and the
 * per-card arrows are the same operation for anyone not using a mouse. Both end in the hook's
 * `handleReorder` and so in the one store action, which is what keeps `order` and the array from
 * drifting apart.
 *
 * **Validates: Concept 01; Requirements 3.1, 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { StatCard } from './StatCard';
import { StatFormDialog } from './StatFormDialog';
import { useStatManager } from './useStatManager';

export function StatsConfigPanel() {
  const {
    config,
    currentStats,
    availableSkillCodes,
    isDialogOpen,
    setIsDialogOpen,
    editingStatId,
    form,
    isDerived,
    warnings,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    handleMove,
    dragHandlers,
    blocked,
    dismissBlocked,
  } = useStatManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <ConfigPanelShell
      title="Stats"
      description="Every numeric axis a character is measured on. A stat takes invested points, or derives its value from a formula — and a resource stat's value is a maximum the character spends against."
      actions={
        <Button variant="primary" onClick={handleAdd}>
          Add Stat
        </Button>
      }
      headerExtra={
        currentStats.length > 1 && (
          <Text variant="muted">
            Drag a stat, or use its arrows, to change the order it appears in everywhere.
          </Text>
        )
      }
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {currentStats.length === 0 ? (
        <ConfigEmptyState message="No stats configured yet. Click 'Add Stat' to create your first stat." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {currentStats.map((stat, index) => {
            const { isDragging, ...drag } = dragHandlers(index);
            return (
              // The wrapper carries no role: dragging is the mouse path, and the card's own
              // move buttons are the keyboard one
              <div key={stat.id} {...drag} className={isDragging ? 'opacity-50' : ''}>
                <StatCard
                  stat={stat}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onMove={handleMove}
                  canMoveUp={index > 0}
                  canMoveDown={index < currentStats.length - 1}
                />
              </div>
            );
          })}
        </div>
      )}

      <StatFormDialog
        isOpen={isDialogOpen}
        isEditing={!!editingStatId}
        form={form}
        availableSkillCodes={availableSkillCodes}
        config={config}
        isDerived={isDerived}
        warnings={warnings}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />
    </ConfigPanelShell>
  );
}
