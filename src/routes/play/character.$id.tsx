import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/play/character/$id')({
  component: CharacterSheet,
})

function CharacterSheet() {
  const { id } = Route.useParams()
  
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Character Sheet</h1>
      <p className="text-gray-600">
        Character {id} details will appear here.
      </p>
    </div>
  )
}
