import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/config/currency')({
  component: CurrencyConfig,
})

function CurrencyConfig() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Currency Configuration</h1>
      <p className="text-gray-600">
        Define currency tiers and conversion rates.
      </p>
    </div>
  )
}
