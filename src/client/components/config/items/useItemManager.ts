/**
 * Item Manager Hook
 *
 * Manages item CRUD operations and form state.
 *
 * **Equipment slots are not this hook's** (CR-20). It used to carry a second, complete
 * implementation of slot CRUD beside `useEquipmentSlotManager`, and `/config/items` mounted both
 * panels — so the page showed two "Add Equipment Slot" buttons, two dialogs and two slot lists for
 * one entity, and any change to how a slot works had to be made twice. The slots the hook still
 * reads are **read-only** here: an item names one, and the card and the form dialog spell it.
 *
 * **A template is a per-skill bonus vector since TICKET-ITEM-01** (v4 systems/11), and it names the
 * shop that sells it. Both are edited here; the vector is stored **sparsely**, so the save path
 * prunes rows worth nothing rather than writing 48 zeroes per template.
 *
 * **Materials are not this hook's either, since TICKET-INV-05** (v4 systems/12). The form carried a
 * `materialId` and a `materialLevel` and wrote them onto the template; both retired with the fused
 * pair, because what a thing is made of is a fact about the thing a Player *built*. So the ruleset's
 * material list is no longer read here at all — TICKET-INV-06's builder is where a tier is picked.
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4; v4 systems/11, systems/12**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Item, SkillModifier } from '#shared/types';
import { useConfigStore } from '../../../stores/configStore';
import { groupByLabel } from '../../shared/labelledGroups';
import { useGuardedDelete } from '../shared/useGuardedDelete';
import type { RowOption } from '../shared/ValueRowsField';

export interface ItemFormData {
  name: string;
  description: string;
  categoryId: string;
  /** Which shop sells this template; blank means it is in no shop */
  shop: string;
  equipmentSlotType: string;
  /** What wielding it does to each skill it moves — sparse once saved */
  skillBonuses: SkillModifier[];
}

/** What a fresh item form holds — one object so the reset and the defaults cannot drift */
const EMPTY_ITEM_FORM: ItemFormData = {
  name: '',
  description: '',
  categoryId: '',
  shop: '',
  equipmentSlotType: '',
  skillBonuses: [],
};

/**
 * The vector as it is stored: only the skills the template actually moves
 *
 * **The sparse rule, applied at the one place that writes it.** A zero contributes nothing to
 * `calculateEquipmentSkillBonuses`, so storing one would be noise in the document *and* a reference
 * that makes `deleteSkill` refuse on a template that does not really name the skill. A row whose
 * picker was never answered — which is what an empty ruleset's Add button would produce — is dropped
 * for the same reason.
 *
 * **A row whose number box is *empty* is dropped too, and that is the half a `!== 0` test misses.**
 * The modifier registers `{ valueAsNumber: true }`, so clearing the box yields **`NaN`** — which is
 * not `0`, survives a naive filter, is summed into the wielder's skill bonus as `NaN` on the sheet,
 * and serialises as `"modifier": null`, which `itemSkillBonusShapeErrors` then **refuses on
 * re-import**. That is the standing rule of this codebase's identity gates — *what a panel writes,
 * its own importer must accept* — and it is the one this function exists to keep. `Number.isFinite`
 * is what keeps it, and it covers `Infinity` from a pasted `1e999` at the same time.
 *
 * *Which* rows are worth keeping is a **storage** convention rather than an identity rule, so the
 * import gate does not pair with the `!== 0` half: an imported zero is accepted and plays
 * identically. The finiteness half is not a convention — it is the gate's own rule, stated here so
 * the two cannot disagree.
 *
 * @param rows - What the form holds, blanks, zeroes and cleared number boxes included
 * @returns The rows worth keeping, or `undefined` when none are — which `mergeClearingAbsent` deletes
 */
function sparseSkillBonuses(rows: SkillModifier[]): SkillModifier[] | undefined {
  const kept = rows.filter(
    (row) => row.skillId !== '' && Number.isFinite(row.modifier) && row.modifier !== 0
  );
  return kept.length === 0 ? undefined : kept;
}

export function useItemManager() {
  const config = useConfigStore((state) => state.config);
  const addItem = useConfigStore((state) => state.addItem);
  const updateItem = useConfigStore((state) => state.updateItem);
  const deleteItem = useConfigStore((state) => state.deleteItem);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const itemForm = useForm<ItemFormData>({ defaultValues: EMPTY_ITEM_FORM });

  const items = config?.items || [];
  /** Read-only: which slots an item may be assigned to, and how to spell the one it has */
  const equipmentSlots = config?.equipmentSlots || [];
  // The skills a template's vector may target, and how to spell the ones it moves (TICKET-ITEM-01).
  // **Every** skill, unfiltered: a skill is a skill, and there is no derived-stat equivalent here to
  // keep off the picker — which is why this is not a third `modifiableStats`
  const skills = config?.skills || [];
  const skillOptions: RowOption[] = skills.map((skill) => ({ value: skill.id, label: skill.name }));

  // Get unique categories from items
  const itemCategories = Array.from(new Set(items.map((item) => item.categoryId).filter(Boolean)));

  // Filter items by category
  const filteredItems =
    categoryFilter === 'all' ? items : items.filter((item) => item.categoryId === categoryFilter);

  const handleAddItem = () => {
    setEditingItemId(null);
    itemForm.reset(EMPTY_ITEM_FORM);
    setIsItemDialogOpen(true);
  };

  const handleEditItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    setEditingItemId(id);
    itemForm.reset({
      name: item.name,
      description: item.description,
      categoryId: item.categoryId || '',
      shop: item.shop ?? '',
      equipmentSlotType: item.equipmentSlotType || '',
      skillBonuses: item.skillBonuses ?? [],
    });
    setIsItemDialogOpen(true);
  };

  const handleDeleteItem = (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    attemptDelete(`Item ${item?.name ?? id}`, (options) => deleteItem(id, options));
  };

  const handleSaveItem = itemForm.handleSubmit((data) => {
    const shop = data.shop.trim();
    const bonuses = sparseSkillBonuses(data.skillBonuses);

    const item: Item = {
      id: editingItemId || crypto.randomUUID(),
      name: data.name,
      description: data.description,
      categoryId: data.categoryId || undefined,
      // Explicitly `undefined` rather than omitted: that is what tells `updateItem` to *delete* the
      // key, so clearing the shop leaves no `"shop": ""` behind — `useInlayManager`'s rule for a
      // heading, and `addItem` runs the same cleaner on the way in
      shop: shop === '' ? undefined : shop,
      equipmentSlotType: data.equipmentSlotType || undefined,
      skillBonuses: bonuses,
    };

    if (editingItemId) {
      updateItem(editingItemId, item);
    } else {
      addItem(item);
    }

    setIsItemDialogOpen(false);
  });

  return {
    blocked,
    dismissBlocked,
    config,
    items,
    filteredItems,
    // The shops the *filtered* list falls under, so narrowing by category re-heads the page rather
    // than leaving an empty shop standing. The headings are whatever the ruleset's own words are —
    // `shared/labelledGroups`, the same rule the sheet's stat columns and the gem panel use
    shopGroups: groupByLabel(filteredItems, (item) => item.shop),
    skills,
    skillOptions,
    equipmentSlots,
    itemCategories,
    categoryFilter,
    setCategoryFilter,
    isItemDialogOpen,
    setIsItemDialogOpen,
    editingItemId,
    itemForm,
    handleAddItem,
    handleEditItem,
    handleDeleteItem,
    handleSaveItem,
  };
}
