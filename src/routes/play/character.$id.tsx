/**
 * Character Sheet Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: Requirements 19.5**
 */

import { createFileRoute } from '@tanstack/react-router';

import { CharacterSheet } from '../../components/play/sheet/CharacterSheet';

export const Route = createFileRoute('/play/character/$id')({
  component: PlayCharacterSheet,
});

export function PlayCharacterSheet() {
  const { id } = Route.useParams();

  return <CharacterSheet characterId={id} />;
}
