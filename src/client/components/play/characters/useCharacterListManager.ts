/**
 * Character List Manager Hook
 *
 * Owns the store selectors, delete-confirmation state, and navigation handlers for the character
 * list. The component renders; this decides.
 *
 * **Validates: Requirements 11.1, 17.4, 21.1-21.5**
 */

import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { calculateCharacterLevel } from '#shared/engine/characterSummary';
import type { Character } from '#shared/types/character';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { type DerivedValue, toDerivedValue } from '../shared/derivedValue';

/**
 * A character with everything the list displays already resolved
 */
export interface CharacterListEntry {
  character: Character;
  /** Race names resolved from the configuration; a deleted race degrades to "Unknown race" */
  raceNames: string[];
  /** Curve-derived since TICKET-RES-01, so it can fail the way any derived value can */
  level: DerivedValue;
}

export function useCharacterListManager() {
  const navigate = useNavigate();

  const config = useConfigStore((state) => state.config);
  const characters = useCharacterStore((state) => state.characters);
  const deleteCharacter = useCharacterStore((state) => state.deleteCharacter);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const races = config?.races ?? [];

  const entries: CharacterListEntry[] = characters.map((character) => ({
    character,
    // **Deliberately not `resolveRaces` (TICKET-RACE-04), and this is the only surface where that
    // is true.** The Kernel's resolver *drops* a pick naming a race the ruleset no longer defines
    // and caps the list at `const.race_count`, because it feeds the blend — and both are wrong for
    // a roster. A card is the one place a Player looks to find out that a character is stale, so it
    // names every id the character actually holds and says `Unknown race` where the ruleset can no
    // longer answer. Swapping this for `resolveRaces` would make a broken character look tidy.
    raceNames: character.raceIds.map(
      (raceId) => races.find((race) => race.id === raceId)?.name ?? 'Unknown race'
    ),
    level: toDerivedValue(config ? calculateCharacterLevel(character, config) : undefined),
  }));

  const pendingDeleteCharacter =
    characters.find((character) => character.id === pendingDeleteId) ?? null;

  const handleCreate = () => {
    navigate({ to: '/play/create' });
  };

  const handleOpen = (id: string) => {
    navigate({ to: '/play/character/$id', params: { id } });
  };

  const handleRequestDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const handleCancelDelete = () => {
    setPendingDeleteId(null);
  };

  const handleConfirmDelete = () => {
    if (!pendingDeleteId) return;

    // Persistence belongs to the store action, not to this hook
    deleteCharacter(pendingDeleteId);
    setPendingDeleteId(null);
  };

  return {
    config,
    entries,
    hasConfiguration: config !== null,
    pendingDeleteCharacter,
    handleCreate,
    handleOpen,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  };
}
