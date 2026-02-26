import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/config/materials')({
  component: MaterialsConfig,
})

function MaterialsConfig() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Materials Configuration</h1>
      <p className="text-gray-600">
        Configure materials, material levels, and categories.
      </p>
    </div>
  )
}
