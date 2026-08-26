/**
 * A moment somebody can read, in their own locale (TICKET-GAM-03)
 *
 * **Extracted on the third copy, not the second.** `InviteCodePanel`'s `expiresOn` and
 * `SessionList`'s `startedOn` were the same four lines under two names, and the house rule is to
 * leave a pair alone; GAM-03's `PendingInvitations` would have been the third, which is where it
 * flips.
 *
 * **The name is about the value, not the occasion.** `expiresOn` and `startedOn` are three
 * different functions by their names and one by their bodies, which is precisely how a pair drifts
 * into two formats for one kind of thing. There is exactly one way this app writes a moment down.
 *
 * **Formatting is the browser's locale, never ours.** Every timestamp on the wire is epoch
 * milliseconds (`db/schema.ts`'s rule), and what a reader in Ghent expects to see is not what a
 * reader in Chicago does.
 */

/**
 * A stored timestamp as a sentence fragment
 *
 * @param epochMs Epoch milliseconds, as every column and every wire field holds one
 * @returns The date and time in the reader's own locale
 */
export function readableMoment(epochMs: number): string {
  return new Date(epochMs).toLocaleString();
}
