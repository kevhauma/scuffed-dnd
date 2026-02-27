import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useConfigStore } from '../../stores/configStore'
import { MainSkillsPanel } from '../../components/config/skills/main/MainSkillsPanel'
import { SpecialitySkillsPanel } from '../../components/config/skills/speciality/SpecialitySkillsPanel'
import { CombatSkillsPanel } from '../../components/config/skills/combat/CombatSkillsPanel'
import { Button } from '../../components/ui/Button/Button'
import { Card } from '../../components/ui/Card/Card'
import { Text } from '../../components/ui/Text/Text'

export const Route = createFileRoute('/config/')({
  component: ConfigDashboard,
})

function ConfigDashboard() {
  const config = useConfigStore((state) => state.config)
  const isLoaded = useConfigStore((state) => state.isLoaded)
  const loadConfig = useConfigStore((state) => state.loadConfig)
  const initializeConfig = useConfigStore((state) => state.initializeConfig)

  useEffect(() => {
    if (!isLoaded) {
      loadConfig()
    }
  }, [isLoaded, loadConfig])

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuration Dashboard</h1>
        <p className="text-gray-600">Configure your custom game system: {config.name}</p>
      </div>
      
      <div className="space-y-8">
        <MainSkillsPanel />
        <SpecialitySkillsPanel />
        <CombatSkillsPanel />
      </div>
    </div>
  )
}
