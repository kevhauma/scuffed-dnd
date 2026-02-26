import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/config/races')({
  component: RacesConfig,
})

function RacesConfig() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Races Configuration</h1>
      <p className="text-gray-600">
        Define character races with skill modifiers.
      </p>
    </div>
  )
}
