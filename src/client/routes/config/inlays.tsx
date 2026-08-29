/**
 * Inlays Configuration Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: v4 systems/10; Requirements 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { InlaysConfigPanel } from '../../components/config/inlays/InlaysConfigPanel';

export const Route = createFileRoute('/config/inlays')({
  component: InlaysConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function InlaysConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <InlaysConfigPanel />
    </div>
  );
}
