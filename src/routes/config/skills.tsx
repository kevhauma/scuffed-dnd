/**
 * Skills Configuration Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: Requirements 2.1, 4.1, 5.1, 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';
import { CombatSkillsPanel } from '../../components/config/skills/combat/CombatSkillsPanel';
import { SpecialitySkillsPanel } from '../../components/config/skills/speciality/SpecialitySkillsPanel';

export const Route = createFileRoute('/config/skills')({
  component: SkillsConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function SkillsConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <SpecialitySkillsPanel />
      <CombatSkillsPanel />
    </div>
  );
}
