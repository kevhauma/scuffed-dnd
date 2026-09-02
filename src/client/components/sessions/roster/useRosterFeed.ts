/**
 * Keeping the roster current while the whole table acts on it (TICKET-DM-04, v3 Req 49.9)
 *
 * A DM reads this list and takes 7 off somebody without checking it first, which is exactly why it
 * has to be live: a stale roster is worse than no roster, because it looks authoritative. This is the
 * mechanism, and it is deliberately the sheet's mechanism applied to a list.
 *
 * ## The rule is `applyEventToCharacter`, not a second one
 *
 * Every Event goes through the **same pure function** the open sheet uses
 * ([`liveEvents.ts`](../../../services/liveEvents.ts)), which answers `applied` / `elsewhere` /
 * `stale` against CLAUDE.md's five sanctioned stored fields. A roster-shaped applier would have been
 * a second place for *what an Event does to a character* to live, and the two would have disagreed the
 * first time an action was added — the exhaustive `Record<SheetAction, …>` there is a compile error
 * for exactly one module, and it should stay that way.
 *
 * `elsewhere` on a table's own feed is almost always a roll. It costs nothing and must not provoke a
 * read, or every throw of the dice would refetch the party.
 *
 * ## …and the member list has an applier of its own, for the half the sheet has no opinion about
 *
 * TICKET-LIVE-04 gave the four membership acts an Event, and the roster is the surface that draws
 * what they change. It is a **second** pure applier ([`membershipEvents.ts`](./membershipEvents.ts))
 * rather than a second arm of the first, because the two answer about different things — a member
 * list and a character — and folding them together would give one module two exhaustiveness
 * obligations and no way to check either.
 *
 * The division of labour is the same as it is for a character: what can be patched is patched, and
 * what cannot asks. A removal and a handover carry ids and are applied; a **join** carries an id and
 * no name (v3 Req 44.3), so it is the one membership Event that costs a read — of the **member list
 * alone**, never the characters and never the rules.
 *
 * ## Three things can be stale, and they are re-read separately
 *
 * A character going `stale` — a built item, a learned spell — needs the **characters** again. A
 * Snapshot refresh needs the **rules** again, because every number on this surface is priced against
 * them, and it is the one Event that must be handled by name rather than through the applier: with no
 * characters at the table yet there is nothing for the applier to be stale *about*, and the roster
 * would keep deriving against rules that had moved. A join needs the **members**.
 *
 * ## When to ask again is [`useCoalescedReads`](./useCoalescedReads.ts)'s
 *
 * One re-read for a burst, and a trailing pass after one that raced an in-flight answer — split out
 * when `fallow` measured this hook at 17 cognitive against a threshold of 15. What is left here is
 * *what an Event means to a character*; the timing is next door, and the two really are different
 * subjects rather than a number moved somewhere else. Both re-reads it performs are the listing
 * hooks' own — a second spelling of *what the roster is made of* is the thing most likely to drift.
 *
 * ## …and the adjustments come free
 *
 * Each row's quick actions want to say what the last one did and offer to undo it (v3 Req 49.5, 49.6),
 * which on the sheet costs a request to `GET /api/characters/:id/adjustments`. On a roster that would
 * be **one request per row**. It is unnecessary: the DM's own adjustment arrives here as an Event
 * moments after it is made, carrying the very before → after that endpoint would report. So the newest
 * one per character is kept as it goes past, and `useQuickActions` reads it exactly as it reads the
 * fetched kind.
 *
 * **Only the newest is kept**, because only the newest is read: `landedSince` asks *is the top row
 * newer than the mark I set*. A history here would be a log nothing renders — that surface is the
 * sheet's `AdjustmentLog`, which has the fetched log and the whole of it.
 *
 * **Validates: v3 Req 44.6, 44.7, 44.9, 49.5, 49.6, 49.9**
 */

import { useEffect, useRef, useState } from 'react';
import type {
  CharacterAdjustment,
  CharacterDocument,
  DmAction,
  PlayerActionEvent,
  SessionMemberSummary,
} from '#shared/types/api';
import { DM_ACTION, SESSION_EVENT } from '#shared/types/api';
import type { LiveEvent } from '#shared/types/liveSocket';
import { applyEventToCharacter, EVENT_EFFECT } from '../../../services/liveEvents';
import { useLiveSession } from '../../play/shared/useLiveSession';
import { applyEventToMembers } from './membershipEvents';
import type { RosterReads } from './useCoalescedReads';
import { ROSTER_READ, useCoalescedReads } from './useCoalescedReads';

/** Which Event types are a DM's adjustment — the same set the fetched log is narrowed to */
const DM_ACTIONS: ReadonlySet<string> = new Set(Object.values(DM_ACTION));

/** Nothing has been seen about this character yet, and every reader gets the same empty list */
const NO_ADJUSTMENTS: CharacterAdjustment[] = [];

/** What the server last said the roster is made of */
export interface RosterListing {
  characters: CharacterDocument[];
  /** Who is at the table, in the order the server listed them — the DM first */
  members: SessionMemberSummary[];
}

/** What the roster reads */
export interface RosterFeed {
  /** Every character at the table, patched by what has happened since the last read */
  characters: CharacterDocument[];
  /** Who is at the table, patched by the membership Events seen since the last read */
  members: SessionMemberSummary[];
  /** The newest adjustment this browser has watched go past, per character id */
  latest: Record<string, CharacterAdjustment>;
}

/**
 * One character's adjustments as `useQuickActions` wants them
 *
 * At most one, for the reason the module note gives. A named function rather than an expression at
 * the call site so the empty case is one shared array — a fresh `[]` per row per render is a new
 * identity for every row of a six-player table.
 *
 * @param feed What the roster has seen
 * @param characterId Whose row
 * @returns The newest adjustment, or none
 */
export function adjustmentsFor(feed: RosterFeed, characterId: string): CharacterAdjustment[] {
  const seen = feed.latest[characterId];

  if (!seen) return NO_ADJUSTMENTS;

  return [seen];
}

/** An Event that was a DM's adjustment, and whose sheet it moved */
interface SeenAdjustment {
  characterId: string;
  adjustment: CharacterAdjustment;
}

/**
 * One Event as an adjustment, when that is what it is
 *
 * At module scope rather than inside the listener, so the branches are this function's rather than
 * the hook's — `rollFrom`'s shape one folder over.
 *
 * **`by` is resolved from the table's own member list**, never read out of the payload: the Event
 * carries an Account id, and a name written into it would be a copy a rename could make wrong. An
 * actor who is not at the table — the server itself, or somebody since removed — is honestly `null`,
 * which is the same thing the fetched log says about a profile it cannot find.
 *
 * @param event What happened at the table
 * @param nameOf How this roster spells an Account id
 * @returns The adjustment and whose it is, or `null` when the Event is not a DM's adjustment
 */
function adjustmentFrom(
  event: LiveEvent,
  nameOf: (accountId: string | null) => string | null
): SeenAdjustment | null {
  if (!DM_ACTIONS.has(event.type)) return null;

  const payload = event.payload as Partial<PlayerActionEvent> | null;

  if (!payload || typeof payload.characterId !== 'string') return null;

  const by = nameOf(event.actorAccountId);

  return {
    characterId: payload.characterId,
    adjustment: {
      id: event.id,
      seq: event.seq,
      action: event.type as DmAction,
      target: payload.target ?? '',
      before: payload.before ?? null,
      after: payload.after ?? null,
      at: event.at,
      by,
    },
  };
}

/** What one Event did to the roster's cached characters */
interface RosterPatch {
  characters: CharacterDocument[];
  /** Something on this roster now holds a new value */
  isApplied: boolean;
  /** Something on this roster changed in a way only a re-read can describe */
  isStale: boolean;
}

/**
 * Apply one Event across every character on the roster, in **one** pass
 *
 * One pass rather than two — a first draft asked the applier once to patch and again to decide
 * whether to re-read, which is twice the work and, worse, two places that could disagree about what
 * an Event meant.
 *
 * @param characters The list as it stands
 * @param event What happened
 * @returns The patched list and what it needs
 */
function applyAcross(characters: CharacterDocument[], event: LiveEvent): RosterPatch {
  let isApplied = false;
  let isStale = false;

  const next = characters.map((document) => {
    const outcome = applyEventToCharacter(document.character, event);

    if (outcome.effect === EVENT_EFFECT.STALE) {
      isStale = true;
      return document;
    }

    if (outcome.effect !== EVENT_EFFECT.APPLIED) return document;

    isApplied = true;

    // The document's stamp follows the Event's own instant, as the character's does — so a row and
    // the sheet behind it agree about when they last moved
    return { ...document, character: outcome.character, updatedAt: event.at };
  });

  return { characters: isApplied ? next : characters, isApplied, isStale };
}

/**
 * Keep the roster in step with the table
 *
 * @param sessionId Which table, or `null` when no row is open
 * @param fetched The listing as the server last returned it, both halves
 * @param reads How to read the roster's three halves again
 * @param nameOf How to spell an Account id, for an adjustment's `by`
 * @returns The patched characters, the patched member list, and the adjustments seen live
 */
export function useRosterFeed(
  sessionId: string | null,
  fetched: RosterListing,
  reads: RosterReads,
  nameOf: (accountId: string | null) => string | null
): RosterFeed {
  const [characters, setCharacters] = useState<CharacterDocument[]>(fetched.characters);
  const [members, setMembers] = useState<SessionMemberSummary[]>(fetched.members);
  const [latest, setLatest] = useState<Record<string, CharacterAdjustment>>({});

  // When to ask the server again is its own subject — see `useCoalescedReads`, split out here when
  // `fallow` measured this hook past the cognitive threshold
  const stale = useCoalescedReads(sessionId, reads);

  /** The current speller, so the listener never resolves a name through an old member list */
  const spell = useRef(nameOf);
  spell.current = nameOf;

  /**
   * The characters as of the last state write, not the last render
   *
   * **Two Events in one tick would otherwise cost the first one's patch**: the listener closes over
   * the render's `characters`, so the second would compute its patch from the pre-Event list and
   * overwrite. A functional `setState` would fix the write and leave the caller unable to read what
   * the Event did, which is what decides whether to re-read.
   */
  const held = useRef(characters);
  held.current = characters;

  /** …and the member list, held for the same reason: two Events in one tick share a starting point */
  const seated = useRef(members);
  seated.current = members;

  /*
   * **The server's answer replaces what is on screen, and the trailing read is what makes that
   * safe.** A read composed before an Event may land after it, so taking it wholesale would drop a
   * patch — which is precisely why an `applied` Event arriving during a read schedules another pass.
   * Each half keeps its identity between reads, so these fire once per answer rather than per render.
   */
  useEffect(() => {
    setCharacters(fetched.characters);
    held.current = fetched.characters;
  }, [fetched.characters]);

  useEffect(() => {
    setMembers(fetched.members);
    seated.current = fetched.members;
  }, [fetched.members]);

  useLiveSession(sessionId, (message) => {
    const event = message.event;

    const seen = adjustmentFrom(event, spell.current);

    if (seen !== null) {
      setLatest((current) => ({ ...current, [seen.characterId]: seen.adjustment }));
    }

    // The rules moved under every number on this surface — handled by name, because with no
    // characters yet there is nothing for the applier to be stale about
    if (event.type === SESSION_EVENT.SNAPSHOT_REFRESHED) {
      stale.schedule([ROSTER_READ.CHARACTERS, ROSTER_READ.RULES]);
      return;
    }

    // **Who is at the table, before what they are playing.** A membership Event is about neither a
    // character nor the rules, so the character pass below answers `elsewhere` for all four — which
    // is what keeps a join from refetching the party (v3 Req 44.7).
    const membership = applyEventToMembers(seated.current, event);

    if (membership.effect === EVENT_EFFECT.APPLIED) {
      seated.current = membership.members;
      setMembers(membership.members);
      stale.noteAppliedChange(ROSTER_READ.MEMBERS);
    }

    // The join, and only the join: its Event carries no name, so the list is read again — and the
    // **list alone**, because nothing else about the table changed
    if (membership.effect === EVENT_EFFECT.STALE) stale.schedule([ROSTER_READ.MEMBERS]);

    const patch = applyAcross(held.current, event);

    if (patch.isApplied) {
      held.current = patch.characters;
      setCharacters(patch.characters);
      stale.noteAppliedChange(ROSTER_READ.CHARACTERS);
    }

    if (patch.isStale) stale.schedule([ROSTER_READ.CHARACTERS]);
  });

  return { characters, members, latest };
}
