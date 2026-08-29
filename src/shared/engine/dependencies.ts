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
 * References are reported in **display** terms — a stat by its abbreviation or its name-slug, a skill
 * by `skills.<name-slug>` — because that is the form the in-memory configuration is in
 * (TICKET-REF-01). This line said *a skill by its code* until TICKET-SPL-01; a `Skill` lost its code
 * in TICKET-SKL-02 and the last coded entity went with `CombatSkill` in TICKET-ROLL-06.
 *
 * The dispatch is a table, not a `switch` — see {@link REFERENCE_WALKERS} for why and for what
 * adding a kind costs.
 *
 * **Validates: Concept 00 §6; spec §3.2; Requirements 2.5, 2.6, 18.1, 18.3**
 */

import type { Character, ComposedItem } from '../types/character';
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
  | 'spell'
  | 'material'
  | 'material-category'
  | 'equipment-slot'
  | 'currency-tier';

/**
 * What is about to be deleted
 *
 * `id` is whatever the matching delete action takes: a **type** for an equipment slot, and the
 * entity's own `id` for everything else. It used to say *a code for the three skill kinds* as well;
 * no entity is addressed by a code any more (TICKET-SKL-02 took a skill's, TICKET-ROLL-06 took the
 * last of them with `CombatSkill`), so the exception is gone rather than merely unused.
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
  id: string,
  config: Configuration,
  characters: Character[]
): EntityReference[] {
  const skill = config.skills.find((candidate) => candidate.id === id);
  const memberName = skill ? skillMemberName(skill) : '';
  const namesSkill = namesMember('skills', memberName);

  return [
    ...(skill ? formulaReferences(config, namesSkill, id) : []),
    ...itemSkillBonusReferences(config, id),
    ...characterSkillReferences(characters, id),
    ...characterFocusReferences(characters, id),
  ];
}

/** Everything pointing at a stat */
function statReferences(
  id: string,
  config: Configuration,
  characters: Character[]
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

/**
 * Characters who have **built** something out of the target (v4 systems/12, TICKET-INV-05)
 *
 * The one arm behind three guarded deletes — a material, a template and an inlay — because since
 * INV-05 all three are pointed at from the same place by the same kind of reference: a
 * `ComposedItem` in somebody's inventory, naming its parts by id. Three copies of this walk would
 * be three chances for one of them to go missing, which is precisely the failure the `inlay` arm's
 * empty `return []` was one ticket away from becoming permanent.
 *
 * **One reference per character however many of their builds name the target.** The dialog says
 * *which Player is holding it*, and a Player with six Iron Ore axes would say it six times.
 *
 * `field` is spelled as the path on the document — `inventory.composedItems[].materialId` — the way
 * `levels[].bonuses` and `tiers[].bonuses` are, so the User is told which link is the one blocking
 * the delete rather than merely that "the inventory" is.
 *
 * @param characters - The characters built on the configuration
 * @param field - The path on the composed record that points at the target
 * @param names - Whether one composed record points at it
 * @returns One reference per character holding at least one such build
 */
function composedItemReferences(
  characters: Character[],
  field: string,
  names: (composed: ComposedItem) => boolean
): EntityReference[] {
  return characters
    .filter((character) => character.inventory.composedItems.some(names))
    .map((character) => ({
      holderKind: 'Character',
      holderName: character.name,
      field,
      holderId: character.id,
    }));
}

/** Everything pointing at an equipment slot type */
function equipmentSlotReferences(
  type: string,
  config: Configuration,
  characters: Character[]
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

/** Formulas naming a constant, which is the only thing that can point at one */
function constantReferences(id: string, config: Configuration): EntityReference[] {
  const constant = (config.constants ?? []).find((candidate) => candidate.id === id);
  if (!constant) return [];

  const namesConstant = namesMember('const', constant.name);
  return formulaReferences(config, namesConstant, id);
}

/**
 * Formulas naming a curve
 *
 * A call contributes a namespaced reference like any other, so the same matcher finds `curve.cr(x)`
 * and `curve.point_buy.main_type(9)` alike (TICKET-CRV-01).
 */
function curveReferences(id: string, config: Configuration): EntityReference[] {
  const curve = (config.curves ?? []).find((candidate) => candidate.id === id);
  if (!curve) return [];

  const namesCurve = namesMember('curve', curve.name);
  return formulaReferences(config, namesCurve, id);
}

/** Formulas reading one value column of a curve (TICKET-CRV-03) */
function curveColumnReferences(id: string, config: Configuration): EntityReference[] {
  const owner = (config.curves ?? []).find((candidate) =>
    candidate.columns.some((column) => column.id === id)
  );
  const column = owner?.columns.find((candidate) => candidate.id === id);
  if (!owner || !column) return [];

  const isOnlyColumn = owner.columns.length === 1;
  const namesTheColumn = namesColumn(owner.name, column.name, isOnlyColumn);
  return formulaReferences(config, namesTheColumn, id);
}

/** Characters whose lineage names a race */
function raceReferences(
  id: string,
  _config: Configuration,
  characters: Character[]
): EntityReference[] {
  return characters
    .filter((character) => character.raceIds.includes(id))
    .map((character) => ({
      holderKind: 'Character',
      holderName: character.name,
      field: 'raceIds',
      holderId: character.id,
    }));
}

/**
 * Characters who have taken an archetype (TICKET-ARC-01)
 *
 * Only a character holds one. No formula can name an archetype — affinity is read by the point-buy
 * routing, not spelled in a formula string — so there is no namespace to scan the way `stat` and
 * `constant` have.
 */
function archetypeReferences(
  id: string,
  _config: Configuration,
  characters: Character[]
): EntityReference[] {
  return characters
    .filter((character) => character.archetypeId === id)
    .map((character) => ({
      holderKind: 'Character',
      holderName: character.name,
      field: 'archetypeId',
      holderId: character.id,
    }));
}

/**
 * Roll definitions that decompose down a ladder
 *
 * The guard TICKET-ROLL-03 deferred, arriving with the first thing that can point at a ladder. A
 * definition names one by **id**, so no rename can defeat it, and there is no formula to scan: a
 * ladder is not spelled in the formula space at all.
 */
function diceLadderReferences(id: string, config: Configuration): EntityReference[] {
  return (config.rollDefinitions ?? [])
    .filter((roll) => roll.ladderId === id)
    .map((roll) => ({
      holderKind: ROLL_HOLDER_KIND,
      holderName: roll.name,
      field: 'ladderId',
      holderId: roll.id,
    }));
}

/**
 * Nothing points at a roll definition, and this says so rather than being forgotten
 *
 * No formula can name a roll — there is no `rolls` namespace, because a roll produces dice rather
 * than a number, and a formula carries no randomness (spec §5). Roll history is session state in
 * `useUIStore`, so it does not survive to hold a reference either. A roll is a leaf.
 */
function rollDefinitionReferences(): EntityReference[] {
  return [];
}

/**
 * Characters holding a build made from a template (TICKET-INV-05)
 *
 * A template is pointed at by the **builds made from it**, not by the slots directly:
 * `equippedItems` holds `ComposedItem.id`s now, so a walk over it would compare a build's id
 * against a template's and never match.
 */
function itemReferences(
  id: string,
  _config: Configuration,
  characters: Character[]
): EntityReference[] {
  return composedItemReferences(
    characters,
    'inventory.composedItems[].templateId',
    (composed) => composed.templateId === id
  );
}

/**
 * Characters holding a build socketed with a gem family (TICKET-INV-05)
 *
 * Filled by INV-05, which is what INL-01 shipped the kind for: a `ComposedItem` sockets a family by
 * id, so deleting Diamond under a Player wearing a Diamond 4 axe has to be refused rather than
 * silently emptying the socket. This is `dice-ladder`'s history repeating — ROLL-03 shipped that
 * kind unguarded because a check with no possible referrer can never fire, and ROLL-05 filled it the
 * moment something could point at one.
 *
 * The table's exhaustiveness catches a **missing kind** and not a **new referrer to an existing
 * kind**, so leaving this returning nothing would have compiled, passed and orphaned every socket.
 * `referenceArms.test.ts` is the check that would have failed instead.
 */
function inlayReferences(
  id: string,
  _config: Configuration,
  characters: Character[]
): EntityReference[] {
  return composedItemReferences(
    characters,
    'inventory.composedItems[].inlayId',
    (composed) => composed.inlayId === id
  );
}

/**
 * Nothing points at a spell **yet** (v4 systems/13, TICKET-SPL-01)
 *
 * `dice-ladder`'s and `inlay`'s state on the day their kinds were minted: the compendium is ruleset
 * data that no formula spells and no other entity names, so a check here could not fire. The
 * referrer arrives with TICKET-SPL-02's `Character.learnedSpellIds`, at which point deleting a spell
 * three Players have learned must be refused rather than leaving three stale ids behind — and the
 * table below cannot notice that on its own, because exhaustiveness is over *kinds*, not over
 * referrers. The arm exists now so that ticket has a place to put the walk instead of a decision to
 * make.
 */
function spellReferences(): EntityReference[] {
  return [];
}

/**
 * Characters holding a build made of a material (TICKET-INV-05)
 *
 * Was a walk over `config.items` until INV-05 retired the template's fused `materialId`. What a
 * thing is made of is a fact about the built thing, so the holders are the Players who built one —
 * the `inlay` arm's shape exactly, which is why they share a walk.
 */
function materialReferences(
  id: string,
  _config: Configuration,
  characters: Character[]
): EntityReference[] {
  return composedItemReferences(
    characters,
    'inventory.composedItems[].materialId',
    (composed) => composed.materialId === id
  );
}

/** Materials filed under a category */
function materialCategoryReferences(id: string, config: Configuration): EntityReference[] {
  return config.materials
    .filter((material) => material.categoryId === id)
    .map((material) => ({
      holderKind: 'Material',
      holderName: material.name,
      field: 'categoryId',
      holderId: material.id,
    }));
}

/** Material tiers priced in a currency tier */
function currencyTierReferences(id: string, config: Configuration): EntityReference[] {
  const levels = materialLevels(config);

  return levels
    .filter(({ level }) => level.value.tierId === id)
    .map(({ materialId, materialName, level }) => ({
      holderKind: 'Material',
      holderName: `${materialName} — ${level.name}`,
      field: `levels[${level.level}].value.tierId`,
      holderId: materialId,
    }));
}

/**
 * One kind's walk: everything pointing at the entity that id names
 *
 * The arms take the id **first** so that the ones needing no configuration or no characters can be
 * written with the parameters they actually use and still sit in the table unadapted.
 */
type ReferenceWalker = (
  id: string,
  config: Configuration,
  characters: Character[]
) => EntityReference[];

/**
 * One walk per {@link ReferenceTargetKind} — the dispatch table this was always written as
 *
 * It was a fifteen-case `switch` with a `never` default until TICKET-SPL-01, and the `switch` was
 * the file's entire complexity: `findReferences` measured **24 cyclomatic** while every arm inside
 * it measured one or two, so each new kind made the *dispatcher* more expensive rather than the
 * walk. [TEST_STATUS.md](../../../TEST_STATUS.md)'s hotspot row named the trigger three tickets
 * running — *a ticket that has to change `EntityReference`'s shape or the `ReferenceTargetKind`
 * union* — and adding `spell` to the union is it.
 *
 * **The exhaustiveness is stronger than the `never` default it replaces, not weaker.** A `Record`
 * keyed by the union refuses a literal that omits a kind *and* one that invents a key, both at the
 * declaration and both naming the key — where the old default caught a missing case only at the
 * bottom of a function, as a thrown error the type system merely predicted.
 *
 * What it still cannot catch is a **new referrer to an existing kind**: an arm that should have
 * grown a walk and returned nothing instead type-checks perfectly. That is what
 * `referenceArms.test.ts` exists for, and why {@link spellReferences} carries its handoff in
 * prose rather than in a comment on a `case`.
 */
const REFERENCE_WALKERS: Record<ReferenceTargetKind, ReferenceWalker> = {
  skill: skillEntityReferences,
  stat: statReferences,
  constant: constantReferences,
  curve: curveReferences,
  'curve-column': curveColumnReferences,
  race: raceReferences,
  archetype: archetypeReferences,
  'dice-ladder': diceLadderReferences,
  'roll-definition': rollDefinitionReferences,
  item: itemReferences,
  inlay: inlayReferences,
  spell: spellReferences,
  material: materialReferences,
  'material-category': materialCategoryReferences,
  'equipment-slot': equipmentSlotReferences,
  'currency-tier': currencyTierReferences,
};

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
  const walk = REFERENCE_WALKERS[target.kind];

  return walk(target.id, config, characters);
}
