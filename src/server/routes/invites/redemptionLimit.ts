/**
 * How often one Account may try a code, and how often one code may be tried (TICKET-GAM-02)
 *
 * **A short human-typeable code and unlimited attempts is a guessable code, whatever its length** —
 * the ticket's own words, and the reason this exists beside a fifty-bit code rather than instead of
 * one. The length makes brute force expensive; the limiter is what makes it impossible to pay for.
 *
 * **Two buckets, because there are two attacks.** Per **Account** stops one signed-in caller walking
 * the space; per **code** stops a pool of accounts converging on one table's invitation. Neither
 * alone is enough: the first is bypassed by signing up twice, and the second would let one account
 * hunt for *any* valid code by never trying the same one twice.
 *
 * **In memory, with the same stated limit `signInRateLimit` has** — one process, one SQLite file
 * (*Not in this milestone*). A second process would count separately, and the alternative is a write
 * on the failure path of a route an attacker controls the rate of, which is an amplifier rather than
 * a defence.
 *
 * **Only failures count**, so the person who mistypes once and then gets it right carries nothing.
 * A successful redemption clears the Account, because they are at the table now and have no further
 * reason to be counted.
 *
 * **No environment variable, deliberately.** `signInRateLimit` takes its numbers from `env.ts`
 * because an operator plausibly tunes a password limiter for their own users. Nobody tunes how fast
 * an invitation may be guessed; a constant is one less thing to document, one less thing to set
 * wrong, and one less variable `.env.example` has to keep in step.
 *
 * **Validates: v3 Req 38.1**
 */

/** How many failed attempts one bucket may spend before it is refused */
const MAX_ATTEMPTS = 10;

/** How long a bucket's window lasts, in milliseconds */
const WINDOW_MS = 60_000;

/** What one bucket has done lately */
interface Attempts {
  count: number;
  /** When the window this count belongs to began, in epoch milliseconds */
  windowStartedAt: number;
}

/**
 * Every bucket with a failure against it
 *
 * One map rather than two, keyed by kind — `account:…` and `code:…` cannot collide, and two maps
 * would be two things to clear between tests and two places to get the window wrong.
 */
const attempts = new Map<string, Attempts>();

/**
 * How many entries may pile up before expired ones are swept
 *
 * **A `code:` key is a string the caller chose**, and a failed guess is a key nothing will ever ask
 * about again — so entries are never cleaned up on the read path the way `signInRateLimit`'s are,
 * because that one keys on email addresses, which repeat. Ten a minute per account, in a process
 * that runs for months, is a leak with no ceiling (the GAM-02 review).
 *
 * Swept on **write** rather than on a timer: a timer is a thing to start, stop and remember in
 * tests, and the only moment this map grows is a write.
 */
const SWEEP_ABOVE = 1_000;

/** What a caller is counted under */
function keysFor(accountId: string, code: string): string[] {
  return [`account:${accountId}`, `code:${code}`];
}

/**
 * Drop every entry whose window has passed
 *
 * @param now Epoch milliseconds
 */
function sweep(now: number): void {
  for (const [key, record] of attempts) {
    if (now - record.windowStartedAt >= WINDOW_MS) attempts.delete(key);
  }
}

/** Whether one bucket has spent its attempts, cleaning up an expired window on the way past */
function isSpent(key: string, now: number): boolean {
  const record = attempts.get(key);
  if (!record) return false;

  if (now - record.windowStartedAt >= WINDOW_MS) {
    attempts.delete(key);
    return false;
  }

  return record.count >= MAX_ATTEMPTS;
}

/**
 * Whether this attempt should be refused without the code being looked up
 *
 * @param accountId Who is trying
 * @param code The **normalised** code they are trying
 * @param now Epoch milliseconds; passed in so a test is not a race
 * @returns True when either bucket is spent
 */
export function isRedemptionLimited(
  accountId: string,
  code: string,
  now: number = Date.now()
): boolean {
  return keysFor(accountId, code).some((key) => isSpent(key, now));
}

/**
 * Count one failed redemption against both buckets
 *
 * @param accountId Who tried
 * @param code The **normalised** code they tried
 * @param now Epoch milliseconds
 */
export function recordRedemptionFailure(
  accountId: string,
  code: string,
  now: number = Date.now()
): void {
  if (attempts.size > SWEEP_ABOVE) sweep(now);

  for (const key of keysFor(accountId, code)) {
    const record = attempts.get(key);

    // A fixed window rather than a sliding one, for `signInRateLimit`'s reason: it is the cheapest
    // thing that satisfies the requirement and the easiest to explain to the person refused
    if (!record || now - record.windowStartedAt >= WINDOW_MS) {
      attempts.set(key, { count: 1, windowStartedAt: now });
      continue;
    }

    record.count += 1;
  }
}

/**
 * Forget an Account, because they just got in
 *
 * **The Account only, never the code.** They have no further reason to be counted; the code does —
 * one successful redemption says nothing about the hundred failures around it, and clearing the
 * code's bucket would let an attacker reset it by redeeming a code they legitimately hold.
 *
 * @param accountId The Account that joined
 */
export function clearRedemptionFailures(accountId: string): void {
  attempts.delete(`account:${accountId}`);
}

/**
 * Forget everything
 *
 * Module state, so a test that fills it would otherwise leak into the next one — the same reason
 * `resetSignInFailures` exists. For tests, and called by nothing else.
 */
export function resetRedemptionFailures(): void {
  attempts.clear();
}
