/**
 * Races Configuration Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: Requirements 8.1, 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { RacesConfigPanel } from '../../components/config/races/RacesConfigPanel';

export const Route = createFileRoute('/config/races')({
  component: RacesConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function RacesConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <RacesConfigPanel />
    </div>
  );
}
