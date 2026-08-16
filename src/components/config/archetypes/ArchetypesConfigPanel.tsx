/**
 * Archetypes Configuration Panel
 *
 * What a character is good at growing (Concept 03, TICKET-ARC-01). An archetype tags every stat
 * `main`, `sub` or `non`; the rate each tag buys lives in the `point_buy` curve, so a ruleset
 * rebalance is a table edit rather than an archetype rewrite. TICKET-ARC-02 is what routes a spent
 * point through the matching column, and TICKET-ARC-03 is what lets a character pick one.
 *
 * Archetypes are made of stats, so the panel says so rather than offering an editor that cannot
 * produce anything — the prerequisite the races panel has for the same reason.
 *
 * **Validates: Concept 03; Requirements 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { ArchetypeCard } from './ArchetypeCard';
import { ArchetypeFormDialog } from './ArchetypeFormDialog';
import { useArchetypeManager } from './useArchetypeManager';

export function ArchetypesConfigPanel() {
  const {
    config,
    currentArchetypes,
    availableStats,
    isDialogOpen,
    setIsDialogOpen,
    editingArchetypeId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    blocked,
    dismissBlocked,
  } = useArchetypeManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <ConfigPanelShell
      title="Archetypes"
      description="What a character is good at growing, as an affinity per stat"
      actions={
        <Button variant="primary" onClick={handleAdd}>
          Add Archetype
        </Button>
      }
      prerequisites={
        availableStats.length === 0
          ? ['No stats configured yet. An archetype tags stats, so add stats first.']
          : undefined
      }
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {currentArchetypes.length === 0 ? (
        <ConfigEmptyState message="No archetypes configured yet. Click 'Add Archetype' to create your first archetype." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {currentArchetypes.map((archetype) => (
            <ArchetypeCard
              key={archetype.id}
              archetype={archetype}
              availableStats={availableStats}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ArchetypeFormDialog
        isOpen={isDialogOpen}
        isEditing={!!editingArchetypeId}
        form={form}
        availableStats={availableStats}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />
    </ConfigPanelShell>
  );
}
