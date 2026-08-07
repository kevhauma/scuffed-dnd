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
import { validateConfiguration } from '../../../engine/validator';
import { useConfigStore } from '../../../stores/configStore';
import { useUIStore } from '../../../stores/uiStore';

/** The eight configuration areas, in the order the dashboard lists them — reached via `sections` */
const CONFIG_SECTIONS = [
  { to: '/config/skills', label: 'Skills', description: 'Main, speciality, and combat skills' },
  {
    to: '/config/stats',
    label: 'Stats',
    description: 'Stats derived from main skills via formulas',
  },
  { to: '/config/materials', label: 'Materials', description: 'Materials, levels, and categories' },
  { to: '/config/items', label: 'Items', description: 'Items and equipment slots' },
  { to: '/config/races', label: 'Races', description: 'Races and their skill modifiers' },
  { to: '/config/currency', label: 'Currency', description: 'Currency tiers and conversion rates' },
  {
    to: '/config/constants',
    label: 'Constants',
    description: 'Named numbers your formulas share',
  },
  { to: '/config/focus', label: 'Focus Stat', description: 'Bonus level granted by a focus stat' },
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
    /** Errors and warnings as the one flat list the `ValidationReport` primitive takes */
    reportIssues: report ? [...report.errors, ...report.warnings] : [],
    handleInitialize,
    handleValidate,
  };
}
