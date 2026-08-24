/**
 * Constants Configuration Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: Concept 05; Requirements 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { ConstantsConfigPanel } from '../../components/config/constants/ConstantsConfigPanel';

export const Route = createFileRoute('/config/constants')({
  component: ConstantsConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function ConstantsConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <ConstantsConfigPanel />
    </div>
  );
}
