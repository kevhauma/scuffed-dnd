/**
 * Character List Route
 *
 * Mounts the feature component and passes route params down.
 *
 * **Validates: Requirements 11.1, 19.5**
 */

import { createFileRoute } from '@tanstack/react-router';

import { CharacterList } from '../../components/play/characters/CharacterList';

export const Route = createFileRoute('/play/')({
  component: PlayIndex,
});

export function PlayIndex() {
  return <CharacterList />;
}
