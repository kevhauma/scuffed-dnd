/**
 * Spells Configuration Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: v4 systems/13; Requirements 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { SpellsConfigPanel } from '../../components/config/spells/SpellsConfigPanel';

export const Route = createFileRoute('/config/spells')({
  component: SpellsConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function SpellsConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <SpellsConfigPanel />
    </div>
  );
}
