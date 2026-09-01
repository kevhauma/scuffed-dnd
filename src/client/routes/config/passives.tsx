/**
 * Passives Configuration Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: v4 systems/14; Requirements 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { PassivesConfigPanel } from '../../components/config/passives/PassivesConfigPanel';

export const Route = createFileRoute('/config/passives')({
  component: PassivesConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function PassivesConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <PassivesConfigPanel />
    </div>
  );
}
