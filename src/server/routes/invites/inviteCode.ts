/**
 * A code a DM reads aloud on a Friday night (TICKET-GAM-02)
 *
 * Three properties, and they pull against each other — which is the whole content of this module:
 *
 * - **Unguessable.** `crypto.getRandomValues`, never `Math.random`, and enough of it that the
 *   redemption limiter is a second lock rather than the only one.
 * - **Sayable.** It gets read across a table and typed by somebody who has had a beer, so the
 *   alphabet has no character that can be mistaken for another one.
 * - **Forgiving.** What is typed back is normalised before it is compared, because the person who
 *   hears "oh" and types `O` has not made a mistake worth a failure.
 *
 * **The alphabet is Crockford's Base32** rather than one invented here: `0-9A-Z` without `I`, `L`,
 * `O` and `U`. The first three go because they are the lookalikes; `U` goes because dropping it is
 * what keeps a random code from spelling something unfortunate. Crockford also defines the decoding
 * this module needs — `I` and `L` read as `1`, `O` reads as `0` — so *"the letter O"* and *"zero"*
 * are the same code and neither party has to know which was meant.
 *
 * **Ten characters is 32^10, or fifty bits.** At the ten-attempts-a-minute the redemption limiter
 * allows, exhausting a thousandth of that space takes longer than the invite's fourteen-day life by
 * a factor with eleven digits in it. The bound that matters is the limiter; the length is what makes
 * the limiter's job possible.
 *
 * **Validates: v3 Req 38.1, 38.2**
 */

/** Crockford's Base32 alphabet — `0-9A-Z` less `I`, `L`, `O`, `U` */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** How many characters a code carries */
const CODE_LENGTH = 10;

/** Where the hyphen goes, so a ten-character string is read as two short ones */
const GROUP_SIZE = 5;

/**
 * What a typed character means
 *
 * Crockford's decoding, and the reason the module is forgiving rather than merely careful: somebody
 * hearing a code aloud cannot tell `0` from `O`, and refusing them would be punishing them for the
 * alphabet's problem rather than their own.
 */
const CONFUSIONS: Record<string, string> = { O: '0', I: '1', L: '1' };

/**
 * A fresh invite code
 *
 * **Rejection-free by construction**: 32 divides 256, so taking each random byte modulo 32 is
 * uniform. An alphabet whose length did not divide 256 would need the bias thrown away rather than
 * ignored, which is the bug this note exists to stop somebody introducing by "simplifying" the
 * alphabet later.
 *
 * @returns Ten characters, hyphenated in the middle — `A1B2C-3D4E5`
 */
export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));

  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

/**
 * A stored code as a human reads it
 *
 * **Storage and display are different jobs**, which is why this is a function rather than a hyphen
 * baked into what is generated. The column holds the normal form so a lookup is one comparison; a
 * DM reading a code aloud wants two short groups instead of ten characters they will lose their
 * place in.
 *
 * @param code The stored, normalised code
 * @returns The same code hyphenated in the middle — `A1B2C-3D4E5`
 */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, GROUP_SIZE)}-${code.slice(GROUP_SIZE)}`;
}

/**
 * What a typed code means, ready to compare against a stored one
 *
 * Upper-cases, drops everything that is not a letter or a digit — so the hyphen, a stray space and a
 * pasted trailing newline all vanish — and applies {@link CONFUSIONS}. Stored codes are normalised
 * through the same function, so the comparison is between two normal forms rather than between a
 * normal form and whatever a database happens to hold.
 *
 * @param typed Whatever arrived, from a link or from a keyboard
 * @returns The comparable form; an empty string when there was nothing usable in it
 */
export function normalizeInviteCode(typed: string): string {
  return [...typed.toUpperCase().replace(/[^0-9A-Z]/g, '')]
    .map((character) => CONFUSIONS[character] ?? character)
    .join('');
}
