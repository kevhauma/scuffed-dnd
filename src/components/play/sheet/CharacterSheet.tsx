/**
 * Character Sheet
 *
 * Play mode's main screen: identity, racial modifiers, main skills, current/max stats, speciality
 * skills and combat skills for one character. Layout and composition only — every decision and
 * every number comes from `useCharacterSheet`.
 *
 * **Validates: Requirements 8.5, 9.3, 13.4, 14.1, 14.2, 14.5, 21.1-21.5, 22.1-22.6**
 */

import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { CombatSkillsSection } from './CombatSkillsSection';
import { MainSkillsSection } from './MainSkillsSection';
import { RacialModifiersSection } from './RacialModifiersSection';
import { SheetHeader } from './SheetHeader';
import { SpecialitySkillsSection } from './SpecialitySkillsSection';
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
    formulaError,
    raceNames,
    level,
    racialModifiers,
    mainSkills,
    specialitySkills,
    stats,
    combatSkills,
    handleChangeStatValue,
    handleBack,
  } = useCharacterSheet(characterId);

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
          No saved character has the id {characterId}. It may have been deleted, or this link may
          be from another browser.
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
        focusStatCode={character.focusStatCode}
        onBack={handleBack}
      />

      <RacialModifiersSection raceNames={raceNames} racialModifiers={racialModifiers} />

      <MainSkillsSection mainSkills={mainSkills} />

      <StatsSection stats={stats} onChangeStatValue={handleChangeStatValue} />

      <SpecialitySkillsSection specialitySkills={specialitySkills} />

      <CombatSkillsSection combatSkills={combatSkills} />
    </div>
  );
}
