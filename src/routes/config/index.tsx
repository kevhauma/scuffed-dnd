import { createFileRoute } from '@tanstack/react-router';

import { ConfigDashboard } from '../../components/config/dashboard/ConfigDashboard';

export const Route = createFileRoute('/config/')({
  component: ConfigIndex,
});

export function ConfigIndex() {
  return <ConfigDashboard />;
}
