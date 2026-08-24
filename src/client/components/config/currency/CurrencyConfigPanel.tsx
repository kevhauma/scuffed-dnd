/**
 * Currency Configuration Panel
 *
 * Manages currency tiers with reordering, conversion rates, and calculator preview.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.5, 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { ConversionCalculator } from './ConversionCalculator';
import { CurrencyFormDialog } from './CurrencyFormDialog';
import { CurrencyTierCard } from './CurrencyTierCard';
import { useCurrencyManager } from './useCurrencyManager';

export function CurrencyConfigPanel() {
  const {
    config,
    currentTiers,
    isDialogOpen,
    closeDialog,
    editingTierId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    handleMoveUp,
    handleMoveDown,
    blocked,
    dismissBlocked,
  } = useCurrencyManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <ConfigPanelShell
      title="Currency Tiers"
      description="Define your monetary system with multiple currency tiers and conversion rates"
      actions={
        <Button variant="primary" onClick={handleAdd}>
          Add Currency Tier
        </Button>
      }
      headerExtra={
        <div className="mt-4 p-4 bg-parchment-100 border border-stone-200 rounded">
          <Text variant="body-small" className="text-ink-700">
            <strong>Tip:</strong> Order tiers from lowest to highest value. Use the arrow buttons to
            reorder. The conversion rate determines how many of one tier equals 1 of the next tier.
          </Text>
        </div>
      }
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {currentTiers.length === 0 ? (
        <ConfigEmptyState message="No currency tiers configured yet. Click 'Add Currency Tier' to create your first tier." />
      ) : (
        <div className="space-y-3">
          {currentTiers.map((tier, index) => (
            <CurrencyTierCard
              key={tier.id}
              tier={tier}
              isFirst={index === 0}
              isLast={index === currentTiers.length - 1}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
            />
          ))}
        </div>
      )}

      {currentTiers.length > 1 && <ConversionCalculator tiers={currentTiers} />}

      <CurrencyFormDialog
        isOpen={isDialogOpen}
        isEditing={!!editingTierId}
        form={form}
        onClose={closeDialog}
        onSave={handleSave}
      />
    </ConfigPanelShell>
  );
}
