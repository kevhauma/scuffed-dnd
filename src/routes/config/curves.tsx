/**
 * Curves Configuration Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: Concept 06; Requirements 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { CurvesConfigPanel } from '../../components/config/curves/CurvesConfigPanel';

export const Route = createFileRoute('/config/curves')({
  component: CurvesConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function CurvesConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <CurvesConfigPanel />
    </div>
  );
}
