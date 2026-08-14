/**
 * Shared Skill Identity Tests
 *
 * `useSkillCodeRename` retired with TICKET-SKL-02: it re-keyed a character's
 * `specialitySkillBaseLevels`, which was keyed by a mutable 3-letter code. `investedSkillPoints`
 * is keyed by skill **id**, so there is no second half of a rename left for a hook to apply.
 * `characterStore.test.ts` pins that from the store's side.
 *
 * What is left here is `resolveSkillId`, which still serves the **combat** skill manager — the one
 * skill kind that still addresses its entity by a code (TICKET-ROLL-05/06 retires it).
 *
 * **Validates: Concept 00 §6 (TICKET-REF-01)**
 */

import { describe, expect, it } from 'vitest';
import { resolveSkillId } from './skillIdentity';

const skills = [
  { id: 'id-str', code: 'STR' },
  { id: 'id-dex', code: 'DEX' },
];

describe('resolveSkillId', () => {
  it('keeps the id of the skill being edited', () => {
    expect(resolveSkillId(skills, 'DEX')).toBe('id-dex');
  });

  it('mints an id when adding', () => {
    const id = resolveSkillId(skills, null);

    expect(id).not.toBe('id-str');
    expect(id).not.toBe('id-dex');
    expect(id).toBeTruthy();
  });

  it('mints an id when the edited code names no skill', () => {
    expect(resolveSkillId(skills, 'GONE')).toBeTruthy();
    expect(resolveSkillId(skills, 'GONE')).not.toBe('id-str');
  });
});
