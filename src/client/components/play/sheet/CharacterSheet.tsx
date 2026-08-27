/**
 * Character Sheet
 *
 * Play mode's main screen: identity, race stat blocks, current/max stats, skills and the rolls the
 * ruleset defines, for one character. Layout and composition only — every decision and every
 * number comes from `useCharacterSheet`.
 *
 * **Validates: Requirements 8.5, 13.4, 14.1, 14.2, 14.5, 21.1-21.5, 22.1-22.6**
 */

import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { InventoryPanel } from '../inventory/InventoryPanel';
import { RollHistoryPanel } from '../rolls/RollHistoryPanel';
import { useRoller } from '../rolls/useRoller';
import { RaceStatBlockSection } from './RaceStatBlockSection';
import { ResourcesSection } from './ResourcesSection';
import { RollsSection } from './RollsSection';
import { SheetHeader } from './SheetHeader';
import { SkillsSection } from './SkillsSection';
import { StatsSection } from './StatsSection';
import { useCharacterSheet } from './useCharacterSheet';
import { useOpenTableCharacter } from './useOpenTableCharacter';
import { WalletSection } from './WalletSection';

export interface CharacterSheetProps {
  /**
   * The character id from the route param. Named `characterId` rather than `id` because it is a
   * domain identifier, not a DOM `id` — matching the character store's own parameter naming.
   */
  characterId: string;
}

/** A dead-end state: why there is no sheet, and the way back */
function SheetNotice({
  title,
  children,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="p-8 text-center">
        <Text variant="h4" as="h1" className="mb-2">
          {title}
        </Text>
        <div className="mb-6">{children}</div>
        <Button variant="primary" onClick={onBack}>
          Back to Characters
        </Button>
      </Card>
    </div>
  );
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
    experience,
    raceContributions,
    skills,
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
    wallet,
    handleChangeInvestedPoints,
    handleChangeInvestedSkillPoints,
    handleChangeWalletAmount,
    handleAwardExperience,
    handleDeductExperience,
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

  // Before any dead-end notice: mid-read the character and the ruleset genuinely disagree, and
  // every one of those notices would be a confident wrong answer to a question still being asked
  if (isOpening) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-8 text-center">
          <Text variant="body-secondary">Opening this character…</Text>
        </Card>
      </div>
    );
  }

  if (status === 'no-configuration') {
    return (
      <SheetNotice title="No Ruleset Yet" onBack={handleBack}>
        <Text variant="body-secondary">
          A character can only be read against the ruleset it was built on. Set one up in
          configuration mode, or import one, then come back.
        </Text>
      </SheetNotice>
    );
  }

  if (status === 'not-found' || !character) {
    return (
      <SheetNotice title="Character Not Found" onBack={handleBack}>
        {/* The banner below only renders on a drawable sheet, so a failed *open* would otherwise set
            a message nothing could show — the review found the sentence unreachable */}
        <Text variant="body-secondary">
          {actionError ??
            `No saved character has the id ${characterId}. It may have been deleted, or this link may be from another browser.`}
        </Text>
      </SheetNotice>
    );
  }

  if (status === 'configuration-mismatch') {
    return (
      <SheetNotice title="Different Ruleset Loaded" onBack={handleBack}>
        <Text variant="body-secondary">
          {character.name} was built on another ruleset, so the loaded one cannot interpret their
          skills or stats. Import the ruleset this character belongs to, then reopen the sheet.
        </Text>
      </SheetNotice>
    );
  }

  if (status === 'formula-error') {
    return (
      <SheetNotice title="Ruleset Formula Error" onBack={handleBack}>
        <Text variant="body-secondary" className="mb-2">
          {character.name}'s derived values cannot be calculated — this ruleset has a formula that
          does not evaluate. Fix it in configuration mode and the sheet will come back.
        </Text>
        <Text variant="error" as="p">
          {formulaError}
        </Text>
      </SheetNotice>
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
      {/* The server's own sentence, kept beside the state it refused to change (v3 Req 41.5,
          TICKET-PLY-01). Nothing on the sheet has moved — a refused action is a request that landed
          nowhere — so this is the only sign of it, and it is dismissible rather than timed. */}
      {actionError && (
        <Card className="border-crimson p-4">
          <div role="alert" className="flex items-start justify-between gap-4">
            <Text variant="error" as="p">
              {actionError}
            </Text>
            <Button variant="secondary" size="sm" onClick={dismissActionError}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      <SheetHeader
        name={character.name}
        budget={budget}
        raceNames={raceNames}
        level={level}
        experience={experience}
        archetypeName={archetypeName}
        onBack={handleBack}
        // At a table experience and coin are the DM's (D9, v3 Req 42), so the Player's own sheet
        // draws neither control — TICKET-DM-01 and TICKET-DM-02 bring them back on the DM's side
        onAwardExperience={atTable ? undefined : handleAwardExperience}
        onDeductExperience={atTable ? undefined : handleDeductExperience}
      />

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
          <InventoryPanel characterId={characterId} />

          {/* Coin sits beside the equipment, as it does on the sheet (`Q18:S23`, right of the
              `M3:O15` boxes) — what you are carrying, in one column. Not at a table: a purse there
              is TICKET-CUR-02's shape and TICKET-DM-02's control. */}
          {!atTable && (
            <WalletSection
              tiers={currencyTiers}
              wallet={wallet}
              onChangeAmount={handleChangeWalletAmount}
            />
          )}

          <RollHistoryPanel history={rollHistory} onClear={handleClearHistory} />
        </div>
      </div>

      <SkillsSection skills={skills} onChangeInvestedPoints={handleChangeInvestedSkillPoints} />
    </div>
  );
}
