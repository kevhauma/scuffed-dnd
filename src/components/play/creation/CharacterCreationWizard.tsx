/**
 * Character Creation Wizard
 *
 * Four steps to a valid character. Layout and composition only — `useCharacterCreation` decides.
 *
 * **Validates: Requirements 11.1-11.6, 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { FocusStatStep } from './FocusStatStep';
import { IdentityStep } from './IdentityStep';
import { ReviewStep } from './ReviewStep';
import { SkillAllocationStep } from './SkillAllocationStep';
import { useCharacterCreation } from './useCharacterCreation';

export function CharacterCreationWizard() {
  const {
    config,
    hasConfiguration,
    form,
    values,
    stepIndex,
    steps,
    stepError,
    canGoNext,
    canGoBack,
    isLastStep,
    stats,
    investableStats,
    derivedStatPreviews,
    skills,
    races,
    raceBases,
    canAddRace,
    maxRaceCount,
    budget,
    gains,
    preview,
    previewError,
    toggleRace,
    setInvestedStatPoints,
    setInvestedSkillPoints,
    setFocusStatCode,
    handleNext,
    handleBack,
    handleCancel,
    handleConfirm,
  } = useCharacterCreation();

  // A character cannot be built without a ruleset, so no form is offered
  if (!hasConfiguration || !config) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Text variant="h1" as="h1" className="mb-6">
          Create Character
        </Text>
        <Card className="p-8 text-center">
          <Text variant="h4" as="h2" className="mb-2">
            No Ruleset Yet
          </Text>
          <Text variant="body-secondary" className="mb-6">
            A character is built on a configuration. Set one up in configuration mode, then come
            back here.
          </Text>
          <Button variant="secondary" onClick={handleCancel}>
            Back to Characters
          </Button>
        </Card>
      </div>
    );
  }

  const selectedRaceNames = races
    .filter((race) => values.raceIds.includes(race.id))
    .map((race) => race.name);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Text variant="h1" as="h1" className="mb-2">
        Create Character
      </Text>

      <nav aria-label="Progress" className="mb-6 flex flex-wrap gap-2">
        {steps.map((label, index) => (
          <Text
            key={label}
            as="span"
            variant={index === stepIndex ? 'highlight' : 'body-small-secondary'}
          >
            {index + 1}. {label}
          </Text>
        ))}
      </nav>

      {stepIndex === 0 && (
        <IdentityStep
          register={form.register}
          races={races}
          selectedRaceIds={values.raceIds}
          canAddRace={canAddRace}
          maxRaceCount={maxRaceCount}
          onToggleRace={toggleRace}
        />
      )}

      {stepIndex === 1 && (
        <SkillAllocationStep
          investableStats={investableStats}
          derivedStatPreviews={derivedStatPreviews}
          skills={skills}
          investedStatPoints={values.investedStatPoints}
          investedSkillPoints={values.investedSkillPoints}
          raceBases={raceBases}
          budget={budget}
          gains={gains}
          onChangeInvestedStatPoints={setInvestedStatPoints}
          onChangeInvestedSkillPoints={setInvestedSkillPoints}
        />
      )}

      {stepIndex === 2 && (
        <FocusStatStep
          stats={config.stats}
          focusStatBonusLevel={config.focusStatBonusLevel}
          focusStatCode={values.focusStatCode}
          onChangeFocusStatCode={setFocusStatCode}
        />
      )}

      {stepIndex === 3 && (
        <ReviewStep
          config={config}
          stats={stats}
          characterName={values.name.trim()}
          raceNames={selectedRaceNames}
          preview={preview}
          previewError={previewError}
        />
      )}

      {stepError && (
        <Text variant="error" as="p" className="mt-4">
          {stepError}
        </Text>
      )}

      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <Button variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleBack} disabled={!canGoBack}>
            Back
          </Button>
          {isLastStep ? (
            <Button variant="primary" onClick={handleConfirm} disabled={stepError !== null}>
              Create Character
            </Button>
          ) : (
            <Button variant="primary" onClick={handleNext} disabled={!canGoNext}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
