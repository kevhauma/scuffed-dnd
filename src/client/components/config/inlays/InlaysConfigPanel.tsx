/**
 * Inlays Configuration Panel
 *
 * The gem catalog: families of socketable stones, each with a ladder of stat grants (v4
 * systems/10, TICKET-INL-01). The other ingredient of a composed item beside a material, and the
 * panel is deliberately the materials panel's shape — a family, a ladder, guarded delete — because
 * the entity is.
 *
 * Families are listed under the heading their `group` names, which is whatever the ruleset says:
 * the sheet writes Common and Precious, a ruleset that names neither gets one plain list, and one
 * that invents a third heading gets three. `useInlayManager` decides; this renders.
 *
 * **Validates: v4 systems/10; Requirements 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { InlayCard } from './InlayCard';
import { InlayFormDialog } from './InlayFormDialog';
import { InlayTierFormDialog } from './InlayTierFormDialog';
import { useInlayManager } from './useInlayManager';

export function InlaysConfigPanel() {
  const {
    config,
    inlays,
    inlayGroups,
    stats,
    modifiableStats,
    isInlayDialogOpen,
    setIsInlayDialogOpen,
    isTierDialogOpen,
    setIsTierDialogOpen,
    editingInlayId,
    editingTierIndex,
    inlayForm,
    tierForm,
    handleAddInlay,
    handleEditInlay,
    handleDeleteInlay,
    handleSaveInlay,
    handleAddTier,
    handleEditTier,
    handleDeleteTier,
    handleSaveTier,
    blocked,
    dismissBlocked,
  } = useInlayManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <ConfigPanelShell
      title="Inlays"
      description="Gems a crafted item can be socketed with, in tiers of stat grants"
      actions={
        <Button variant="primary" onClick={handleAddInlay}>
          Add Inlay
        </Button>
      }
      prerequisites={
        modifiableStats.length === 0
          ? [
              'No stats a grant can land on. Add an invested or resource stat to use in tier grants.',
            ]
          : undefined
      }
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {inlays.length === 0 ? (
        <ConfigEmptyState message="No inlays configured yet. Click 'Add Inlay' to create your first gem family." />
      ) : (
        <div className="space-y-6">
          {inlayGroups.map((group) => (
            <div key={group.label ?? ''} className="space-y-2">
              {group.label && (
                <Text variant="h5" as="h3">
                  {group.label}
                </Text>
              )}
              {group.inlays.map((inlay) => (
                <InlayCard
                  key={inlay.id}
                  inlay={inlay}
                  stats={stats}
                  onEdit={handleEditInlay}
                  onDelete={handleDeleteInlay}
                  onAddTier={handleAddTier}
                  onEditTier={handleEditTier}
                  onDeleteTier={handleDeleteTier}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <InlayFormDialog
        isOpen={isInlayDialogOpen}
        isEditing={!!editingInlayId}
        form={inlayForm}
        onClose={() => setIsInlayDialogOpen(false)}
        onSave={handleSaveInlay}
      />

      <InlayTierFormDialog
        isOpen={isTierDialogOpen}
        isEditing={editingTierIndex !== null}
        form={tierForm}
        modifiableStats={modifiableStats}
        onClose={() => setIsTierDialogOpen(false)}
        onSave={handleSaveTier}
      />
    </ConfigPanelShell>
  );
}
