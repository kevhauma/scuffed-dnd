/**
 * Dice Ladders Configuration Panel
 *
 * How a number becomes dice (Concept 07): the ordered die sizes a value is walked down, largest
 * first, with the remainder as a flat bonus. TICKET-ROLL-03's entity, getting its editor here.
 *
 * Its own panel rather than a section inside the rolls one, and `/config/rolls` mounts both —
 * the shape `/config/items` and `/config/skills` already use. The first cut was a section, which
 * meant hand-writing the header `ConfigPanelShell` owns, at a different heading level than the
 * shell emits: the `BaseSkillPanel` drift TICKET-DX-05 existed to remove, reintroduced one ticket
 * later.
 *
 * **Validates: Concept 07; Requirements 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell } from '../shared/ConfigPanelShell';
import { DiceLadderCard } from './DiceLadderCard';
import { DiceLadderFormDialog } from './DiceLadderFormDialog';
import { useDiceLadderManager } from './useDiceLadderManager';

export function DiceLaddersConfigPanel() {
  const {
    currentLadders,
    isDialogOpen,
    setIsDialogOpen,
    editingLadderId,
    form,
    validateDieSizes,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    blocked,
    dismissBlocked,
  } = useDiceLadderManager();

  return (
    <ConfigPanelShell
      title="Dice Ladders"
      description="How a number becomes dice: walked down these sizes largest first, with the remainder as a flat bonus"
      actions={
        <Button variant="primary" onClick={handleAdd}>
          Add Ladder
        </Button>
      }
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {currentLadders.length === 0 ? (
        <ConfigEmptyState message="No dice ladders configured yet. Click 'Add Ladder' to create your first ladder." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {currentLadders.map((ladder) => (
            <DiceLadderCard
              key={ladder.id}
              ladder={ladder}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <DiceLadderFormDialog
        isOpen={isDialogOpen}
        isEditing={!!editingLadderId}
        form={form}
        validateDieSizes={validateDieSizes}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />
    </ConfigPanelShell>
  );
}
