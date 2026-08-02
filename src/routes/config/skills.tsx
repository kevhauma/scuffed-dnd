import { createFileRoute } from '@tanstack/react-router';
import { CombatSkillsPanel } from '../../components/config/skills/combat/CombatSkillsPanel';
import { MainSkillsPanel } from '../../components/config/skills/main/MainSkillsPanel';
import { SpecialitySkillsPanel } from '../../components/config/skills/speciality/SpecialitySkillsPanel';

export const Route = createFileRoute('/config/skills')({
  component: SkillsConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function SkillsConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <MainSkillsPanel />
      <SpecialitySkillsPanel />
      <CombatSkillsPanel />
    </div>
  );
}
