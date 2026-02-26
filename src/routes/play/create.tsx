import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/play/create')({
  component: CharacterCreation,
})

function CharacterCreation() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Create Character</h1>
      <p className="text-gray-600">
        Character creation wizard will appear here.
      </p>
    </div>
  )
}
