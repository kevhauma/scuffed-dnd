import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/config/stats')({
  component: StatsConfig,
})

function StatsConfig() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Stats Configuration</h1>
      <p className="text-gray-600">
        Define stats derived from main skills using custom formulas.
      </p>
    </div>
  )
}
