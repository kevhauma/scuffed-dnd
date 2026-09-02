/**
 * Everything the session roster reads and does (TICKET-DM-04, v3 Req 49.8, 49.9)
 *
 * `useSessionsManager`'s counterpart one level down: it composes rather than does. Four reads keyed on
 * the open row — the Members, the characters, the Snapshot and the table's rolls — plus the live feed
 * that keeps the first two current, and the pure `toRosterView` that turns them into rows.
 *
 * **This hook replaced two.** `useSessionMembers` and `useSessionCharacters` are still the reads, but
 * a surface that answers *who is here* and *what are their numbers* in one list needs them together,
 * and the manager was handing them to two components that each knew half the answer.
 *
 * ## Who may act, answered from the listing
 *
 * [`useIsDungeonMaster`](../../play/dm/useIsDungeonMaster.ts) cannot serve here — it compares against
 * *the* character open in `characterStore`, and a roster has none open and twenty on screen. So the
 * same rule is read from the source this surface does have: the reader holds the `dm` seat in the
 * member listing, **and does not own the character in question**. That second clause is not decoration
 * — `requireCharacterDM` is `requireCharacterWriter` minus the owner, so a DM pressing a `dm-` action
 * on their **own** character is refused a 404, and a row that offered one would be offering a button
 * that cannot work. See {@link actsAsDungeonMasterOver}.
 *
 * ## Every number is derived, and none of it is stored
 *
 * `toRosterView` runs the engine per character against the **Snapshot** (D7). It is memoised on the
 * four things it reads, because that is `calculateCharacter` once per character per change rather than
 * once per character per keystroke anywhere on the page.
 *
 * **Validates: v3 Req 39.7, 40.4, 42.7, 49.8, 49.9, 49.10**
 */

import { useCallback, useMemo } from 'react';
import type { CharacterAdjustment, SessionMemberSummary, SessionRoll } from '#shared/types/api';
import { MEMBER_ROLE } from '#shared/types/api';
import { useAuth } from '../../auth/useAuth';
import type { AdjustmentVocabulary } from '../../play/dm/adjustmentVocabulary';
import { adjustmentVocabularyFrom } from '../../play/dm/adjustmentVocabulary';
import { useSessionCharacters } from '../useSessionCharacters';
import { useSessionMembers } from '../useSessionMembers';
import type { RosterGroup } from './rosterView';
import { toRosterView } from './rosterView';
import type { RosterReads } from './useCoalescedReads';
import { adjustmentsFor, useRosterFeed } from './useRosterFeed';
import type { RollNames } from './useSessionRollLog';
import { useSessionRollLog } from './useSessionRollLog';
import { useSessionSnapshot } from './useSessionSnapshot';

/** What the roster surface needs */
export interface SessionRosterState {
  /** One group per Member, plus the departed, in a stable order */
  groups: RosterGroup[];
  /** Which Account is reading, so its own group can be told apart */
  accountId: string | null;
  /** Whether the reader holds the `dm` seat at this table */
  isDm: boolean;
  /** How this ruleset spells what an adjustment names — the rows' quick actions read it */
  words: AdjustmentVocabulary;
  /** Every roll at this table, newest first (v3 Req 41.6) */
  rolls: SessionRoll[];
  /**
   * True while the **roll log's own** first read is in flight
   *
   * Separate from {@link SessionRosterState.isPending} because the other three reads settle
   * independently of this one, and in the window where they are done and this is not, the log would
   * otherwise render *"No rolls at this table yet"* — a confident wrong answer on the one surface
   * whose whole discipline is never to give one.
   */
  areRollsPending: boolean;
  /** True while any of the roster's reads is still on its first pass */
  isPending: boolean;
  /** True while a membership write is on the wire */
  isBusy: boolean;
  error: string | null;
  /** True while this table's rules are being opened for the wizard */
  isOpeningRules: boolean;
  makeCharacterHere: () => void;
  openCharacter: (characterId: string) => void;
  /** Take a seat away — the DM removing somebody, or anybody giving up their own */
  remove: (accountId: string) => Promise<boolean>;
  /** Hand the table to another Member */
  transfer: (accountId: string) => Promise<boolean>;
  /**
   * Whether this reader acts on that character as the table's DM (v3 Req 49.10)
   *
   * The roster's own reading of the rule `useIsDungeonMaster` answers on a sheet — see the module
   * note for why it cannot be that hook.
   */
  actsAsDm: (ownerAccountId: string) => boolean;
  /** The newest adjustment seen live for one character, for its row's quick actions */
  adjustments: (characterId: string) => CharacterAdjustment[];
}

/**
 * Whether a reader acts on one character as the table's DM
 *
 * Pure, and named rather than inlined, because it is a **rule** and the same rule is answered from a
 * different source on the character sheet. Both clauses matter: holding the `dm` seat is what the
 * server's `requireDM` checks, and not owning the character is what `requireCharacterDM` adds — a DM
 * pressing a `dm-` action on their own sheet is refused, so the roster must not offer one.
 *
 * @param isDm Whether the reader holds the `dm` seat at this table
 * @param accountId Who is reading, or `null` while the cookie is unresolved
 * @param ownerAccountId Whose character the row is
 * @returns Whether to offer the quick actions
 */
export function actsAsDungeonMasterOver(
  isDm: boolean,
  accountId: string | null,
  ownerAccountId: string
): boolean {
  // Says no while the cookie is unresolved, `useIsDungeonMaster`'s rule and for its reason: a
  // half-identified browser must not flash a DM's controls onto somebody's roster
  if (!isDm || accountId === null) return false;

  return ownerAccountId !== accountId;
}

/** Whether this Account holds the `dm` seat at the table, according to the listing */
export function holdsDmSeat(members: SessionMemberSummary[], accountId: string | null): boolean {
  if (accountId === null) return false;

  const you = members.find((member) => member.accountId === accountId);

  return you?.role === MEMBER_ROLE.DM;
}

/**
 * Drive one table's roster
 *
 * @param sessionId Which table, or `null` when no table is open
 * @returns The roster, and everything that can be done from it
 */
export function useSessionRoster(sessionId: string | null): SessionRosterState {
  const { accountId } = useAuth();

  const members = useSessionMembers(sessionId);
  const characters = useSessionCharacters(sessionId);
  const rules = useSessionSnapshot(sessionId);

  const memberRows = members.members;
  const snapshot = rules.snapshot;

  /** How this table spells an Account, for a live adjustment's `by` and a live roll's `rolledBy` */
  const nameOfAccount = useCallback(
    (id: string | null) => {
      if (id === null) return null;

      const member = memberRows.find((one) => one.accountId === id);

      return member?.name ?? null;
    },
    [memberRows]
  );

  const reads: RosterReads = {
    characters: characters.reload,
    rules: rules.reload,
    members: members.reload,
  };

  /**
   * The two halves as the server last gave them
   *
   * Memoised on the two arrays rather than rebuilt each render: the feed replaces what is on screen
   * whenever this identity changes, so an object minted per render would throw away every patch it
   * had just applied, once a frame.
   */
  const fetched = useMemo(
    () => ({ characters: characters.characters, members: memberRows }),
    [characters.characters, memberRows]
  );

  const feed = useRosterFeed(sessionId, fetched, reads, nameOfAccount);

  const held = feed.characters;

  /**
   * Who is at the table **as the live feed has it** (TICKET-LIVE-04)
   *
   * Everything below reads this rather than `memberRows`: the groups, the departed group derived
   * from them, and who holds the `dm` seat — so a removal at another browser takes a group off this
   * one, moves that Member's characters to *departed*, and a handover moves both the badge and the
   * controls, with nothing refetched.
   *
   * `nameOfAccount` above is deliberately still the **fetched** list. It answers *what is this
   * Account called*, and a Member who has just left is exactly the one whose name a passing
   * adjustment may still need to spell.
   */
  const seated = feed.members;

  /** …and a character, which only the listing can answer once a roll's own sheet is not open */
  const rollNames: RollNames = {
    character: (characterId: string) => {
      const document = held.find((one) => one.id === characterId);

      // The wording `listRolls` uses for the same case, so a fetched row and a live one read alike
      return document?.character.name ?? 'A departed character';
    },
    account: nameOfAccount,
  };

  const log = useSessionRollLog(sessionId, rollNames);

  const groups = useMemo(
    () => toRosterView(seated, held, snapshot, accountId),
    [seated, held, snapshot, accountId]
  );

  const words = useMemo(
    () => adjustmentVocabularyFrom(snapshot, snapshot?.stats ?? []),
    [snapshot]
  );

  const isDm = holdsDmSeat(seated, accountId);

  return {
    groups,
    accountId,
    isDm,
    words,
    rolls: log.rolls,
    areRollsPending: log.isPending,
    // Any first read still running: a roster missing its rules would draw names with blank columns,
    // which reads as *these characters have no points* rather than as *still loading*
    isPending: members.isPending || characters.isPending || rules.isPending,
    isBusy: members.isBusy,
    // The three reads report independently, and the first refusal is shown — masking one behind
    // another is the IO-04 review's lesson
    error: members.error ?? characters.error ?? rules.error,
    isOpeningRules: characters.isOpeningRules,
    makeCharacterHere: characters.makeCharacterHere,
    openCharacter: characters.openCharacter,
    remove: members.remove,
    transfer: members.transfer,
    actsAsDm: (ownerAccountId: string) => actsAsDungeonMasterOver(isDm, accountId, ownerAccountId),
    adjustments: (characterId: string) => adjustmentsFor(feed, characterId),
  };
}
