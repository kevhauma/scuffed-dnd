/**
 * Races Configuration Panel
 *
 * Manages races as **stat blocks** — absolute values per stat, like the sheet's creature rows
 * (Concept 04, TICKET-RACE-01). The ruleset's stats decide what a block contains, so a race
 * cannot be edited before there are stats to be made of.
 *
 * The header also carries the ruleset's two **creature reference lists** (v4 systems/14,
 * TICKET-RACE-03) — the sizes and the creature types a race's identity is picked from. They live
 * here rather than on a section of their own because they exist for the pickers three fields below
 * them; a route whose only content is two word lists is a page nobody would visit.
 *
 * **Validates: Concept 04; Requirements 8.1, 8.2, 8.5, 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { RaceCard } from './RaceCard';
import { RaceFormDialog } from './RaceFormDialog';
import { ReferenceListEditor } from './ReferenceListEditor';
import { useRaceManager } from './useRaceManager';

export function RacesConfigPanel() {
  const {
    config,
    currentRaces,
    availableStats,
    creatureSizes,
    creatureTypes,
    setCreatureSizes,
    setCreatureTypes,
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
      headerExtra={
        <div className="mt-6 grid grid-cols-1 gap-6 border-t border-stone-200 pt-6 lg:grid-cols-2">
          <ReferenceListEditor
            title="Creature Types"
            description="The kinds a race may be. Their spelling is yours."
            placeholder="humaniod"
            idPrefix="creature-type"
            values={creatureTypes}
            onChange={setCreatureTypes}
          />
          <ReferenceListEditor
            title="Creature Sizes"
            description="The sizes a race may be, smallest first."
            placeholder="medium"
            idPrefix="creature-size"
            values={creatureSizes}
            onChange={setCreatureSizes}
          />
        </div>
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
        creatureSizes={creatureSizes}
        creatureTypes={creatureTypes}
        onClose={closeDialog}
        onSave={handleSave}
      />
    </ConfigPanelShell>
  );
}
