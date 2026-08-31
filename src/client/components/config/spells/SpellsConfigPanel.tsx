/**
 * Spells Configuration Panel
 *
 * The ruleset's spell compendium — name, mana cost, range/time and effect text per spell (v4
 * systems/13, TICKET-SPL-01).
 *
 * **The one thing about spells that is harder than any other entity is the count.** Every other
 * config panel lists its entities and stops: a ruleset has nine stats, a couple of dozen materials,
 * a handful of archetypes. The source workbook has **418 spells**, so this panel narrows before it
 * draws — a name search over the whole compendium, then one page of the result — and the header
 * says how many matched rather than how many are on screen. Without that the section is four hundred
 * cards and a scrollbar, which is a list nobody can find anything in.
 *
 * `useSpellManager` decides what the page holds; this renders it.
 *
 * **Validates: v4 systems/13; Requirements 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { FormField } from '../../ui/FormField/FormField';
import { Text } from '../../ui/Text/Text';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { SpellCard } from './SpellCard';
import { SpellFormDialog } from './SpellFormDialog';
import { useSpellManager } from './useSpellManager';

export function SpellsConfigPanel() {
  const {
    config,
    spells,
    matchingCount,
    pagedSpells,
    search,
    handleSearchChange,
    currentPage,
    pageCount,
    firstShown,
    lastShown,
    goToPreviousPage,
    goToNextPage,
    isSpellDialogOpen,
    closeSpellDialog,
    editingSpellId,
    spellForm,
    handleAddSpell,
    handleEditSpell,
    handleDeleteSpell,
    handleSaveSpell,
    blocked,
    dismissBlocked,
  } = useSpellManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  const hasSpells = spells.length > 0;

  return (
    <ConfigPanelShell
      title="Spells"
      description="The compendium a caster draws from — what each spell costs, reaches and does"
      actions={
        <Button variant="primary" onClick={handleAddSpell}>
          Add Spell
        </Button>
      }
      headerExtra={
        hasSpells && (
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <FormField
              label="Search"
              placeholder="Search spells by name"
              className="w-64"
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
            <Text variant="body-small-secondary">
              {matchingCount === 0
                ? `No spells match "${search.trim()}" of ${spells.length}`
                : `Showing ${firstShown}–${lastShown} of ${matchingCount}`}
            </Text>
          </div>
        )
      }
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {!hasSpells && (
        <ConfigEmptyState message="No spells configured yet. Click 'Add Spell' to start the compendium." />
      )}

      {hasSpells && matchingCount === 0 && (
        // A search that matches nothing is a different sentence from a ruleset with no spells, and
        // conflating the two tells a User their compendium is empty when it is merely filtered
        <ConfigEmptyState message={`No spells match "${search.trim()}".`} />
      )}

      {matchingCount > 0 && (
        <div className="space-y-2">
          {pagedSpells.map((spell) => (
            <SpellCard
              key={spell.id}
              spell={spell}
              onEdit={handleEditSpell}
              onDelete={handleDeleteSpell}
            />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="secondary" disabled={currentPage === 0} onClick={goToPreviousPage}>
            Previous
          </Button>
          <Text variant="body-small-secondary">
            Page {currentPage + 1} of {pageCount}
          </Text>
          <Button
            variant="secondary"
            disabled={currentPage === pageCount - 1}
            onClick={goToNextPage}
          >
            Next
          </Button>
        </div>
      )}

      <SpellFormDialog
        isOpen={isSpellDialogOpen}
        isEditing={!!editingSpellId}
        form={spellForm}
        // The ruleset the effect's placeholders are scoped and previewed against (TICKET-SPL-03).
        // The shell above only renders when there is one, so this is never null by the time the
        // dialog can open.
        config={config}
        onClose={closeSpellDialog}
        onSave={handleSaveSpell}
      />
    </ConfigPanelShell>
  );
}
