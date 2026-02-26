import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/config/skills')({
  component: SkillsConfig,
})

function SkillsConfig() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Skills Configuration</h1>
      <p className="text-gray-600">
        Configure Main Skills, Speciality Skills, and Combat Skills.
      </p>
    </div>
  )
}
