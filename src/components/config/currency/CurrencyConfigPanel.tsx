/**
 * Currency Configuration Panel
 * 
 * Manages currency tiers with reordering, conversion rates, and calculator preview.
 * 
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.5, 21.1-21.5**
 */

import { useCurrencyManager } from './useCurrencyManager';
import { CurrencyTierCard } from './CurrencyTierCard';
import { CurrencyFormDialog } from './CurrencyFormDialog';
import { ConversionCalculator } from './ConversionCalculator';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export function CurrencyConfigPanel() {
  const {
    config,
    currentTiers,
    isDialogOpen,
    setIsDialogOpen,
    editingTierId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    handleMoveUp,
    handleMoveDown,
  } = useCurrencyManager();

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
            <Text variant="h4" as="h2" className="mb-2">Currency Tiers</Text>
            <Text variant="body-secondary">
              Define your monetary system with multiple currency tiers and conversion rates
            </Text>
          </div>
          <Button variant="primary" onClick={handleAdd}>
            Add Currency Tier
          </Button>
        </div>

        <div className="mt-4 p-4 bg-parchment-100 border border-stone-200 rounded">
          <Text variant="body-small" className="text-ink-700">
            <strong>Tip:</strong> Order tiers from lowest to highest value. Use the arrow buttons to reorder.
            The conversion rate determines how many of one tier equals 1 of the next tier.
          </Text>
        </div>
      </Card>

      {/* Currency Tiers List */}
      {currentTiers.length === 0 ? (
        <Card className="p-6">
          <Text variant="body-secondary" className="text-center">
            No currency tiers configured yet. Click 'Add Currency Tier' to create your first tier.
          </Text>
        </Card>
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

      {/* Conversion Calculator */}
      {currentTiers.length > 1 && (
        <ConversionCalculator tiers={currentTiers} />
      )}

      {/* Form Dialog */}
      <CurrencyFormDialog
        isOpen={isDialogOpen}
        isEditing={!!editingTierId}
        form={form}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
