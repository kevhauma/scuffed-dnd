/**
 * Stats Configuration Panel
 * 
 * Manages stats with formula editor and preview calculations.
 */

import { useStatManager } from './useStatManager';
import { StatCard } from './StatCard';
import { StatFormDialog } from './StatFormDialog';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export function StatsConfigPanel() {
  const {
    config,
    currentStats,
    availableSkillCodes,
    isDialogOpen,
    setIsDialogOpen,
    editingStatId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
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
            <Text variant="h4" as="h2" className="mb-2">Stats</Text>
            <Text variant="body-secondary">
              Derived values calculated from main skills using custom formulas
            </Text>
          </div>
          <Button variant="primary" onClick={handleAdd}>
            Add Stat
          </Button>
        </div>

        {availableSkillCodes.length === 0 && (
          <div className="mt-4 p-4 bg-amber/10 border border-amber rounded">
            <Text variant="body-small" className="text-ink-700">
              No main skills configured yet. Add main skills first to use them in stat formulas.
            </Text>
          </div>
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
          {currentStats.map((stat) => (
            <StatCard
              key={stat.id}
              stat={stat}
              availableSkillCodes={availableSkillCodes}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <StatFormDialog
        isOpen={isDialogOpen}
        isEditing={!!editingStatId}
        form={form}
        availableSkillCodes={availableSkillCodes}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
