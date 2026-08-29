/**
 * Reference Walker
 *
 * "What points at this?", answered over a configuration and the characters built on it
 * (Concept 00 §6). A delete action calls this before removing anything: while the list comes back
 * non-empty the delete is refused, so a ruleset cannot be quietly corrupted from the UI.
 *
 * A pure function over `(target, config, characters)` — it reads data from two stores but owns
 * neither, which is why it lives here rather than in either of them. Formula references come from
 * the parser (`validateFormula`), never from substring matching, so `STR` inside `STRENGTH` is not
 * a reference and a code named in a comment-free expression is.
 *
 * References are reported in **display** terms — a skill by its code, a stat by its name-slug —
 * because that is the form the in-memory configuration is in (TICKET-REF-01).
 *
 * **Validates: Concept 00 §6; spec §3.2; Requirements 2.5, 2.6, 18.1, 18.3**
 */

import type { Character } from '../types/character';
import type { Configuration, MaterialLevel } from '../types/config';
import { skillMemberName, statMemberName } from './formula/references';
import { validateFormula } from './formula/validator';

/**
 * The kinds of entity a delete can target
 *
 * One row per guarded delete action.
 */
export type ReferenceTargetKind =
  | 'constant'
  | 'curve'
  | 'curve-column'
  | 'skill'
  | 'dice-ladder'
  | 'roll-definition'
  | 'stat'
  | 'race'
  | 'archetype'
  | 'item'
  | 'inlay'
  | 'material'
  | 'material-category'
  | 'equipment-slot'
  | 'currency-tier';

/**
 * What is about to be deleted
 *
 * `id` is whatever the matching delete action takes: a **code** for the three skill kinds, a
 * **type** for an equipment slot, and the entity's `id` for everything else.
 */
export interface ReferenceTarget {
  kind: ReferenceTargetKind;
  id: string;
}

/**
 * One thing that points at the target
 *
 * Enough to name the holder in a dialog and, later, to link to it.
 */
export interface EntityReference {
  /** Human label for what holds the reference — "Stat", "Character", "Item" */
  holderKind: string;
  /** The holder's display name */
  holderName: string;
  /** Which of the holder's fields points at the target */
  field: string;
  /** The holder's own identifier, for a jump-to link */
  holderId: string;
}

/**
 * Whether a formula names an entity, given how that kind of entity is spelled
 *
 * Namespace-aware on purpose: a stat slugged `bonus_divider` and a constant named
 * `bonus_divider` are different things, and matching `const.bonus_divider` against the constant
 * and `stats.bonus_divider` against the stat is what keeps one from blocking the other's delete.
 * The cycle detector reads references the same way since CR-01 — see `resolveReferenceId`.
 */
type ReferenceMatcher = (formula: string) => boolean;

/** How a roll names itself in a reference list — the entity's own name, like `Combat Skill` */
const ROLL_HOLDER_KIND = 'Roll Definition';

/**
 * A bare code in the flat formula space — `STR`
 *
 * Since TICKET-ROLL-06 that space holds **stat abbreviations and nothing else**: the combat skill
 * codes that shared it went with the entity, and a `Skill` left it in TICKET-SKL-02. So this had a
 * second clause matching `skills.<code>`, which is now unreachable — a skill is named by slug, and
 * the stat branch already matches `stats.<slug>` separately — and it is gone with the codes.
 */
function namesBareCode(code: string): ReferenceMatcher {
  return (formula) => validateFormula(formula).referencedVariables.includes(code);
}

/**
 * A curve's value column — the property segment of `curve.point_buy.main(9)`
 *
 * A column became a referenceable entity when it became renamable (TICKET-CRV-03), so removing
 * one has to be guarded like every other delete. A curve with exactly one column may be called
 * without naming it, so for that curve a bare `curve.xp_thresholds(x)` counts too: it reads that
 * column, and removing it would break the call just the same.
 */
function namesColumn(
  curveName: string,
  columnName: string,
  isOnlyColumn: boolean
): ReferenceMatcher {
  return (formula) =>
    validateFormula(formula).namespacedReferences.some(
      (reference) =>
        reference.namespace === 'curve' &&
        reference.member === curveName &&
        (reference.property === columnName || (isOnlyColumn && reference.property === undefined))
    );
}

/** A namespace member and nothing else — `stats.max_health`, `const.bonus_divider` */
function namesMember(namespace: string, member: string): ReferenceMatcher {
  return (formula) =>
    validateFormula(formula).namespacedReferences.some(
      (reference) => reference.namespace === namespace && reference.member === member
    );
}

/**
 * Every formula in the configuration, paired with the entity that owns it
 *
 * One list rather than a parallel pair: the reference and the text it was read from have to stay
 * together, and a fourth formula-bearing entity should be impossible to add to one half only.
 */
function formulaSources(config: Configuration): { reference: EntityReference; formula: string }[] {
  return [
    // Only derived stats carry a formula; an invested one names nothing (TICKET-STAT-01)
    ...config.stats
      .filter((stat) => stat.formula !== undefined)
      .map((stat) => ({
        reference: {
          holderKind: 'Stat',
          holderName: stat.name,
          field: 'formula',
          holderId: stat.id,
        },
        formula: stat.formula as string,
      })),
    // A curve column's generator is user-authored formula text like any other (TICKET-CRV-02),
    // so a constant named only from one still blocks that constant's delete
    ...(config.curves ?? []).flatMap((curve) =>
      curve.columns
        .filter((column) => column.generator !== undefined)
        .map((column) => ({
          reference: {
            holderKind: 'Curve Column',
            holderName: `${curve.displayName} · ${column.name}`,
            field: 'generator',
            holderId: column.id,
          },
          formula: column.generator as string,
        }))
    ),
    // A roll's input is persisted formula text (TICKET-ROLL-05), so a stat named only by a roll
    // still blocks that stat's delete — the roll would otherwise start reporting an undefined
    // variable the moment somebody pressed it
    ...(config.rollDefinitions ?? []).map((roll) => ({
      reference: {
        holderKind: ROLL_HOLDER_KIND,
        holderName: roll.name,
        field: 'input',
        holderId: roll.id,
      },
      formula: roll.input,
    })),
  ];
}

/**
 * Formulas naming `key`, excluding the entity being deleted — its own formula goes with it
 *
 * `ownId` is the target's stable id, matched against `holderId`, so the exclusion survives a
 * rename (TICKET-REF-01) rather than depending on a spelling.
 */
function formulaReferences(
  config: Configuration,
  names: ReferenceMatcher,
  ownId: string
): EntityReference[] {
  return formulaSources(config)
    .filter(({ reference, formula }) => reference.holderId !== ownId && names(formula))
    .map(({ reference }) => reference);
}

/** Every material level in the configuration, paired with the material that holds it */
function materialLevels(
  config: Configuration
): { materialId: string; materialName: string; level: MaterialLevel }[] {
  return config.materials.flatMap((material) =>
    material.levels.map((level) => ({
      materialId: material.id,
      materialName: material.name,
      level,
    }))
  );
}

/**
 * Material levels whose bonuses name a stat
 *
 * By **id** since TICKET-MAT-01, like the race stat block beside it, so this half of the guard
 * cannot be defeated by a rename either — and materials no longer point at a speciality or combat
 * skill at all, which is why this is reachable only from the stat branch now.
 */
function materialBonusReferences(config: Configuration, statId: string): EntityReference[] {
  return config.materials
    .filter((material) =>
      material.levels.some((level) => level.bonuses.some((bonus) => bonus.statId === statId))
    )
    .map((material) => ({
      holderKind: 'Material',
      holderName: material.name,
      field: 'levels[].bonuses',
      holderId: material.id,
    }));
}

/**
 * Inlay families whose tier bonuses name a stat (TICKET-INL-01)
 *
 * `materialBonusReferences`' twin, one entity over and by **id** for the same reason: a gem's tier
 * row is a `{ statId, modifier }` list, so deleting a stat three gem families grant has to be
 * refused rather than merely survived. One reference per family however many of its tiers name the
 * stat — the dialog says *which gem*, and ten rows of Diamond would say it ten times.
 */
function inlayBonusReferences(config: Configuration, statId: string): EntityReference[] {
  return (config.inlays ?? [])
    .filter((inlay) =>
      inlay.tiers.some((tier) => tier.bonuses.some((bonus) => bonus.statId === statId))
    )
    .map((inlay) => ({
      holderKind: 'Inlay',
      holderName: inlay.name,
      field: 'tiers[].bonuses',
      holderId: inlay.id,
    }));
}

/**
 * Races whose stat block gives a stat a non-zero value
 *
 * By **id** since TICKET-RACE-01, unlike the material bonuses beside it, so this half of the guard
 * cannot be defeated by a rename — the stat block holds the identity, not a spelling.
 *
 * **Presence of the key is not a reference.** A block covering every configured stat is a normal
 * shape (the editor writes one, and absent reads 0 anyway), so keying off `statId in statValues`
 * would make every race point at every stat and refuse every stat delete — a guard that always
 * fires tells the User nothing. A zero contributes nothing, so it points at nothing.
 */
function raceStatBlockReferences(config: Configuration, statId: string): EntityReference[] {
  return config.races
    .filter((race) => (race.statValues[statId] ?? 0) !== 0)
    .map((race) => ({
      holderKind: 'Race',
      holderName: race.name,
      field: 'statValues',
      holderId: race.id,
    }));
}

/**
 * Archetypes that tag a stat with an affinity (TICKET-ARC-01)
 *
 * By **id**, like a race's stat block, and with the same rule about what counts: **presence of the
 * key is the reference**, because a tagging is stored *sparsely* — an absent stat is `non`, and the
 * editor prunes `non` on save. So a key that is present is one the User deliberately tagged, and
 * every key present is a real opinion about that stat.
 *
 * That is the mirror of the race rule rather than a departure from it: both ask "does this entity
 * actually say something about the stat", and the answer differs only because a race's block is
 * dense with a neutral zero while an archetype's is sparse with a neutral absence.
 */
function archetypeAffinityReferences(config: Configuration, statId: string): EntityReference[] {
  return (config.archetypes ?? [])
    .filter((archetype) => statId in archetype.statAffinity)
    .map((archetype) => ({
      holderKind: 'Archetype',
      holderName: archetype.name,
      field: 'statAffinity',
      holderId: archetype.id,
    }));
}

/** Characters who have invested in a skill, by **id** since TICKET-SKL-02 */
function characterSkillReferences(characters: Character[], skillId: string): EntityReference[] {
  return characters
    .filter((character) => skillId in character.investedSkillPoints)
    .map((character) => ({
      holderKind: 'Character',
      holderName: character.name,
      field: 'invested skill points',
      holderId: character.id,
    }));
}

/**
 * Characters who have made a skill one of their **focus** picks (TICKET-SKL-05)
 *
 * `raceIds`' arm, one entity over, and it guards something sharper than a dangling race does. A
 * stale focus id is not merely inert: `focusPickRefusal` refuses the **whole list**, and the sheet's
 * picker resends every stored pick on any change — so one deleted skill makes every slot unwritable
 * with a message about a slot the Player did not touch, and the stale slot renders as a `Select`
 * whose value matches no option.
 */
function characterFocusReferences(characters: Character[], skillId: string): EntityReference[] {
  return characters
    .filter((character) => (character.focusSkillIds ?? []).includes(skillId))
    .map((character) => ({
      holderKind: 'Character',
      holderName: character.name,
      field: 'focus skills',
      holderId: character.id,
    }));
}

/**
 * Item templates whose skill vector names a skill (v4 systems/11, TICKET-ITEM-01)
 *
 * `inlayBonusReferences`' shape one entity over and pointing the other way: a template's bonus is a
 * `{ skillId, modifier }` row keyed by **id**, so deleting a skill three templates grant has to be
 * refused rather than merely survived — the alternative is a User deleting Athletics and every
 * Battleaxe in the catalog silently granting nothing.
 *
 * This is a **config→config** reference, which is why it belongs here beside the two character arms
 * rather than being left to the validator: `dependencies.ts` is the *before the fact* guard, and a
 * reference it cannot see is one nobody is warned about.
 *
 * One reference per template however many of its rows name the skill — the dialog says *which item*,
 * and a vector naming one skill twice would say it twice.
 */
function itemSkillBonusReferences(config: Configuration, skillId: string): EntityReference[] {
  return config.items
    .filter((item) => (item.skillBonuses ?? []).some((bonus) => bonus.skillId === skillId))
    .map((item) => ({
      holderKind: 'Item',
      holderName: item.name,
      field: 'skillBonuses',
      holderId: item.id,
    }));
}

/**
 * Everything pointing at a skill (Concept 02, TICKET-SKL-02, TICKET-SKL-05, TICKET-ITEM-01)
 *
 * A `Skill` has no code, so nothing names it in the flat space and it has no own formula to
 * exclude: what points at it is a formula spelling `skills.<name>`, an item template's bonus vector,
 * a character's investment, and — since focus skills — a character's picks.
 */
function skillEntityReferences(
  config: Configuration,
  characters: Character[],
  id: string
): EntityReference[] {
  const skill = config.skills.find((candidate) => candidate.id === id);

  return [
    ...(skill ? formulaReferences(config, namesMember('skills', skillMemberName(skill)), id) : []),
    ...itemSkillBonusReferences(config, id),
    ...characterSkillReferences(characters, id),
    ...characterFocusReferences(characters, id),
  ];
}

/** Everything pointing at a stat */
function statReferences(
  config: Configuration,
  characters: Character[],
  id: string
): EntityReference[] {
  const stat = config.stats.find((candidate) => candidate.id === id);

  // A stat is spelled two ways since TICKET-STAT-01 — `STR` in the flat space and
  // `stats.strength` in the dotted one — and a delete has to be guarded against both, or the
  // half the walker does not know about becomes an undefined variable without warning.
  const formulas = stat
    ? formulaReferences(
        config,
        (formula) =>
          namesMember('stats', statMemberName(stat))(formula) ||
          namesBareCode(stat.abbreviation.toUpperCase())(formula),
        id
      )
    : [];

  // Every persisted opinion about a stat names it by id now (TICKET-RACE-01, TICKET-MAT-01,
  // TICKET-ARC-01), so none needs a `stat` in hand to spell it — the guard holds even for an id
  // nothing defines any more
  const modifiers = [
    ...raceStatBlockReferences(config, id),
    ...materialBonusReferences(config, id),
    ...inlayBonusReferences(config, id),
    ...archetypeAffinityReferences(config, id),
  ];

  const players = characters
    .filter(
      (character) => id in character.currentResourceValues || id in character.investedStatPoints
    )
    .map((character) => ({
      holderKind: 'Character',
      holderName: character.name,
      field: 'stat values',
      holderId: character.id,
    }));

  return [...formulas, ...modifiers, ...players];
}

/** Everything pointing at an item */
function itemReferences(characters: Character[], id: string): EntityReference[] {
  return characters
    .filter(
      (character) =>
        Object.values(character.inventory.equippedItems).includes(id) ||
        character.inventory.miscItems.includes(id)
    )
    .map((character) => ({
      holderKind: 'Character',
      holderName: character.name,
      field: 'inventory',
      holderId: character.id,
    }));
}

/** Everything pointing at an equipment slot type */
function equipmentSlotReferences(
  config: Configuration,
  characters: Character[],
  type: string
): EntityReference[] {
  const items = config.items
    .filter((item) => item.equipmentSlotType === type)
    .map((item) => ({
      holderKind: 'Item',
      holderName: item.name,
      field: 'equipmentSlotType',
      holderId: item.id,
    }));

  const players = characters
    .filter((character) => type in character.inventory.equippedItems)
    .map((character) => ({
      holderKind: 'Character',
      holderName: character.name,
      field: 'inventory.equippedItems',
      holderId: character.id,
    }));

  return [...items, ...players];
}

/**
 * Find everything that points at an entity
 *
 * @param target - What is about to be deleted
 * @param config - The configuration it lives in
 * @param characters - The characters built on that configuration
 * @returns Every reference to the target; empty means the delete is safe
 */
export function findReferences(
  target: ReferenceTarget,
  config: Configuration,
  characters: Character[] = []
): EntityReference[] {
  switch (target.kind) {
    case 'skill':
      return skillEntityReferences(config, characters, target.id);

    case 'stat':
      return statReferences(config, characters, target.id);

    case 'constant': {
      const constant = (config.constants ?? []).find((candidate) => candidate.id === target.id);
      return constant
        ? formulaReferences(config, namesMember('const', constant.name), target.id)
        : [];
    }

    case 'curve': {
      const curve = (config.curves ?? []).find((candidate) => candidate.id === target.id);
      // A call contributes a namespaced reference like any other, so the same matcher finds
      // `curve.cr(x)` and `curve.point_buy.main_type(9)` alike (TICKET-CRV-01)
      return curve ? formulaReferences(config, namesMember('curve', curve.name), target.id) : [];
    }

    case 'curve-column': {
      const owner = (config.curves ?? []).find((candidate) =>
        candidate.columns.some((column) => column.id === target.id)
      );
      const column = owner?.columns.find((candidate) => candidate.id === target.id);
      if (!owner || !column) return [];

      return formulaReferences(
        config,
        namesColumn(owner.name, column.name, owner.columns.length === 1),
        target.id
      );
    }

    case 'race':
      return characters
        .filter((character) => character.raceIds.includes(target.id))
        .map((character) => ({
          holderKind: 'Character',
          holderName: character.name,
          field: 'raceIds',
          holderId: character.id,
        }));

    case 'archetype':
      // Only a character holds one (TICKET-ARC-01). No formula can name an archetype — affinity
      // is read by the point-buy routing, not spelled in a formula string — so there is no
      // namespace to scan the way `stat` and `constant` have.
      return characters
        .filter((character) => character.archetypeId === target.id)
        .map((character) => ({
          holderKind: 'Character',
          holderName: character.name,
          field: 'archetypeId',
          holderId: character.id,
        }));

    case 'dice-ladder':
      // The guard TICKET-ROLL-03 deferred, arriving with the first thing that can point at a
      // ladder. A definition names one by **id**, so no rename can defeat it, and there is no
      // formula to scan: a ladder is not spelled in the formula space at all.
      return (config.rollDefinitions ?? [])
        .filter((roll) => roll.ladderId === target.id)
        .map((roll) => ({
          holderKind: ROLL_HOLDER_KIND,
          holderName: roll.name,
          field: 'ladderId',
          holderId: roll.id,
        }));

    case 'roll-definition':
      // Deliberately nothing. No formula can name a roll — there is no `rolls` namespace, because
      // a roll produces dice rather than a number, and a formula carries no randomness (spec §5).
      // Roll history is session state in `useUIStore`, so it does not survive to hold a reference
      // either. A roll is a leaf, and this case exists to say so rather than to be forgotten.
      return [];

    case 'item':
      return itemReferences(characters, target.id);

    case 'inlay':
      // Deliberately nothing **yet** (TICKET-INL-01). The socket that names a family — an item's
      // `inlayId`, the way it already names a `materialId` — is TICKET-INV-05's, and this is the
      // `dice-ladder` situation exactly: ROLL-03 shipped that kind unguarded because a check with no
      // possible referrer can never fire, and ROLL-05 filled it in the moment something could point
      // at one. The kind exists now so the panel wires the same guarded-delete surface every other
      // panel uses, rather than growing a second delete path to convert later.
      return [];

    case 'material':
      return config.items
        .filter((item) => item.materialId === target.id)
        .map((item) => ({
          holderKind: 'Item',
          holderName: item.name,
          field: 'materialId',
          holderId: item.id,
        }));

    case 'material-category':
      return config.materials
        .filter((material) => material.categoryId === target.id)
        .map((material) => ({
          holderKind: 'Material',
          holderName: material.name,
          field: 'categoryId',
          holderId: material.id,
        }));

    case 'equipment-slot':
      return equipmentSlotReferences(config, characters, target.id);

    case 'currency-tier':
      return materialLevels(config)
        .filter(({ level }) => level.value.tierId === target.id)
        .map(({ materialId, materialName, level }) => ({
          holderKind: 'Material',
          holderName: `${materialName} — ${level.name}`,
          field: `levels[${level.level}].value.tierId`,
          holderId: materialId,
        }));

    default: {
      // TypeScript exhaustiveness check — a new target kind is a new case, not a fallthrough
      const _exhaustive: never = target.kind;
      throw new Error(`Unknown reference target kind: ${_exhaustive}`);
    }
  }
}
