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
