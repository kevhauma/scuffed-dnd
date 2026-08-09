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
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { BlockedDeleteDialog } from '../shared/BlockedDeleteDialog';
import { StatCard } from './StatCard';
import { StatFormDialog } from './StatFormDialog';
import { StatPointBudget } from './StatPointBudget';
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
    return (
      <Card className="p-6">
        <Text variant="body-secondary">
          No configuration loaded. Please initialize a configuration first.
        </Text>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Text variant="h4" as="h2" className="mb-2">
              Stats
            </Text>
            <Text variant="body-secondary">
              Every numeric axis a character is measured on. A stat takes invested points, or
              derives its value from a formula — and a resource stat's value is a maximum the
              character spends against.
            </Text>
          </div>
          <Button variant="primary" onClick={handleAdd}>
            Add Stat
          </Button>
        </div>

        {currentStats.length > 1 && (
          <Text variant="muted">
            Drag a stat, or use its arrows, to change the order it appears in everywhere.
          </Text>
        )}
      </Card>

      {/* Stats List */}
      {currentStats.length === 0 ? (
        <Card className="p-6">
          <Text variant="body-secondary" className="text-center">
            No stats configured yet. Click 'Add Stat' to create your first stat.
          </Text>
        </Card>
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

      <StatPointBudget />

      {/* Form Dialog */}
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
      <BlockedDeleteDialog blocked={blocked} onClose={dismissBlocked} />
    </div>
  );
}
