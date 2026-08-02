/**
 * Items Configuration Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: Requirements 7.1, 7.5, 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { EquipmentSlotsConfigPanel } from '../../components/config/items/EquipmentSlotsConfigPanel';
import { ItemsConfigPanel } from '../../components/config/items/ItemsConfigPanel';

export const Route = createFileRoute('/config/items')({
  component: ItemsConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function ItemsConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <ItemsConfigPanel />
      <EquipmentSlotsConfigPanel />
    </div>
  );
}
