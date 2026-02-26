import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/play/')({
  component: CharacterList,
})

function CharacterList() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Characters</h1>
      <p className="text-gray-600">
        Your characters will appear here.
      </p>
    </div>
  )
}
