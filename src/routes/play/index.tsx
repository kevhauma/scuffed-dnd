import { createFileRoute } from '@tanstack/react-router';

import { CharacterList } from '../../components/play/characters/CharacterList';

export const Route = createFileRoute('/play/')({
  component: PlayIndex,
});

export function PlayIndex() {
  return <CharacterList />;
}
