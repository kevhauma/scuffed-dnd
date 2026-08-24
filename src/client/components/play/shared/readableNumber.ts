/**
 * Readable Numbers
 *
 * How a derived number is written on a play surface.
 *
 * Two decimals, because a weighted term is a product of a stat and a weight like 0.2, and binary
 * floating point makes `7 × 0.2` render as `1.4000000000000001` — which reads as a bug in the app
 * rather than a fact about the ruleset. Rounded **here, at the display edge, and nowhere earlier**:
 * the calculator's terms have to keep summing to the level exactly (TICKET-SKL-03).
 *
 * Extracted from `SkillBreakdownRow` when `CountRow` needed the same two functions — two copies of
 * "how many decimals does this app show" is exactly the drift that makes one surface disagree with
 * another about the same number.
 */

/** A number as the Player should read it */
export function readable(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** A contribution with an explicit sign, so `+2` and `-2` are never ambiguous */
export function signed(value: number): string {
  return value > 0 ? `+${readable(value)}` : readable(value);
}
