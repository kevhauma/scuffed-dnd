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
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { RaceCard } from './RaceCard';
import { RaceFormDialog } from './RaceFormDialog';
import { useRaceManager } from './useRaceManager';

export function RacesConfigPanel() {
  const {
    config,
    currentRaces,
    availableStats,
    isDialogOpen,
    closeDialog,
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
    return <NoConfigurationNotice />;
  }

  return (
    <ConfigPanelShell
      title="Races"
      description="Character lineages, as a stat block per race"
      actions={
        <Button variant="primary" onClick={handleAdd}>
          Add Race
        </Button>
      }
      prerequisites={
        availableStats.length === 0
          ? ['No stats configured yet. A race is a stat block, so add stats first.']
          : undefined
      }
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {currentRaces.length === 0 ? (
        <ConfigEmptyState message="No races configured yet. Click 'Add Race' to create your first race." />
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

      <RaceFormDialog
        isOpen={isDialogOpen}
        isEditing={!!editingRaceId}
        form={form}
        availableStats={availableStats}
        onClose={closeDialog}
        onSave={handleSave}
      />
    </ConfigPanelShell>
  );
}
