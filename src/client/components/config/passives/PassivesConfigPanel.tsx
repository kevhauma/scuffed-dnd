/**
 * Passives Configuration Panel
 *
 * The ruleset's catalog of passive abilities — resistances, immunities and senses (v4 systems/14,
 * TICKET-PAS-01).
 *
 * **A catalog and nothing else, on purpose.** Nothing in the source workbook grants a passive:
 * Setup says *"Passive abilites: Coming soon"*, races reference none and items reference none, and
 * the actives tab beside it is empty. So this panel builds the table and stops — no wiring to races
 * or items, and no effect *mechanics* (a resistance is text; there is no damage math to hook it to).
 * That is overview D5's line, held deliberately rather than for want of time.
 *
 * What a passive can do today is be **handed to a character by name**, which is the sheet's own
 * `Character.passiveIds` half of this ticket.
 *
 * `usePassiveManager` decides what the list holds; this renders it.
 *
 * **Validates: v4 systems/14; Requirements 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { PassiveCard } from './PassiveCard';
import { PassiveFormDialog } from './PassiveFormDialog';
import { usePassiveManager } from './usePassiveManager';

export function PassivesConfigPanel() {
  const {
    config,
    passives,
    isPassiveDialogOpen,
    closePassiveDialog,
    editingPassiveId,
    passiveForm,
    handleAddPassive,
    handleEditPassive,
    handleDeletePassive,
    handleSavePassive,
    blocked,
    dismissBlocked,
  } = usePassiveManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <ConfigPanelShell
      title="Passive Abilities"
      description="Resistances, immunities and senses a character can be handed by name"
      actions={
        <Button variant="primary" onClick={handleAddPassive}>
          Add Passive
        </Button>
      }
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {passives.length === 0 ? (
        <ConfigEmptyState message="No passive abilities configured yet. Click 'Add Passive' to start the catalog." />
      ) : (
        <div className="space-y-2">
          {passives.map((passive) => (
            <PassiveCard
              key={passive.id}
              passive={passive}
              onEdit={handleEditPassive}
              onDelete={handleDeletePassive}
            />
          ))}
        </div>
      )}

      <PassiveFormDialog
        isOpen={isPassiveDialogOpen}
        isEditing={!!editingPassiveId}
        form={passiveForm}
        // The ruleset the effect's placeholders are scoped and previewed against. The shell above
        // only renders when there is one, so this is never null by the time the dialog can open.
        config={config}
        onClose={closePassiveDialog}
        onSave={handleSavePassive}
      />
    </ConfigPanelShell>
  );
}
