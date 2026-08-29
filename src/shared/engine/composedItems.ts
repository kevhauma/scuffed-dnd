/**
 * What a built thing *is* — its parts resolved, its name spelled, and whether it is in the bag
 *
 * The read side of a {@link ComposedItem} (v4 systems/12, TICKET-INV-06). `playerActions.ts` writes
 * the record and `equipmentBonusCalculator.ts` prices it; this module answers the three questions
 * every other reader asks about one, and it answers them in one place because the three are the same
 * three lookups seen from different angles.
 *
 * ## Nothing here is stored
 *
 * Not the phrase, not the Backpack. Both are functions of the links and the ruleset, evaluated at
 * read time — *derived values are computed, never stored*, applied to a string and to a set rather
 * than to a number. That is what makes renaming Iron Ore relabel every axe made of it on the next
 * render, and what let `Inventory.miscItems` be deleted: the bag is `composedItems − worn`, so
 * storing it was storing a subtraction.
 *
 * ## A rung is found by its number, never by its position
 *
 * `Material.levels` and `Inlay.tiers` both carry the rung on the row and neither array is kept dense
 * or sorted — the sheet's Zircon has tiers 1–9 and a blank tenth (TICKET-INL-01). Indexing by
 * position would read the wrong row for the first family somebody edited out of order, and *some* row
 * for a rung that does not exist.
 *
 * **Validates: Requirements 12.1, 12.4, 13.1; v4 systems/12**
 */

import type { Character, ComposedItem } from '../types/character';
import type { Configuration, InlayTier, MaterialLevel } from '../types/config';

/** What the phrase says where the ruleset no longer defines the template a build was made from */
const UNKNOWN_TEMPLATE = 'Unknown item';

/**
 * The material tier a composed record names, or nothing when it names none this ruleset has
 *
 * @param composed - The record to resolve
 * @param config - The ruleset whose materials it names
 * @returns The tier, or `undefined` when either half of the reference is absent or dangling
 */
export function materialTierOf(
  composed: ComposedItem,
  config: Configuration
): MaterialLevel | undefined {
  if (composed.materialId === undefined || composed.materialLevel === undefined) return undefined;

  const material = config.materials.find((candidate) => candidate.id === composed.materialId);

  return material?.levels.find((level) => level.level === composed.materialLevel);
}

/**
 * The inlay tier a composed record names, or nothing when it names none this ruleset has
 *
 * {@link materialTierOf}'s twin one entity over. An `inlayLevel` naming an absent rung resolves to
 * nothing and therefore grants nothing; *telling the Player* their gem has no such tier is
 * `buildItem`'s refusal, which is the surface where they can act on it.
 *
 * @param composed - The record to resolve
 * @param config - The ruleset whose inlays it names
 * @returns The tier, or `undefined` when either half of the reference is absent or dangling
 */
export function inlayTierOf(composed: ComposedItem, config: Configuration): InlayTier | undefined {
  if (composed.inlayId === undefined || composed.inlayLevel === undefined) return undefined;

  const inlay = (config.inlays ?? []).find((candidate) => candidate.id === composed.inlayId);

  return inlay?.tiers.find((tier) => tier.tier === composed.inlayLevel);
}

/**
 * What a built thing is called — `Iron Ore 10 Battleaxe with Diamond 4 inlay` (v4 systems/12 gap 4)
 *
 * The sheet's own concatenation, `material & " " & item & " with " & inlay & " inlay"`, and it is
 * **derived every render rather than stored on the record**: rename the material and every axe made
 * of it is relabelled, which is the whole reason a build carries links instead of a `name`.
 *
 * Three parity notes, each a deliberate difference or a deliberate sameness:
 *
 * - **The family's name plus the rung number**, not the tier's own `MaterialLevel.name`. The sheet
 *   writes *Adamantine Ore 10*, and an `InlayTier` has no name at all to be symmetrical with.
 * - **`with empty inlay` is mirrored** — the sheet writes that row for an unsocketed thing, and so
 *   does this, so a Player reading either recognises the other.
 * - **The double space is not.** The sample's `Adamantine Ore 10  Battleaxe` is the item cell's own
 *   leading space (systems/12), a data quirk recorded rather than reproduced.
 *
 * A part the ruleset no longer defines drops out of the phrase rather than blanking it: a build whose
 * material family was deleted is still *a Battleaxe with empty inlay*, and one whose **template** was
 * deleted still names its metal beside an {@link UNKNOWN_TEMPLATE} it can be dropped by. The rung the
 * record claims is printed even where the family has no such tier, because the phrase says what the
 * record *is*, and what such a rung is worth is `materialTierOf`'s separate answer (nothing).
 *
 * @param composed - The build to name
 * @param config - The ruleset holding its template, material and inlay
 * @returns The display phrase, never empty
 */
export function composedItemLabel(composed: ComposedItem, config: Configuration): string {
  const template = config.items.find((candidate) => candidate.id === composed.templateId);
  const material = config.materials.find((candidate) => candidate.id === composed.materialId);
  const inlay = (config.inlays ?? []).find((candidate) => candidate.id === composed.inlayId);

  const forged = material && composed.materialLevel !== undefined;
  const metal = forged ? `${material.name} ${composed.materialLevel} ` : '';
  const shape = template?.name ?? UNKNOWN_TEMPLATE;
  const socketed = inlay && composed.inlayLevel !== undefined;
  const gem = socketed ? `${inlay.name} ${composed.inlayLevel}` : 'empty';

  return `${metal}${shape} with ${gem} inlay`;
}

/**
 * The build ids the character currently has on, one per filled slot the ruleset still defines
 *
 * **Read through `config.equipmentSlots` rather than off the keys of `equippedItems`**, which is
 * `equippedCompositions`' rule in the bonus calculator and is here for the sharper of its two
 * reasons: `deleteEquipmentSlot` offers the User a *Delete anyway*, so a character can be left
 * holding `equippedItems: { retired: 'axe-1' }`. That axe grants nothing — the calculator walks the
 * ruleset's slots too — and if this read the raw keys it would also be in no Backpack, which is
 * precisely the invisible-record state deleting `miscItems` was meant to make impossible.
 *
 * @param character - Whose inventory to read
 * @param config - The ruleset whose slots decide what counts as worn
 * @returns The ids in slots the ruleset defines
 */
export function wornBuildIds(character: Character, config: Configuration): Set<string> {
  const worn = new Set<string>();

  for (const slot of config.equipmentSlots) {
    const composedId = character.inventory.equippedItems[slot.type];
    if (composedId !== undefined) worn.add(composedId);
  }

  return worn;
}

/**
 * What is in the Backpack: everything built and not worn (v4 systems/12 gap 3)
 *
 * The sheet derives *in the bag* with a `FILTER` over its composition rows, and so does this. There
 * is no stored list to keep in step with the slots, so equipping a thing takes it out of the bag and
 * unequipping puts it back **without either action touching a second collection** — which is the
 * round trip TICKET-INV-06's criteria pin, and the reason it cannot come apart.
 *
 * Creation order is preserved, since that is the order `composedItems` is appended in and the only
 * order a Player has ever been shown.
 *
 * @param character - Whose builds to sort
 * @param config - The ruleset whose slots decide what counts as worn
 * @returns The unworn builds, in the order they were made
 */
export function backpackOf(character: Character, config: Configuration): ComposedItem[] {
  const worn = wornBuildIds(character, config);

  return character.inventory.composedItems.filter((build) => !worn.has(build.id));
}
