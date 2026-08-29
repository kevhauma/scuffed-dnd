/**
 * Spell Manager Hook
 *
 * Owns the spells panel's store selectors, its dialog's form state, the CRUD handlers — and the two
 * things no other config manager needs, because no other entity arrives four hundred at a time:
 * **a search box and a page** (v4 systems/13, TICKET-SPL-01). The panel renders; this decides.
 *
 * **The list is narrowed and then paged, in that order**, so a search reports how many spells match
 * rather than how many are on the page in front of you, and typing a letter always lands on the
 * first page of the new result rather than on page seven of a list that no longer has one.
 *
 * **Validates: v4 systems/13; Requirements 21.1-21.5**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Spell } from '#shared/types';
import { useConfigStore } from '../../../stores/configStore';
import { useEntityDialog } from '../shared/useEntityDialog';
import { useGuardedDelete } from '../shared/useGuardedDelete';

export interface SpellFormData {
  name: string;
  /** What the spell is, in the User's words; blank means the spell says nothing */
  description: string;
  /**
   * What casting costs, as the text the number box holds
   *
   * A string rather than a `valueAsNumber` field, for the reason `RaceFormData`'s optional rate is
   * one: `''` has to survive the round trip as **absent**, and a cleared numeric input arrives as
   * `NaN` — which is a number as far as `??` is concerned, serialises as `null`, and is exactly what
   * this panel's own importer refuses. Two instances of the pattern now; a third earns the
   * extraction. (That field is named indirectly on purpose: the scan beside `useRaceManager` fails
   * on any module outside its own plumbing that spells it, and a doc reference is not a reader.)
   */
  manaCost: string;
  rangeTime: string;
  effectTemplate: string;
}

/** The form value standing for "this spell says nothing about that" */
const UNSTATED = '';

/** How many spells one page of the list shows */
const SPELLS_PER_PAGE = 25;

/** A blank spell, which is what the dialog opens on for an add */
const EMPTY_SPELL_FORM: SpellFormData = {
  name: UNSTATED,
  description: UNSTATED,
  manaCost: UNSTATED,
  rangeTime: UNSTATED,
  effectTemplate: UNSTATED,
};

/**
 * The mana cost as the document stores it
 *
 * Blank is absent, and so is anything that does not read back as a finite number: a `NaN` in a
 * persisted numeric field serialises as `null`, which `ENTITY_SPECS.spells` refuses — so letting one
 * through would mean the panel writing a ruleset the app's own import turns away.
 */
function toStoredManaCost(entered: string): number | undefined {
  const trimmed = entered.trim();
  if (trimmed === UNSTATED) return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** An optional stored value as the form's text box holds it */
function toFormText(stored: string | number | undefined): string {
  return stored === undefined ? UNSTATED : String(stored);
}

/** How the list is narrowed: a case-insensitive substring of the spell's name */
function matchesSearch(spell: Spell, query: string): boolean {
  const spelled = spell.name.toLowerCase();
  return spelled.includes(query);
}

export function useSpellManager() {
  const config = useConfigStore((state) => state.config);
  const addSpell = useConfigStore((state) => state.addSpell);
  const updateSpell = useConfigStore((state) => state.updateSpell);
  const deleteSpell = useConfigStore((state) => state.deleteSpell);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const spellForm = useForm<SpellFormData>({ defaultValues: EMPTY_SPELL_FORM });
  const dialog = useEntityDialog(spellForm);

  const [search, setSearch] = useState(UNSTATED);
  const [page, setPage] = useState(0);

  const spells = config?.spells ?? [];

  const query = search.trim().toLowerCase();
  const matching =
    query === UNSTATED ? spells : spells.filter((spell) => matchesSearch(spell, query));

  // Clamped rather than merely stored: deleting the last spell on the last page would otherwise
  // leave the list on a page that no longer exists, showing nothing and offering no way back
  const pagesNeeded = Math.ceil(matching.length / SPELLS_PER_PAGE);
  const pageCount = Math.max(1, pagesNeeded);
  const currentPage = Math.min(page, pageCount - 1);
  const firstIndex = currentPage * SPELLS_PER_PAGE;
  const pagedSpells = matching.slice(firstIndex, firstIndex + SPELLS_PER_PAGE);

  /** Typing narrows the list, so the page it was on stops meaning anything */
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleAddSpell = () => {
    dialog.openForAdd(EMPTY_SPELL_FORM);
  };

  const handleEditSpell = (id: string) => {
    const spell = spells.find((candidate) => candidate.id === id);
    if (!spell) return;

    dialog.openForEdit(id, {
      name: spell.name,
      description: toFormText(spell.description),
      manaCost: toFormText(spell.manaCost),
      rangeTime: spell.rangeTime,
      effectTemplate: spell.effectTemplate,
    });
  };

  const handleDeleteSpell = (id: string) => {
    const spell = spells.find((candidate) => candidate.id === id);
    attemptDelete(`Spell ${spell?.name ?? id}`, (options) => deleteSpell(id, options));
  };

  const handleSaveSpell = spellForm.handleSubmit((data) => {
    const described = data.description.trim();
    const spell: Spell = {
      id: dialog.editingId ?? crypto.randomUUID(),
      name: data.name,
      // Explicitly `undefined` rather than omitted: that is what tells `updateSpell` to *delete* the
      // key, so clearing either optional field leaves no `""` or `NaN` behind
      description: described === UNSTATED ? undefined : described,
      manaCost: toStoredManaCost(data.manaCost),
      // Neither of these is trimmed or defaulted. The sheet's spellings are the ruleset's, an empty
      // range is what its six blank cells say, and an empty effect is what its one `#VERW!` row
      // says — normalising either here would be the importer's job, and it is nobody's (v4 D1)
      rangeTime: data.rangeTime,
      effectTemplate: data.effectTemplate,
    };

    if (dialog.editingId) {
      updateSpell(dialog.editingId, spell);
    } else {
      addSpell(spell);
    }

    dialog.close();
  });

  return {
    config,
    /** Every spell the ruleset holds, however the list is narrowed */
    spells,
    /** The spells matching the search, across every page */
    matchingCount: matching.length,
    /** The page's worth, which is what the panel draws */
    pagedSpells,
    search,
    handleSearchChange,
    /** 0-based, clamped to a page that exists */
    currentPage,
    pageCount,
    /** 1-based positions of the drawn spells within the match, for the *showing x–y of z* line */
    firstShown: matching.length === 0 ? 0 : firstIndex + 1,
    lastShown: firstIndex + pagedSpells.length,
    goToPreviousPage: () => setPage(currentPage - 1),
    goToNextPage: () => setPage(currentPage + 1),
    isSpellDialogOpen: dialog.isOpen,
    closeSpellDialog: dialog.close,
    editingSpellId: dialog.editingId,
    spellForm,
    handleAddSpell,
    handleEditSpell,
    handleDeleteSpell,
    handleSaveSpell,
    blocked,
    dismissBlocked,
  };
}
