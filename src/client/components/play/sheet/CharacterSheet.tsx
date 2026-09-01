/**
 * Character Sheet
 *
 * Play mode's main screen: identity, race stat blocks, current/max stats, skills and the rolls the
 * ruleset defines, for one character. Layout and composition only — every decision and every
 * number comes from `useCharacterSheet`.
 *
 * **Including *whether each section has controls at all*** (TICKET-DM-05). The six handlers this file
 * passes down are `undefined` for the table's DM, whose writes `requireCharacterPlayer` refuses, and
 * each section draws a display instead. **Nothing here branches on that**, which is deliberate:
 * `usePlayerControls` answers with absent fields rather than a `null` bundle exactly so this file
 * gains no conditional — see that module for why the four hooks before it answer differently.
 *
 * **Validates: Requirements 8.5, 13.4, 14.1, 14.2, 14.5, 21.1-21.5, 22.1-22.6; v3 Req 42.7, 49.10**
 */

import { AdjustmentLog } from '../dm/AdjustmentLog';
import { DmControlsPanel } from '../dm/DmControlsPanel';
import { QuickActionsSidebar } from '../dm/QuickActionsSidebar';
import { useCharacterAdjustments } from '../dm/useCharacterAdjustments';
import { useDmControls } from '../dm/useDmControls';
import { InventoryPanel } from '../inventory/InventoryPanel';
import { PassivesPanel } from '../passives/PassivesPanel';
import { RollHistoryPanel } from '../rolls/RollHistoryPanel';
import { useRoller } from '../rolls/useRoller';
import { SpellbookPanel } from '../spells/SpellbookPanel';
import { FocusSkillsSection } from './FocusSkillsSection';
import { PurseSection } from './PurseSection';
import { RaceStatBlockSection } from './RaceStatBlockSection';
import { ResourcesSection } from './ResourcesSection';
import { RollsSection } from './RollsSection';
import { SheetHeader } from './SheetHeader';
import { SheetRefusalBanner } from './SheetRefusalBanner';
import { SheetStatusNotice } from './SheetStatusNotice';
import { SkillsSection } from './SkillsSection';
import { StatsSection } from './StatsSection';
import { CHARACTER_SHEET_STATUS, useCharacterSheet } from './useCharacterSheet';
import { useOpenTableCharacter } from './useOpenTableCharacter';
import { usePurseControls } from './usePurseControls';

export interface CharacterSheetProps {
  /**
   * The character id from the route param. Named `characterId` rather than `id` because it is a
   * domain identifier, not a DOM `id` — matching the character store's own parameter naming.
   */
  characterId: string;
}

export function CharacterSheet({ characterId }: CharacterSheetProps) {
  // A sheet reached by URL may be a character that lives on the server (TICKET-PLY-01) — this reads
  // it and its table's rules before anything below is asked to interpret it
  const isOpening = useOpenTableCharacter(characterId);

  const {
    status,
    character,
    calculated,
    formulaError,
    raceNames,
    archetypeName,
    level,
    dreamLevel,
    experience,
    raceContributions,
    skills,
    focusSlots,
    isFocusDialled,
    stats,
    statTotal,
    budget,
    rollGroups,
    atTable,
    actionError,
    dismissActionError,
    handleChangeStatValue,
    handleAdjustStatValue,
    handleResetStatValueToMax,
    currencyTiers,
    purse,
    adjustmentWords,
    quickActions,
    grantedPoints,
    handleChangeInvestedPoints,
    handleChangeInvestedSkillPoints,
    handleSelectFocusSkill,
    handleAwardExperience,
    handleDeductExperience,
    handleSetDreamLevel,
    handleBack,
  } = useCharacterSheet(characterId);

  const {
    results: rollResults,
    errors: rollErrors,
    history: rollHistory,
    canRoll,
    handleRoll,
    handleClearHistory,
  } = useRoller(characterId, calculated);

  // The DM's half (TICKET-DM-01). `isDungeonMaster` is false on every local sheet and on the
  // Player's own, so signed out this is a hook that answers *no* and renders nothing (D6).
  const dm = useDmControls(characterId);

  // Re-read whenever the sheet changes, which is what makes an adjustment appear under the number
  // it moved rather than on the next page load
  const adjustments = useCharacterAdjustments(character, atTable);

  // Who may change the money (TICKET-DM-02) — `null` for a Player at a table, whose purse the DM
  // hands out. The pack's equivalent decision is inside `InventoryPanel`'s own hook.
  const purseControls = usePurseControls(characterId, atTable);

  // Every reason there is no sheet, in one component (TICKET-DM-01): six of them, each a different
  // thing to tell the Player, and none of them anything to do with laying a sheet out
  if (isOpening || status !== CHARACTER_SHEET_STATUS.READY || !character) {
    return (
      <SheetStatusNotice
        isOpening={isOpening}
        status={status}
        characterName={character?.name ?? null}
        characterId={characterId}
        formulaError={formulaError}
        actionError={actionError}
        onBack={handleBack}
      />
    );
  }

  // Split once, here, rather than filtering inside each section: the two sections are two
  // different readings of one list, and which side a stat falls on is the sheet's decision
  const resources = stats.filter((stat) => stat.isResource);
  const plainStats = stats.filter((stat) => !stat.isResource);

  /*
   * The sheet is laid out the way the source spreadsheet's `Charactersheet` tab is: the
   * character's *numbers* down the left (stats, rolls, what the race contributed) and their
   * *kit* on the right (`M3:O15`'s equipment figure, the pack), with the identity across the top
   * and the skills table full width beneath — where the sheet keeps them on their own tab.
   *
   * It replaced one narrow column of stacked cards, which meant the two things a Player looks at
   * together during play, a stat and the roll it feeds, were never on screen at once.
   *
   * The rail is `lg:` only. Below that the columns stack in source order, which puts stats first
   * and equipment after — the same reading order, one thing at a time.
   */
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <SheetRefusalBanner message={actionError} onDismiss={dismissActionError} />

      <SheetHeader
        name={character.name}
        budget={budget}
        raceNames={raceNames}
        level={level}
        dreamLevel={dreamLevel}
        experience={experience}
        archetypeName={archetypeName}
        onBack={handleBack}
        // At a table experience, coin and the dream level are the DM's (D9, v3 Req 42.5, the v4
        // ruling), so the Player's own sheet draws none of those controls — TICKET-DM-01,
        // TICKET-DM-02 and TICKET-RES-04 bring them back on the DM's side
        onAwardExperience={atTable ? undefined : handleAwardExperience}
        onDeductExperience={atTable ? undefined : handleDeductExperience}
        onSetDreamLevel={atTable ? undefined : handleSetDreamLevel}
      />

      {/* Above the sheet rather than in the rail: it is the reason this reader has the page open,
          and a DM scanning for a control should not have to find it among the Player's own (v3 Req
          42.7). **TICKET-DM-03 settled the split rather than moving this**: the per-field controls —
          set a level, set a dream level, put a pool at an exact number — stay here, and the acts a
          DM presses dozens of times a session are `QuickActionsSidebar` in the rail below. */}
      {dm.isDungeonMaster && (
        <DmControlsPanel
          characterName={character.name}
          experience={experience}
          budget={budget}
          dreamLevel={dreamLevel}
          resources={resources}
          isBusy={dm.isBusy}
          onAwardExperience={dm.handleAwardExperience}
          onDeductExperience={dm.handleDeductExperience}
          onSetLevel={dm.handleSetLevel}
          onSetGrantedPoints={dm.handleSetGrantedPoints}
          onSetResource={dm.handleSetResource}
          onSetDreamLevel={dm.handleSetDreamLevel}
        />
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* Pools first: current health is the number somebody looks at mid-fight, and the stats
              behind it are the ones they look at between sessions */}
          <ResourcesSection
            resources={resources}
            budget={budget}
            onChangeStatValue={handleChangeStatValue}
            onAdjustStatValue={handleAdjustStatValue}
            onResetStatValueToMax={handleResetStatValueToMax}
            onChangeInvestedPoints={handleChangeInvestedPoints}
          />

          <StatsSection
            stats={plainStats}
            statTotal={statTotal}
            budget={budget}
            onChangeInvestedPoints={handleChangeInvestedPoints}
          />

          <RollsSection
            rollGroups={rollGroups}
            results={rollResults}
            errors={rollErrors}
            canRoll={canRoll}
            onRoll={handleRoll}
          />

          <RaceStatBlockSection raceNames={raceNames} raceContributions={raceContributions} />
        </div>

        {/* Not sticky, though a rail invites it: the rack plus the pack plus the roll history is
            taller than a laptop viewport, and a pinned column taller than the screen makes its own
            bottom unreachable. */}
        <div className="space-y-4">
          {/* First in the rail, above the pack: a DM with somebody else's sheet open has it open in
              order to change something, and *take 7 off them* should not be found by scrolling past
              their stat rows. `DmControlsPanel` stays above the grid for the slower per-field edits —
              a level, a dream level, a pool set to an exact number (TICKET-DM-03, v3 Req 49.7).

              **Drawn unconditionally and absent by its own decision**, as every other panel in this
              rail is: it answers `null` for anybody who is not this table's DM. It is handed the
              adjustments the hook above already fetched rather than asking for them a second time —
              the newest row past the one an action was sent against *is* that action's
              before → after. */}
          <QuickActionsSidebar
            characterId={characterId}
            characterName={character.name}
            actions={quickActions}
            adjustments={adjustments}
            words={adjustmentWords}
            grantedPoints={grantedPoints}
          />

          <InventoryPanel characterId={characterId} />

          {/* Beside the kit rather than under the stats: what a caster reaches for mid-fight is the
              spell and the pool it costs, which is the same column as the rack and the purse. Draws
              nothing at all on a ruleset that knows no magic (TICKET-SPL-02). */}
          <SpellbookPanel characterId={characterId} />

          {/* Under the Spellbook because it is the other list of *what this character is* rather
              than what they carry (v4 systems/14). **Who may change it is the reader**: locally the
              Player hands abilities to themselves, because signed out there is no DM; at a table the
              handout is the DM's alone, so a Player sees the list with no controls and the DM sees
              it with them (TICKET-PAS-01). Draws nothing on a ruleset naming no passives. */}
          <PassivesPanel characterId={characterId} atTable={atTable} />

          {/* Coin sits beside the equipment, as it does on the sheet (`Q18:S23`, right of the
              `M3:O15` boxes) — what you are carrying, in one column. **Always drawn since
              TICKET-DM-02**, and who gets an entry box is `usePurseControls`': locally the Player,
              at a table the DM (D9, v3 Req 42.5), and a Player at a table reads the amount they were
              handed rather than being shown nothing at all. */}
          <PurseSection
            tiers={currencyTiers}
            purse={purse}
            onSet={purseControls?.set}
            onAdjust={purseControls?.adjust}
          />

          {/* No *Clear* at a table: that log is the session's Event log, which is append-only
              (TICKET-ROLL-07) */}
          <RollHistoryPanel
            history={rollHistory}
            onClear={atTable ? undefined : handleClearHistory}
          />

          {/* v3 Req 42.7's second half: a Player reads the Events that changed their own sheet.
              At a table only — a local character has no DM and no Event log to project. */}
          {atTable && <AdjustmentLog adjustments={adjustments} words={adjustmentWords} />}
        </div>
      </div>

      {/* Above the grid it changes, as the workbook has it: the Setup tab's three picks decide what
          every row of the skills table is multiplied by (TICKET-SKL-05) */}
      <FocusSkillsSection
        skills={skills}
        slots={focusSlots}
        isDialled={isFocusDialled}
        onSelectFocusSkill={handleSelectFocusSkill}
      />

      {/* The same `budget` the stats above spend from — one pool for both since TICKET-RES-05 */}
      <SkillsSection
        skills={skills}
        budget={budget}
        onChangeInvestedPoints={handleChangeInvestedSkillPoints}
      />
    </div>
  );
}
