/**
 * Items Configuration Route
 *
 * Mounts the feature component and passes route params down.
 *
 * Equipment slots moved to [`/config/equipment`](./equipment.tsx) in TICKET-INV-02: two entities
 * with unrelated editors shared this page only because an item can name a slot, and the display
 * builder made the second half a screenful of its own.
 *
 * **Validates: Requirements 7.1, 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { ItemsConfigPanel } from '../../components/config/items/ItemsConfigPanel';

export const Route = createFileRoute('/config/items')({
  component: ItemsConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function ItemsConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <ItemsConfigPanel />
    </div>
  );
}
