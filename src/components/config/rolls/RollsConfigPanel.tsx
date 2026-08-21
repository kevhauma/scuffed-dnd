/**
 * Rolls Configuration Panel
 *
 * The named rolls a sheet offers (Concept 08): each an input expression fed down a dice ladder,
 * rather than the six hand-typed dice counts the retired `CombatSkill` asked for.
 *
 * The ladders themselves are `DiceLaddersConfigPanel`, mounted beside this one at `/config/rolls`
 * — the two-panels-one-route shape `/config/items` and `/config/skills` use.
 *
 * **Validates: Concept 08; Requirements 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { RollDefinitionCard } from './RollDefinitionCard';
import { RollDefinitionFormDialog } from './RollDefinitionFormDialog';
import { useRollManager } from './useRollManager';

export function RollsConfigPanel() {
  const {
    config,
    currentRolls,
    availableLadders,
    availableSkillCodes,
    ladderFor,
    isDialogOpen,
    setIsDialogOpen,
    editingRollId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    blocked,
    dismissBlocked,
  } = useRollManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <ConfigPanelShell
      title="Rolls"
      description="What a character rolls, as an expression fed down a ladder of dice"
      actions={
        <Button variant="primary" onClick={handleAdd} disabled={availableLadders.length === 0}>
          Add Roll
        </Button>
      }
      prerequisites={
        availableLadders.length === 0
          ? ['No dice ladders configured yet. A roll decomposes down a ladder, so add one first.']
          : undefined
      }
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {currentRolls.length === 0 ? (
        <ConfigEmptyState message="No rolls configured yet. Click 'Add Roll' to create your first roll." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {currentRolls.map((roll) => (
            <RollDefinitionCard
              key={roll.id}
              roll={roll}
              ladder={ladderFor(roll.ladderId)}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <RollDefinitionFormDialog
        isOpen={isDialogOpen}
        isEditing={!!editingRollId}
        form={form}
        availableLadders={availableLadders}
        availableSkillCodes={availableSkillCodes}
        config={config}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />
    </ConfigPanelShell>
  );
}
