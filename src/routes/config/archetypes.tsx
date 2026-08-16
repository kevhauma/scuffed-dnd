/**
 * Archetypes Configuration Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: Concept 03; Requirements 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { ArchetypesConfigPanel } from '../../components/config/archetypes/ArchetypesConfigPanel';

export const Route = createFileRoute('/config/archetypes')({
  component: ArchetypesConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function ArchetypesConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <ArchetypesConfigPanel />
    </div>
  );
}
