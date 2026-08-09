/**
 * Character Summary
 *
 * The one definition of a character's "level", and the lightweight summary the character list
 * renders. Pure — no React, no storage.
 *
 * **Level is the sum of the character's allocated main skill levels.** It deliberately excludes
 * racial, equipment and focus modifiers: a level describes what the Player invested, and should
 * not change when they take a hat off. Every screen showing a level reads it from here, so the
 * definition stays in one place — if it should mean something else, change it here only.
 *
 * **Validates: Requirements 11.1, 21.1-21.5**
 */

import type { Character, CharacterSummary } from '../types/character';

/**
 * Sum a character's allocated main skill levels
 *
 * @param character - The character to measure
 * @returns The character's level, `0` for an unallocated character
 */
export function calculateCharacterLevel(character: Character): number {
  return Object.values(character.investedStatPoints).reduce((sum, points) => sum + points, 0);
}

/**
 * Reduce a character to the fields a list needs
 *
 * @param character - The character to summarise
 * @returns Identity, races, derived level, and creation date
 */
export function toCharacterSummary(character: Character): CharacterSummary {
  return {
    id: character.id,
    name: character.name,
    raceIds: character.raceIds,
    level: calculateCharacterLevel(character),
    createdAt: character.createdAt,
  };
}
