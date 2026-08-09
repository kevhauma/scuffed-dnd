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
import { statMemberName } from './formula/references';
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
  | 'speciality-skill'
  | 'combat-skill'
  | 'stat'
  | 'race'
  | 'item'
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
 * `bonus_divider` are different things, and `dependencyKeysOf` flattens both to the bare member
 * name. Matching `const.bonus_divider` against the constant and `stats.bonus_divider` against the
 * stat is what keeps one from blocking the other's delete.
 */
type ReferenceMatcher = (formula: string) => boolean;

/** A skill: named bare (`STR`) or through its namespace (`skills.STL`) */
function namesSkill(code: string): ReferenceMatcher {
  return (formula) => {
    const result = validateFormula(formula);
    return (
      result.referencedVariables.includes(code) ||
      result.namespacedReferences.some(
        (reference) => reference.namespace === 'skills' && reference.member === code
      )
    );
  };
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
    ...config.specialitySkills.map((skill) => ({
      reference: {
        holderKind: 'Speciality Skill',
        holderName: skill.name,
        field: 'bonusFormula',
        holderId: skill.id,
      },
      formula: skill.bonusFormula,
    })),
    ...config.combatSkills.map((skill) => ({
      reference: {
        holderKind: 'Combat Skill',
        holderName: skill.name,
        field: 'bonusFormula',
        holderId: skill.id,
      },
      formula: skill.bonusFormula,
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

/** Material levels whose bonuses name a skill code */
function materialBonusReferences(config: Configuration, code: string): EntityReference[] {
  return config.materials
    .filter((material) =>
      material.levels.some((level) => level.bonuses.some((bonus) => bonus.skillCode === code))
    )
    .map((material) => ({
      holderKind: 'Material',
      holderName: material.name,
      field: 'levels[].bonuses',
      holderId: material.id,
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

/** Characters holding anything under a skill code */
function characterSkillReferences(characters: Character[], code: string): EntityReference[] {
  return characters
    .filter(
      (character) => code in character.specialitySkillBaseLevels || character.focusStatCode === code
    )
    .map((character) => ({
      holderKind: 'Character',
      holderName: character.name,
      field: 'skill levels',
      holderId: character.id,
    }));
}

/** Everything pointing at one of the three skill kinds, which share a code space */
function skillReferences(
  config: Configuration,
  characters: Character[],
  code: string
): EntityReference[] {
  // A skill's own bonus formula goes with it, so exclude it by id — the codes in the formula are
  // spellings, the identity is not (TICKET-REF-01).
  const own = [...config.specialitySkills, ...config.combatSkills].find(
    (skill) => skill.code === code
  );

  return [
    ...formulaReferences(config, namesSkill(code), own?.id ?? code),
    ...materialBonusReferences(config, code),
    ...characterSkillReferences(characters, code),
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
          namesSkill(stat.abbreviation.toUpperCase())(formula),
        id
      )
    : [];

  // Materials still target a stat by abbreviation (TICKET-STAT-01's bridge); a race's stat block
  // names it by id, so that half is looked up directly and needs no `stat` to spell it
  const modifiers = [
    ...raceStatBlockReferences(config, id),
    ...(stat ? materialBonusReferences(config, stat.abbreviation) : []),
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
    case 'speciality-skill':
    case 'combat-skill':
      return skillReferences(config, characters, target.id);

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

    case 'item':
      return itemReferences(characters, target.id);

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
