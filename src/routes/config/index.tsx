import { createFileRoute, Link } from '@tanstack/react-router'
import { useConfigStore } from '../../stores/configStore'
import { Button } from '../../components/ui/Button/Button'
import { Card } from '../../components/ui/Card/Card'
import { Text } from '../../components/ui/Text/Text'

export const Route = createFileRoute('/config/')({
  component: ConfigDashboard,
})

const CONFIG_SECTIONS = [
  { to: '/config/skills', label: 'Skills', description: 'Main, speciality, and combat skills' },
  { to: '/config/stats', label: 'Stats', description: 'Stats derived from main skills via formulas' },
  { to: '/config/materials', label: 'Materials', description: 'Materials, levels, and categories' },
  { to: '/config/items', label: 'Items', description: 'Items and equipment slots' },
  { to: '/config/races', label: 'Races', description: 'Races and their skill modifiers' },
  { to: '/config/currency', label: 'Currency', description: 'Currency tiers and conversion rates' },
  { to: '/config/focus', label: 'Focus Stat', description: 'Bonus level granted by a focus stat' },
] as const

export function ConfigDashboard() {
  // Hydration is owned by the root layout (useAppHydration) — this route only reads the result
  const config = useConfigStore((state) => state.config)
  const isLoaded = useConfigStore((state) => state.isLoaded)
  const initializeConfig = useConfigStore((state) => state.initializeConfig)

  const handleInitialize = () => {
    initializeConfig('My Custom Game System')
  }

  if (!isLoaded) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="p-8 text-center">
          <Text variant="body">Loading configuration...</Text>
        </Card>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="p-8 text-center">
          <Text variant="h2" className="mb-4">No Configuration Found</Text>
          <Text variant="body" className="mb-6">
            You need to initialize a configuration before you can start adding skills and other game elements.
          </Text>
          <Button variant="primary" onClick={handleInitialize}>
            Initialize New Configuration
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <Text variant="h1" as="h1" className="mb-2">Configuration Dashboard</Text>
        <Text variant="body-secondary">Configure your custom game system: {config.name}</Text>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONFIG_SECTIONS.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className="block rounded-lg hover:shadow-parchment-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            <Card className="h-full">
              <Text variant="h5" as="h2" className="mb-1">{section.label}</Text>
              <Text variant="body-small-secondary">{section.description}</Text>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
