import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/config/items')({
  component: ItemsConfig,
})

function ItemsConfig() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Items Configuration</h1>
      <p className="text-gray-600">
        Configure items and equipment slots.
      </p>
    </div>
  )
}
