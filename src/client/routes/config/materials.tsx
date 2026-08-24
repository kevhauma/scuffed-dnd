/**
 * Materials Configuration Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: Requirements 6.1, 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { MaterialsConfigPanel } from '../../components/config/materials/MaterialsConfigPanel';

export const Route = createFileRoute('/config/materials')({
  component: MaterialsConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function MaterialsConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <MaterialsConfigPanel />
    </div>
  );
}
