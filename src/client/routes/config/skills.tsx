/**
 * Skills Configuration Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: Requirements 2.1, 4.1, 5.1, 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { SkillsPanel } from '../../components/config/skills/skill/SkillsPanel';

export const Route = createFileRoute('/config/skills')({
  component: SkillsConfig,
});

/**
 * Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper.
 *
 * One panel since TICKET-ROLL-06 — the combat half moved to `/config/rolls` as roll definitions,
 * which is where a thing that produces dice belongs.
 */
export function SkillsConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <SkillsPanel />
    </div>
  );
}
