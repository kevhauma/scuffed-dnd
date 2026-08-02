/**
 * Configuration Dashboard Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: Requirements 18.5, 18.6, 19.4**
 */

import { createFileRoute } from '@tanstack/react-router';

import { ConfigDashboard } from '../../components/config/dashboard/ConfigDashboard';

export const Route = createFileRoute('/config/')({
  component: ConfigIndex,
});

export function ConfigIndex() {
  return <ConfigDashboard />;
}
