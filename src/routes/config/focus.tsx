/**
 * Focus Stat Configuration Route
 *
 * Gives focus-stat configuration its own page alongside the other config sections.
 *
 * **Validates: Requirements 19.4, 9.1**
 */

import { createFileRoute } from '@tanstack/react-router';
import { FocusStatConfig } from '../../components/config/focus/FocusStatConfig';

export const Route = createFileRoute('/config/focus')({
  component: FocusConfig,
});

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function FocusConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <FocusStatConfig />
    </div>
  );
}
