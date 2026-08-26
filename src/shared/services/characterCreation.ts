/**
 * What a new Character is, and what makes one legal (TICKET-CHAR-04)
 *
 * **The Kernel's answer, so there is one** ([D5](../../../docs/v3.0_backend/overview.md#d5--the-engine-is-the-shared-kernel-and-the-server-is-authoritative)).
 * Until this ticket a character could only be made in one place — `characterStore.createCharacter`,
 * in the browser — so the rules lived there and that was fine. CHAR-04 gives a character a second
 * home, and a second implementation of *is this affordable* is exactly the thing that ends with a
 * table where two people's sheets were priced differently.
 *
 * So: the browser's store calls these, and `POST /api/sessions/:id/characters` calls these, and
 * neither restates a rule. The server re-derives and trusts nothing in the request body; the client
 * still checks first, because a wizard that let a Player finish and then refused them would be a
 * worse wizard — its answer is a prediction and the server's is the one that counts.
 *
 * ## What is *not* here
 *
 * **Where the character goes.** A local one is appended to `dnd_builder_characters` by a store
 * action; a session one becomes a `character` row. That is persistence, and persistence belongs to
 * the store action on one side and to a repository on the other.
 *
 * **Anything about ids or clocks.** Both are passed in, so this module is a pure function of its
 * arguments — the server mints a UUID and stamps a server clock, the browser mints its own, and
 * neither has to reach for a global that `shared/` is not allowed to have.
 *
 * **Validates: v1.0 Req 11.2, 11.3; v3 Req 40.2, 40.5, 45.1**
 */

import { calculateCharacter } from '../engine/calculator';
import { MAX_RACE_COUNT } from '../engine/calculators/statCalculator';
import { asNumber } from '../engine/formula/errors';
import { type StatAllocationResult, validateStatAllocation } from '../engine/skillAllocation';
import type { Character, CharacterCreationData } from '../types/character';
import type { Configuration } from '../types/config';

/** What a character needs beyond the Player's choices — supplied, never invented here */
export interface CharacterIdentity {
  id: string;
  /** An ISO timestamp; `createdAt` and `updatedAt` both take it */
  now: string;
}

/**
 * The character a set of choices would become, before anybody has judged it
 *
 * **A fresh character starts at full**, which is the one interesting line: `currentResourceValues`
 * is seeded from the Snapshot's calculated maxima, because a Player expects a new character to be
 * at full health rather than at zero. Only `isResource` stats are seeded — a stat you cannot spend
 * has no *current* distinct from its value (TICKET-STAT-01) — and a resource whose formula could
 * not be evaluated starts **absent** rather than at a made-up zero, so the sheet can chip it where
 * the Player can act on it.
 *
 * **Everything else derived is left out.** No stat values, no level, no budget: those are read from
 * the calculator at display time, which is the rule the whole engine rests on.
 *
 * @param data The Player's choices
 * @param config The ruleset they were made against — the browser's `Configuration`, or a Snapshot
 * @param identity The id and the moment, from whichever side is calling
 * @returns The character as it would be stored
 */
export function buildCharacter(
  data: CharacterCreationData,
  config: Configuration,
  identity: CharacterIdentity
): Character {
  const character: Character = {
    id: identity.id,
    name: data.name,
    configurationId: config.id,
    raceIds: data.raceIds,
    investedStatPoints: data.investedStatPoints,
    archetypeId: data.archetypeId,
    investedSkillPoints: data.investedSkillPoints,
    currentResourceValues: {},
    // A fresh character has earned nothing, which the seeded curve reads as level 1 (TICKET-RES-01)
    experience: 0,
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: identity.now,
    updatedAt: identity.now,
  };

  return { ...character, currentResourceValues: seedResources(character, config) };
}

/**
 * Every resource stat at its maximum, as far as the ruleset can say
 *
 * @param character The character being created
 * @param config The ruleset it is being created against
 * @returns The seeded values; empty when the ruleset cannot produce any
 */
function seedResources(character: Character, config: Configuration): Record<string, number> {
  try {
    const { statValues } = calculateCharacter(character, config);
    const resourceIds = new Set(
      config.stats.filter((stat) => stat.isResource).map((stat) => stat.id)
    );

    const seeded: Record<string, number> = {};

    for (const [statId, result] of Object.entries(statValues)) {
      if (!resourceIds.has(statId)) continue;

      const max = asNumber(result);
      if (max !== undefined) seeded[statId] = max;
    }

    return seeded;
  } catch {
    // A ruleset with a broken formula must not block character creation; the sheet surfaces the
    // formula error where it can be acted on
    return {};
  }
}

/**
 * Why this character may not be created, in the Player's words (v3 Req 40.2, 40.5)
 *
 * **An array rather than a boolean**, and that is the difference from the v1.0 store action this
 * replaces. `createCharacter` returned `null` and the wizard's step happened to have blocked the
 * same thing a moment earlier, so nobody ever read the refusal. A *server* refusing a request has
 * nobody standing beside it, so it has to say which rule was broken.
 *
 * Three rules, and they are the three the wizard enforces:
 *
 * - **A blend is at most {@link MAX_RACE_COUNT}.** Past that the sheet's hybrid has no meaning.
 *   There is deliberately **no lower bound**: a ruleset may define no races at all, and a raceless
 *   character is a coherent state the sheet has an empty state for (v1.0 Req 11.2).
 * - **An archetype is required when the ruleset defines any**, and refused when it does not name
 *   one this ruleset has. A ruleset with no archetypes leaves the field empty, the same way
 *   TICKET-ARC-03 kept it optional on the type.
 * - **The allocation has to be affordable**, which is `validateStatAllocation`'s verdict and not a
 *   second opinion — the same call the level-up spend makes, so creation and levelling cannot
 *   disagree about what a point costs.
 *
 * @param data The Player's choices
 * @param config The ruleset they were made against
 * @returns One sentence per broken rule; empty when the character may be created
 */
export function characterCreationErrors(
  data: CharacterCreationData,
  config: Configuration
): string[] {
  const errors: string[] = [];

  if (data.name.trim() === '') errors.push('A character needs a name.');

  if (data.raceIds.length > MAX_RACE_COUNT) {
    errors.push(`A character is a blend of at most ${MAX_RACE_COUNT} races.`);
  }

  for (const raceId of data.raceIds) {
    if (!config.races.some((race) => race.id === raceId)) {
      errors.push('That is not a race this ruleset has.');
      break;
    }
  }

  errors.push(...archetypeErrors(data, config));

  // **Skills, which nothing else looks at.** `validateStatAllocation` below prices the *stat*
  // allocation and has a violation for every way one can be wrong; the skill map has no engine
  // equivalent — `skillCalculator` reads it straight into a level — so points spent on a skill this
  // ruleset does not have would raise the level of nothing and sit on the sheet forever. The
  // browser's `setInvestedSkillPoints` has always refused them; this is where the server does.
  for (const skillId of Object.keys(data.investedSkillPoints)) {
    if (!(config.skills ?? []).some((skill) => skill.id === skillId)) {
      errors.push('Points were put into a skill this ruleset does not have.');
      break;
    }
  }

  // Built rather than judged from the raw choices: the budget depends on level, level on
  // experience, and a fresh character's experience is what `buildCharacter` sets
  const allocation = validateStatAllocation(
    buildCharacter(data, config, { id: 'unsaved', now: '' }),
    config
  );

  if (!allocation.isValid) errors.push(allocationRefusal(allocation));

  return errors;
}

/**
 * Why an allocation was refused, said in the terms the Player allocated in
 *
 * The first violation rather than all of them: they are usually one mistake seen from several
 * stats, and a refusal that lists six is one nobody reads. The budget line is the fallback, and it
 * names both numbers because *over budget* without them is a refusal you cannot act on.
 *
 * @param allocation The engine's verdict
 * @returns One sentence
 */
function allocationRefusal(allocation: StatAllocationResult): string {
  const [violation] = allocation.violations;

  if (violation) return `${violation.statName} cannot take those points.`;

  if (allocation.unknownStatIds.length > 0) {
    return 'Points were allocated to a stat this ruleset does not have.';
  }

  const budget = asNumber(allocation.pointBudget);

  return budget === undefined
    ? 'This ruleset cannot say how many points a new character has to spend.'
    : `That allocation spends ${allocation.pointsSpent} points and the budget is ${budget}.`;
}

/**
 * Whether the archetype pick is one this ruleset accepts
 *
 * @param data The Player's choices
 * @param config The ruleset
 * @returns The refusal, or nothing
 */
function archetypeErrors(data: CharacterCreationData, config: Configuration): string[] {
  const { archetypeId } = data;
  // Optional on the type, because a ruleset written before archetypes existed has none at all —
  // absent and empty are the same thing to this rule, and reading them as one is what keeps such a
  // ruleset usable
  const archetypes = config.archetypes ?? [];

  if (archetypes.length === 0) {
    // Not merely tolerated — a ruleset with no archetypes must not be made unusable by a rule
    // about rulesets that have them (TICKET-ARC-03)
    return archetypeId ? ['This ruleset has no archetypes to choose from.'] : [];
  }

  if (!archetypeId) return ['A character needs an archetype.'];

  return archetypes.some((archetype) => archetype.id === archetypeId)
    ? []
    : ['That is not an archetype this ruleset has.'];
}
