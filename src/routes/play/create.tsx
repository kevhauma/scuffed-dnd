import { createFileRoute } from '@tanstack/react-router'

import { CharacterCreationWizard } from '../../components/play/creation/CharacterCreationWizard'

export const Route = createFileRoute('/play/create')({
  component: PlayCreate,
})

export function PlayCreate() {
  return <CharacterCreationWizard />
}
