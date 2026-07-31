import { createFileRoute } from '@tanstack/react-router'
import { RacesConfigPanel } from '../../components/config/races/RacesConfigPanel'

export const Route = createFileRoute('/config/races')({
  component: RacesConfig,
})

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function RacesConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <RacesConfigPanel />
    </div>
  )
}
