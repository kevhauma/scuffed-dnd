/**
 * Why there is no sheet to draw, and the way back
 *
 * The five dead ends `useCharacterSheet` distinguishes, plus the one the *opening* of a table
 * character adds — each a different thing to tell the Player, which is why they were never collapsed
 * into one "unavailable" (TICKET-PLY-01).
 *
 * **Split out of `CharacterSheet` by TICKET-DM-01**, and by `fallow` rather than by taste: adding
 * the DM's panel and the adjustment log pushed that component past the complexity threshold, and
 * five of its branches were this — a chain of early returns that has nothing to do with laying out
 * a sheet. What is left there is one question, *is there a sheet*, and the layout that follows.
 *
 * It answers `null` when the sheet is drawable, so the caller's check and this component's cases
 * cannot fall out of step — a `status` this does not handle would render nothing and be visible
 * immediately, where a second `status === 'ready'` test in the caller could quietly disagree.
 *
 * **Validates: Requirements 14.1, 21.1-21.5; v3 Req 41.5**
 */

import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { CHARACTER_SHEET_STATUS, type CharacterSheetStatus } from './useCharacterSheet';

export interface SheetStatusNoticeProps {
  /** True while a character that lives at a table is being read */
  isOpening: boolean;
  status: CharacterSheetStatus;
  /**
   * What the character the route named is called, or `null` when there is none to draw
   *
   * The name and its absence are all two of these notices read, so that is what they take — passing
   * the whole `Character` for one field is the interface-segregation rule the other way round.
   */
  characterName: string | null;
  characterId: string;
  /** What the engine threw, on `formula-error` */
  formulaError: string | null;
  /** The last refusal, which on a failed *open* is the only place it can be shown */
  actionError: string | null;
  onBack: () => void;
}

/** One dead-end state: why there is no sheet, and the way back */
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

export function SheetStatusNotice({
  isOpening,
  status,
  characterName,
  characterId,
  formulaError,
  actionError,
  onBack,
}: SheetStatusNoticeProps) {
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

  if (status === CHARACTER_SHEET_STATUS.NO_CONFIGURATION) {
    return (
      <SheetNotice title="No Ruleset Yet" onBack={onBack}>
        <Text variant="body-secondary">
          A character can only be read against the ruleset it was built on. Set one up in
          configuration mode, or import one, then come back.
        </Text>
      </SheetNotice>
    );
  }

  if (status === CHARACTER_SHEET_STATUS.NOT_FOUND || characterName === null) {
    return (
      <SheetNotice title="Character Not Found" onBack={onBack}>
        {/* The banner on a drawable sheet only renders there, so a failed *open* would otherwise set
            a message nothing could show — the review found the sentence unreachable */}
        <Text variant="body-secondary">
          {actionError ??
            `No saved character has the id ${characterId}. It may have been deleted, or this link may be from another browser.`}
        </Text>
      </SheetNotice>
    );
  }

  if (status === CHARACTER_SHEET_STATUS.CONFIGURATION_MISMATCH) {
    return (
      <SheetNotice title="Different Ruleset Loaded" onBack={onBack}>
        <Text variant="body-secondary">
          {characterName} was built on another ruleset, so the loaded one cannot interpret their
          skills or stats. Import the ruleset this character belongs to, then reopen the sheet.
        </Text>
      </SheetNotice>
    );
  }

  if (status === CHARACTER_SHEET_STATUS.FORMULA_ERROR) {
    return (
      <SheetNotice title="Ruleset Formula Error" onBack={onBack}>
        <Text variant="body-secondary" className="mb-2">
          {characterName}'s derived values cannot be calculated — this ruleset has a formula that
          does not evaluate. Fix it in configuration mode and the sheet will come back.
        </Text>
        <Text variant="error" as="p">
          {formulaError}
        </Text>
      </SheetNotice>
    );
  }

  return null;
}
