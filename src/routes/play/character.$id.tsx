import { createFileRoute } from '@tanstack/react-router';

import { CharacterSheet } from '../../components/play/sheet/CharacterSheet';

export const Route = createFileRoute('/play/character/$id')({
  component: PlayCharacterSheet,
});

export function PlayCharacterSheet() {
  const { id } = Route.useParams();

  return <CharacterSheet characterId={id} />;
}
