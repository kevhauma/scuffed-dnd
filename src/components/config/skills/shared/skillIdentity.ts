/**
 * Shared skill identity helpers
 *
 * A skill's `id` is what every formula, racial modifier and material bonus points at, so an edit
 * must carry the existing one through and only a genuinely new skill may mint one. All three
 * skill managers address the skill being edited by its *old* code, which is what this resolves
 * against.
 *
 * A rename has a second half: character allocations are keyed by skill code, and the character
 * store owns that data, so the manager applies both store actions rather than letting one store
 * reach into the other.
 *
 * **Validates: Concept 00 §6 (TICKET-REF-01)**
 */

import { useCharacterStore } from '../../../../stores/characterStore';

/**
 * The id a saved skill should carry
 *
 * @param skills - The current skills of that kind
 * @param editingCode - The code of the skill being edited, or null when adding
 * @returns The existing skill's id, or a fresh one
 */
export function resolveSkillId(
  skills: readonly { id: string; code: string }[],
  editingCode: string | null
): string {
  const existing = editingCode ? skills.find((skill) => skill.code === editingCode) : undefined;
  return existing?.id ?? crypto.randomUUID();
}

/**
 * Carry a skill code rename into the characters built on it
 *
 * Returns a no-op for an add, or for an edit that left the code alone. The configuration side of
 * the rename needs nothing here — `configStore`'s update actions re-spell formulas on their own.
 *
 * @returns `(previousCode, nextCode) => void`, safe to call after every save
 */
export function useSkillCodeRename(): (previousCode: string | null, nextCode: string) => void {
  const renameSkillCode = useCharacterStore((state) => state.renameSkillCode);

  return (previousCode, nextCode) => {
    if (!previousCode || previousCode === nextCode) return;
    renameSkillCode(previousCode, nextCode);
  };
}
