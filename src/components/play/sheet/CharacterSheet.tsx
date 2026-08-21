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
import { RollsSection } from './RollsSection';
import { SheetHeader } from './SheetHeader';
import { SkillsSection } from './SkillsSection';
import { StatsSection } from './StatsSection';
import { useCharacterSheet } from './useCharacterSheet';

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
    handleChangeStatValue,
    handleAdjustStatValue,
    handleResetStatValueToMax,
    handleChangeInvestedPoints,
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
        <Text variant="body-secondary">
          No saved character has the id {characterId}. It may have been deleted, or this link may be
          from another browser.
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

  return (
    <div className="max-w-4xl mx-auto space-y-4 p-6">
      <SheetHeader
        name={character.name}
        raceNames={raceNames}
        level={level}
        experience={experience}
        archetypeName={archetypeName}
        onBack={handleBack}
        onAwardExperience={handleAwardExperience}
        onDeductExperience={handleDeductExperience}
      />

      <RaceStatBlockSection raceNames={raceNames} raceContributions={raceContributions} />

      <StatsSection
        stats={stats}
        statTotal={statTotal}
        budget={budget}
        onChangeStatValue={handleChangeStatValue}
        onAdjustStatValue={handleAdjustStatValue}
        onResetStatValueToMax={handleResetStatValueToMax}
        onChangeInvestedPoints={handleChangeInvestedPoints}
      />

      <InventoryPanel characterId={characterId} />

      <SkillsSection skills={skills} />

      <RollsSection
        rollGroups={rollGroups}
        results={rollResults}
        errors={rollErrors}
        canRoll={canRoll}
        onRoll={handleRoll}
      />

      <RollHistoryPanel history={rollHistory} onClear={handleClearHistory} />
    </div>
  );
}
