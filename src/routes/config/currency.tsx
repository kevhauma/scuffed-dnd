import { createFileRoute } from '@tanstack/react-router'
import { CurrencyConfigPanel } from '../../components/config/currency/CurrencyConfigPanel'

export const Route = createFileRoute('/config/currency')({
  component: CurrencyConfig,
})

/** Exported for tests: automatic code splitting makes `Route.options.component` a lazy wrapper. */
export function CurrencyConfig() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <CurrencyConfigPanel />
    </div>
  )
}
