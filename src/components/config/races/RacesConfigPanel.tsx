/**
 * Races Configuration Panel
 *
 * Manages races as **stat blocks** — absolute values per stat, like the sheet's creature rows
 * (Concept 04, TICKET-RACE-01). The ruleset's stats decide what a block contains, so a race
 * cannot be edited before there are stats to be made of.
 *
 * **Validates: Concept 04; Requirements 8.1, 8.2, 8.5, 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { BlockedDeleteDialog } from '../shared/BlockedDeleteDialog';
import { RaceCard } from './RaceCard';
import { RaceFormDialog } from './RaceFormDialog';
import { useRaceManager } from './useRaceManager';

export function RacesConfigPanel() {
  const {
    config,
    currentRaces,
    availableStats,
    isDialogOpen,
    setIsDialogOpen,
    editingRaceId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    blocked,
    dismissBlocked,
  } = useRaceManager();

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
              Races
            </Text>
            <Text variant="body-secondary">Character lineages, as a stat block per race</Text>
          </div>
          <Button variant="primary" onClick={handleAdd}>
            Add Race
          </Button>
        </div>

        {availableStats.length === 0 && (
          <div className="mt-4 p-4 bg-amber/10 border border-amber rounded">
            <Text variant="body-small" className="text-ink-700">
              No stats configured yet. A race is a stat block, so add stats first.
            </Text>
          </div>
        )}
      </Card>

      {/* Races List */}
      {currentRaces.length === 0 ? (
        <Card className="p-6">
          <Text variant="body-secondary" className="text-center">
            No races configured yet. Click 'Add Race' to create your first race.
          </Text>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {currentRaces.map((race) => (
            <RaceCard
              key={race.id}
              race={race}
              availableStats={availableStats}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <RaceFormDialog
        isOpen={isDialogOpen}
        isEditing={!!editingRaceId}
        form={form}
        availableStats={availableStats}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />
      <BlockedDeleteDialog blocked={blocked} onClose={dismissBlocked} />
    </div>
  );
}
