/**
 * Inventory Manager Hook
 *
 * Owns the store selectors and every inventory handler for one character: what is in each
 * equipment slot, what is in the Backpack, and what a new build may be made of. The panel renders;
 * this decides.
 *
 * Slot-type validation is enforced by the store actions (Requirement 12.3). The `fitsSlot` filter
 * here only decides what to *offer* — it is a convenience, not the rule.
 *
 * **Which actor performs an act is [`useInventoryActs`](./useInventoryActs.ts)'s answer, not this
 * hook's** (TICKET-DM-02). A DM opening a player's sheet moves their kit through the `dm-` routes and
 * a Player moves their own through theirs; the acts are bound before they get here, so every handler
 * below stayed one line and nothing under `InventoryPanel` knows the difference.
 *
 * **What a slot holds is a `ComposedItem.id` since TICKET-INV-05** (v4 systems/12), so every row here
 * resolves *twice*: the id names one of the character's builds, and that build names the template,
 * the metal and the gem the phrase is spelled from ([`composedItemLabel`](#shared/engine/composedItems.ts)).
 *
 * **The Backpack is derived, not read** (TICKET-INV-06): `backpackOf` is everything built and not
 * worn, which is exactly the sheet's own `FILTER`. Nothing here maintains a second list, which is why
 * equipping a thing takes it out of the bag and unequipping puts it back without either handler
 * saying so.
 *
 * **Validates: Requirements 12.1, 12.2, 12.4, 12.5, 12.6, 21.1-21.5; v4 systems/12**
 */

import { backpackOf, composedItemLabel } from '#shared/engine/composedItems';
import type { ComposedItem } from '#shared/types/character';
import type { EquipmentSlotPlacement, Item } from '#shared/types/config';
import { selectCharacter, useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { useInventoryActs } from './useInventoryActs';

/**
 * One equipment slot with its occupant resolved
 */
export interface EquipmentSlotEntry {
  type: string;
  name: string;
  /** What is worn in this slot, or `null` when it is empty (Requirement 12.1) */
  equipped: CarriedBuild | null;
  /** Backpack builds this slot will accept, for the "equip" control */
  candidates: CarriedBuild[];
  /**
   * Where the ruleset puts this slot on the figure, or absent when it is unplaced.
   *
   * Carried straight through from the configuration rather than derived here: since TICKET-INV-03
   * the arrangement is the User's, made in the equipment builder, and play mode only reads it.
   */
  placement?: EquipmentSlotPlacement;
}

/**
 * One of the character's builds, with the template it was built from and the name it goes by
 *
 * All three, because they answer different questions and every control needs more than one: the
 * **id** is what an equip or a discard names, the **template** is what a row is slot-matched by, and
 * the **label** is what a Player reads. `build` is carried whole so a surface that wants a part link
 * has it without this hook growing a field per part.
 *
 * The label is derived here rather than in each component for the reason every derived number on the
 * sheet is: two spellings of *Iron Ore 10 Battleaxe with Diamond 4 inlay* would eventually disagree,
 * and the phrase is `composedItemLabel`'s answer at every one of them.
 */
export interface CarriedBuild {
  build: ComposedItem;
  /** The template the ruleset still defines, or `null` when it has been deleted under the Player */
  item: Item | null;
  /** What this build is called — derived from the links every render, never stored */
  label: string;
}

/**
 * A Backpack build, with the one thing its row needs beyond the build itself
 */
export interface BackpackEntry extends CarriedBuild {
  /**
   * The slot this build's template declares, or `null` when it is not equippable (Req 12.4)
   *
   * The one derived field, and the reason this is still a type of its own rather than a bare
   * {@link CarriedBuild}: the row *renders* it, and deciding it here is what keeps the component
   * free of `item?.equipmentSlotType ?? null`.
   */
  slotType: string | null;
}

export function useInventoryManager(characterId: string) {
  const config = useConfigStore((state) => state.config);
  // Wherever it lives (TICKET-PLY-01) — a character at a table is not in the browser's own list,
  // and the Backpack is one of the things a Player moves things in and out of at one
  const character = useCharacterStore((state) => selectCharacter(state, characterId));

  // The four acts, already bound to whichever actor is asking (TICKET-DM-02) — `null` when there is
  // no ruleset for a Player's own write to be checked against
  const acts = useInventoryActs(characterId);

  const items = config?.items ?? [];
  const builds = character?.inventory.composedItems ?? [];

  /**
   * What a build resolves to — the template behind it, and the name it goes by
   *
   * A template the ruleset has deleted is `null` rather than a reason to drop the row: the build is
   * still the Player's and still has to be equippable out of the way or thrown away, and
   * `composedItemLabel` names it *Unknown item* rather than leaving a blank.
   */
  const resolve = (build: ComposedItem): CarriedBuild => {
    const item = items.find((candidate) => candidate.id === build.templateId) ?? null;
    const label = config === null ? '' : composedItemLabel(build, config);

    return { build, item, label };
  };

  /** What an id in a slot resolves to, or `null` when this character carries no such build */
  const findBuild = (composedId: string): CarriedBuild | null => {
    const build = builds.find((candidate) => candidate.id === composedId);

    return build === undefined ? null : resolve(build);
  };

  const bagged: CarriedBuild[] =
    character === null || config === null
      ? []
      : backpackOf(character, config).map((build) => resolve(build));

  const slots: EquipmentSlotEntry[] = (config?.equipmentSlots ?? []).map((slot) => {
    const equippedId = character?.inventory.equippedItems[slot.type];
    const equipped = equippedId === undefined ? null : findBuild(equippedId);
    const candidates = bagged.filter((entry) => entry.item?.equipmentSlotType === slot.type);

    return {
      type: slot.type,
      name: slot.name,
      equipped,
      candidates,
      ...(slot.placement ? { placement: slot.placement } : {}),
    };
  });

  const backpack: BackpackEntry[] = bagged.map((entry) => ({
    ...entry,
    slotType: entry.item?.equipmentSlotType ?? null,
  }));

  const handleEquip = (equipmentSlotType: string, composedId: string) => {
    // The act owns both the move and the slot-type rule; which actor performs it is `acts`' answer
    if (character && acts) acts.equip(equipmentSlotType, composedId);
  };

  const handleUnequip = (equipmentSlotType: string) => {
    // Taking it off *is* putting it in the Backpack — there is no second collection (TICKET-INV-06)
    if (character && acts) acts.unequip(equipmentSlotType);
  };

  /**
   * Make one thing out of a template, a material tier and an optional gem tier (TICKET-INV-06)
   *
   * The builder assembles the picks; every rule about whether they go together is the Kernel's, and
   * a refusal reaches the Player as the sheet's own banner rather than being counted here.
   */
  const handleBuild = (build: Omit<ComposedItem, 'id'>) => {
    if (character && acts) acts.build(build);
  };

  /** Put one build down for good — exactly the one named, twin or no twin */
  const handleDiscard = (composedId: string) => {
    if (character && acts) acts.discard(composedId);
  };

  /**
   * What a set of picks would be called, before there is anything to call it
   *
   * The builder's preview, and it goes through `composedItemLabel` like every other spelling of the
   * phrase — the id is the one thing a draft has not got, so a blank one stands in for it. Nothing
   * reads it: the phrase is made of the *links*.
   */
  const labelFor = (build: Omit<ComposedItem, 'id'>): string =>
    config === null ? '' : composedItemLabel({ id: '', ...build }, config);

  return {
    hasCharacter: character !== null,
    slots,
    /** The grid the ruleset arranges its slots on, or `undefined` when it has never been laid out */
    equipmentLayout: config?.equipmentLayout,
    /** Everything built and not worn, in the order it was made */
    backpack,
    /** Every template the ruleset defines, for the builder's first column */
    availableItems: items,
    /** Every material family, for the builder's second column */
    availableMaterials: config?.materials ?? [],
    /** Every inlay family, for the builder's third — absent on a ruleset with no gems */
    availableInlays: config?.inlays ?? [],
    handleEquip,
    handleUnequip,
    handleBuild,
    handleDiscard,
    labelFor,
  };
}
