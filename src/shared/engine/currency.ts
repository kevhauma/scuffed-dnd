/**
 * Currency Engine
 *
 * Conversion between the User's currency tiers, and the one definition of how money is displayed.
 * Pure — no React, no storage.
 *
 * A `CurrencyTier` is `{ order, conversionToNext }` where `order: 0` is the lowest-value tier and
 * `conversionToNext` is how many of *this* tier make one of the next one up. Converting up divides
 * by each rate along the way; converting down multiplies.
 *
 * Money is a plain `number`, so repeated conversion accumulates floating-point error. Display
 * rounds; comparisons in tests use a tolerance. Exact decimal arithmetic is out of scope for v1.0.
 *
 * **Validates: Requirements 10.4, 10.5**
 */

import type { CurrencyTier, CurrencyValue } from '../types/config';

/**
 * Tiers sorted lowest-value first
 *
 * `order` is authoritative but nothing guarantees the stored array is in that order, so every
 * function here sorts rather than trusting the input.
 */
function byOrder(tiers: CurrencyTier[]): CurrencyTier[] {
  return [...tiers].sort((a, b) => a.order - b.order);
}

/**
 * A tier's conversion rate, refusing rates that would produce `Infinity` or `NaN`
 *
 * A zero or negative rate is a misconfiguration; treating it as 1 keeps the arithmetic finite and
 * leaves the amount unchanged across that step, so a broken rate degrades to "no conversion here"
 * instead of poisoning every number downstream. `validateConfiguration` is where the User is told.
 */
function rateOf(tier: CurrencyTier): number {
  return tier.conversionToNext > 0 ? tier.conversionToNext : 1;
}

/**
 * The tiers whose rates sit between two points on the ladder
 *
 * Direction-independent: a rate belongs to the gap above its own tier, so the rungs crossed
 * between two tiers are the same set whichever way you walk them.
 */
function rungsBetween(sorted: CurrencyTier[], a: CurrencyTier, b: CurrencyTier): CurrencyTier[] {
  const low = Math.min(a.order, b.order);
  const high = Math.max(a.order, b.order);

  return sorted.filter((tier) => tier.order >= low && tier.order < high);
}

/**
 * Convert an amount from one tier to another
 *
 * Going up divides by each rate crossed, going down multiplies by the same ones — the only
 * difference between the two directions is the operator.
 *
 * @param value - The amount and the tier it is currently expressed in
 * @param toTierId - The tier to express it in
 * @param tiers - Every configured tier
 * @returns The amount in `toTierId`, or the value unchanged when either tier is unknown
 */
export function convertCurrency(
  value: CurrencyValue,
  toTierId: string,
  tiers: CurrencyTier[]
): CurrencyValue {
  if (value.tierId === toTierId) return { ...value };

  const sorted = byOrder(tiers);
  const from = sorted.find((tier) => tier.id === value.tierId);
  const to = sorted.find((tier) => tier.id === toTierId);

  // An unknown tier has no rate to convert by; returning the value untouched keeps a deleted tier
  // from turning every price into NaN
  if (!from || !to) return { ...value };

  const goingUp = to.order > from.order;

  const amount = rungsBetween(sorted, from, to).reduce(
    (running, tier) => (goingUp ? running / rateOf(tier) : running * rateOf(tier)),
    value.amount
  );

  return { tierId: toTierId, amount };
}

/**
 * Express a value in the tier that reads most naturally
 *
 * "Appropriate" (Requirement 10.4) is defined here as **the highest tier in which the amount is
 * still at least 1** — 1400 copper becomes 1.4 gold rather than staying 1400. A value too small
 * for even the lowest tier stays in the lowest tier rather than vanishing upward.
 *
 * @param value - The amount and its stored tier
 * @param tiers - Every configured tier
 * @returns The same worth, in the tier it is best read in
 */
export function normalizeCurrency(value: CurrencyValue, tiers: CurrencyTier[]): CurrencyValue {
  const sorted = byOrder(tiers);
  if (sorted.length === 0) return { ...value };
  if (!sorted.some((tier) => tier.id === value.tierId)) return { ...value };

  let best = convertCurrency(value, sorted[0].id, tiers);

  // Walk upward while the amount still reads as at least one whole unit
  for (const tier of sorted) {
    const converted = convertCurrency(value, tier.id, tiers);
    if (Math.abs(converted.amount) >= 1) {
      best = converted;
    }
  }

  return best;
}

/**
 * The tier a purse is measured in (TICKET-CUR-02)
 *
 * The **lowest** — `order: 0` is the least valuable, and it is the only tier every amount can be
 * expressed in without a fraction the ruleset never authored. A `Character.purse` is one number in
 * this tier and nothing else; what a Player is *shown* is {@link formatPurse}'s answer, which is a
 * display choice and re-asked every render.
 *
 * @param tiers Every configured tier
 * @returns The base tier, or `null` for a ruleset that defines no currency
 */
export function baseTier(tiers: CurrencyTier[]): CurrencyTier | null {
  return byOrder(tiers)[0] ?? null;
}

/**
 * A purse as text, in the tier it reads most naturally in (v3 Req 43.2)
 *
 * **The stored number never changes when the ruleset's rates do** — this is the whole reason a
 * purse is one amount in the base tier: retuning gold-to-silver re-renders every purse in the game
 * and rewrites none of them.
 *
 * A ruleset that defines **no currency at all** gets the bare number. That is deliberate rather
 * than a fallback: a ruleset may define no currency as it may define no races, and refusing to show
 * a Player their own money because the ruleset has no name for it would be the wrong way round.
 *
 * @param purse What the character carries, in the base tier
 * @param tiers Every configured tier
 * @returns e.g. `"1.4 Gold"`, or the amount alone when there are no tiers
 */
export function formatPurse(purse: number, tiers: CurrencyTier[]): string {
  const base = baseTier(tiers);
  if (!base) return String(Number(purse.toFixed(2)));

  return formatCurrency(normalizeCurrency({ tierId: base.id, amount: purse }, tiers), tiers);
}

/**
 * Render a value as text, in the tier it is given in
 *
 * Trailing zeros are dropped so a whole number reads as `5 Gold`, not `5.00 Gold`.
 *
 * @param value - The amount and its tier
 * @param tiers - Every configured tier, for the tier's name
 * @returns e.g. `"1.4 Gold"`, falling back to the bare amount when the tier is unknown
 */
export function formatCurrency(value: CurrencyValue, tiers: CurrencyTier[]): string {
  const tier = tiers.find((candidate) => candidate.id === value.tierId);
  const amount = Number(value.amount.toFixed(2));

  return tier ? `${amount} ${tier.name}` : String(amount);
}
