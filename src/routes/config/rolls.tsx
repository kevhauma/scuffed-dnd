/**
 * Rolls Configuration Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: Concepts 07, 08; Requirements 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { DiceLaddersConfigPanel } from '../../components/config/rolls/DiceLaddersConfigPanel';
import { RollsConfigPanel } from '../../components/config/rolls/RollsConfigPanel';

export const Route = createFileRoute('/config/rolls')({
  component: RollsConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function RollsConfig() {
  return (
    // Two panels, like `/config/items` and `/config/skills`: a roll and the ladder it decomposes
    // down are separate entities, and each owns its own `ConfigPanelShell`
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <RollsConfigPanel />
      <DiceLaddersConfigPanel />
    </div>
  );
}
