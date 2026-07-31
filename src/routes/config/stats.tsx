import { createFileRoute } from '@tanstack/react-router'
import { StatsConfigPanel } from '../../components/config/stats/StatsConfigPanel'

export const Route = createFileRoute('/config/stats')({
  component: StatsConfig,
})

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function StatsConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <StatsConfigPanel />
    </div>
  )
}
