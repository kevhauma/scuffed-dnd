/**
 * Config Dashboard Manager Hook
 *
 * Owns the dashboard's store selectors, the always-on validation status, and the explicit
 * "validate" action. The dashboard renders; this decides.
 *
 * Two distinct things, deliberately kept apart: the **status** is derived on every render, because
 * Requirement 18.6 says the User can see it at any time without asking; the **report** is only
 * written to the session store when the User asks for it (Requirement 18.5).
 *
 * **Validates: Requirements 18.5, 18.6, 1.1, 17.3**
 */

import { useMemo } from 'react';
import { validateConfiguration } from '#shared/engine/validator';
import { useConfigStore } from '../../../stores/configStore';
import { useUIStore } from '../../../stores/uiStore';

/** The configuration areas, in the order the dashboard lists them — reached via `sections` */
const CONFIG_SECTIONS = [
  // Stats first: they are the atom every other section refers to, and since TICKET-STAT-02 they
  // are also where the old "main skills" live — Skills is the one weighted-stat entity now
  {
    to: '/config/stats',
    label: 'Stats',
    description: 'Every numeric axis — invested, derived, or a resource',
  },
  { to: '/config/skills', label: 'Skills', description: 'Competences weighted over stats' },
  { to: '/config/materials', label: 'Materials', description: 'Materials, levels, and categories' },
  {
    to: '/config/inlays',
    label: 'Inlays',
    description: 'Gems a crafted item can be socketed with',
  },
  { to: '/config/items', label: 'Items', description: 'What a character can carry and equip' },
  {
    to: '/config/equipment',
    label: 'Equipment',
    description: 'Where gear goes, and how the sheet lays it out',
  },
  { to: '/config/races', label: 'Races', description: 'Races and their stat blocks' },
  {
    to: '/config/archetypes',
    label: 'Archetypes',
    description: 'What a character is good at growing, per stat',
  },
  {
    to: '/config/rolls',
    label: 'Rolls',
    description: 'What a character rolls, and the dice ladders they run down',
  },
  {
    to: '/config/spells',
    label: 'Spells',
    description: 'The compendium a caster draws from',
  },
  { to: '/config/currency', label: 'Currency', description: 'Currency tiers and conversion rates' },
  {
    to: '/config/constants',
    label: 'Constants',
    description: 'Named numbers your formulas share',
  },
  {
    to: '/config/curves',
    label: 'Curves',
    description: 'Progressions as tables you can read and tune',
  },
] as const;

export function useConfigDashboard() {
  // Hydration is owned by the root layout (useAppHydration) — this only reads the result
  const config = useConfigStore((state) => state.config);
  const isLoaded = useConfigStore((state) => state.isLoaded);
  const initializeConfig = useConfigStore((state) => state.initializeConfig);

  const report = useUIStore((state) => state.validationReport);
  const setValidationReport = useUIStore((state) => state.setValidationReport);

  /** Recomputed whenever the ruleset changes — cheap, pure, and never stale */
  const status = useMemo(() => (config ? validateConfiguration(config) : null), [config]);

  const handleInitialize = () => {
    initializeConfig('My Custom Game System');
  };

  const handleValidate = () => {
    if (!config) return;

    // The report is session state, so it belongs to the UI store rather than to this component
    setValidationReport(validateConfiguration(config));
  };

  return {
    config,
    isLoaded,
    sections: CONFIG_SECTIONS,
    status,
    report,
    /** All three severities as the one flat list the `ValidationReport` primitive takes */
    reportIssues: report ? [...report.errors, ...report.warnings, ...report.information] : [],
    handleInitialize,
    handleValidate,
  };
}
