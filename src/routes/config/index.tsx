import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/config/')({
  component: ConfigDashboard,
})

function ConfigDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Configuration Dashboard</h1>
      <p className="text-gray-600">
        Configure your custom DnD experience here.
      </p>
    </div>
  )
}
