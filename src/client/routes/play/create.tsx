/**
 * Character Creation Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: Requirements 11.1, 19.5**
 */

import { createFileRoute } from '@tanstack/react-router';

import { CharacterCreationWizard } from '../../components/play/creation/CharacterCreationWizard';

export const Route = createFileRoute('/play/create')({
  component: PlayCreate,
});

export function PlayCreate() {
  return <CharacterCreationWizard />;
}
