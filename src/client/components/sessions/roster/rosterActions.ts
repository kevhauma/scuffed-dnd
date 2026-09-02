/**
 * The three things a roster row can ask for, and the question each one asks first (TICKET-DM-04)
 *
 * Carried over whole from TICKET-GAM-04's lobby, wording included, when the roster replaced it. In a
 * module of its own rather than beside either component because both need it — `MemberGroup` raises
 * the question and `SessionRoster` asks it — and a const object imported across a component boundary
 * is the house rule for a closed set of strings.
 *
 * **All three confirm**, through `ui/Dialog` like every other confirm in the app. Each is hard to undo
 * from here: a player who leaves needs a fresh invitation, a removed player likewise, and a DM who
 * hands the game over cannot hand it back. What none of them destroys is a Character — the sentence
 * says so, because *removed* reads like *deleted* and here it is not (v3 Req 39.3).
 *
 * **Validates: v3 Req 39.3, 39.4, 39.5**
 */

/** The three things a row can ask for, each of which is worth a question first */
export const LOBBY_ACTION = {
  LEAVE: 'leave',
  REMOVE: 'remove',
  TRANSFER: 'transfer',
} as const;

/** One of the three */
export type LobbyAction = (typeof LOBBY_ACTION)[keyof typeof LOBBY_ACTION];

/** What is waiting on an answer */
export interface PendingAction {
  action: LobbyAction;
  accountId: string;
  /** Whose seat, by name — so the question can say who it is about */
  name: string;
}

/**
 * The question each action asks, and what the button that does it is called
 *
 * A table rather than three conditionals: the wording and the verb are one decision per action, and
 * the *nothing is deleted* clause has to appear in two of them — which is exactly the sort of thing
 * that goes missing from one when they are written apart.
 */
export const CONFIRMATION: Record<
  LobbyAction,
  { title: string; body: (name: string) => string; verb: string }
> = {
  [LOBBY_ACTION.LEAVE]: {
    title: 'Leave this game?',
    body: () =>
      'Your characters stay at the table for the others to read, and you will need a new ' +
      'invitation to come back. Nothing is deleted.',
    verb: 'Leave',
  },
  [LOBBY_ACTION.REMOVE]: {
    title: 'Remove this player?',
    body: (name) =>
      `${name} loses access to this game. Their characters stay at the table — everybody can ` +
      'read them and nobody can change them, including you. Nothing is deleted.',
    verb: 'Remove them',
  },
  [LOBBY_ACTION.TRANSFER]: {
    title: 'Hand this game over?',
    body: (name) =>
      `${name} becomes the one who runs it, and you become a player at your own table. Only ` +
      'they can hand it back.',
    verb: 'Hand it over',
  },
};
