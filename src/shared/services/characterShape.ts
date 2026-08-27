/**
 * What a stored Character has to look like to be read at all (TICKET-IO-04)
 *
 * **A rule both roots need, so it lives in the Kernel.** The browser has asked "can this build read
 * this character?" since CR-05 — `loadCharacters` refuses a roster rather than silently dropping
 * the records it does not understand — and TICKET-IO-04's upload asks the *server* the same question
 * about the same records. Two answers to one question is how a browser that refuses to load a
 * character and a server that happily stores it end up in the same app.
 *
 * {@link isReadableCharacter} moved here verbatim from `client/services/storage.ts`, which now
 * imports it. Nothing about the browser's refusal changed; it simply stopped being the only place
 * that knows the rule.
 *
 * **Two predicates, and which one to reach for depends on who wrote the bytes.**
 * {@link isReadableCharacter} guards data *this app* put in LocalStorage, so it only has to catch a
 * record from an older build; {@link uploadedCharacterErrors} guards a **request body**, where
 * nothing is known, and checks every field a reader dereferences. The IO-04 review is why they
 * differ at all: the second one started as a wrapper around the first, and `!== undefined` accepts
 * `null` and accepts a number — a `Character` stored with either is a `TypeError` for whichever
 * surface reads it, the server's own re-derivation included.
 *
 * **Neither is `validateConfigurationShape`'s counterpart.** A `Configuration` is authored data with
 * fourteen entity kinds and a spec per collection; a Character is a handful of maps of player state.
 * TICKET-CHAR-04 owns what a character created *against a Snapshot* must satisfy, which is a
 * question about a ruleset rather than about a shape.
 *
 * **Validates: v3 Req 36.5**
 */

import { baseTier, convertCurrency } from '../engine/currency';
import type { Character } from '../types/character';
import type { CurrencyTier } from '../types/config';

/**
 * Whether a stored record is a character this build can read
 *
 * A character written before TICKET-STAT-01 has no `investedStatPoints` at all, and every read of
 * it would be a crash rather than a number. `experience` joined the check with TICKET-RES-01 and
 * is the one whose absence is *quiet* rather than loud: `lookupCurve(curve, undefined)` falls
 * through every range check and returns the first row — a confident **level 1** — and an award
 * computes `undefined + n` and persists `NaN`.
 *
 * Checked here rather than left to the schemaVersion gate because that gate reads the
 * *Configuration*: a characters key beside a fresh or absent config never meets it
 * (TICKET-IO-03 implementation note 5).
 *
 * @param character The record as it was stored
 * @returns Whether every field a reader depends on is there
 */
export function isReadableCharacter(character: Character | null | undefined): boolean {
  return (
    character?.investedStatPoints !== undefined &&
    character?.currentResourceValues !== undefined &&
    Number.isFinite(character?.experience)
  );
}

/** A record of finite numbers keyed by entity id — how every allocation on a character is stored */
function isNumberMap(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  return Object.values(value as Record<string, unknown>).every(
    (entry) => typeof entry === 'number' && Number.isFinite(entry)
  );
}

/** A record of ids keyed by something — what `equippedItems` is, keyed by equipment slot type */
function isIdMap(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  return Object.values(value as Record<string, unknown>).every((id) => typeof id === 'string');
}

/** A plain list of ids — what `miscItems` and `raceIds` are */
function isIdList(value: unknown): boolean {
  return Array.isArray(value) && value.every((id: unknown) => typeof id === 'string');
}

/** The inventory's two halves: what is equipped, and what is merely carried */
const INVENTORY_FIELDS: Record<string, { accepts: (value: unknown) => boolean; rule: string }> = {
  equippedItems: { accepts: isIdMap, rule: 'must be an object keyed by equipment slot type' },
  miscItems: { accepts: isIdList, rule: 'must be an array of item ids' },
};

/** The inventory: what is equipped, keyed by slot type, and what is merely carried */
function inventoryErrors(value: unknown, path: string): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`${path} must be an { equippedItems, miscItems } object`];
  }

  const inventory = value as Record<string, unknown>;

  return Object.entries(INVENTORY_FIELDS)
    .filter(([field, { accepts }]) => !accepts(inventory[field]))
    .map(([field, { rule }]) => `${path}.${field} ${rule}`);
}

/**
 * Every field on a Character, and what it has to be
 *
 * Declared as a table for the reason `validateConfigurationShape`'s `ENTITY_SPECS` is one entity
 * kind up: a checker written as prose is a checker somebody forgets to extend, and four collections
 * on a `Configuration` went unchecked for a milestone exactly that way (CR-03, CR-22).
 *
 * `archetypeId` and `purse` are absent from the table deliberately — both are **optional** on
 * `Character` and a stored roster predating either must not become unreadable for want of a field
 * that did not exist when it was written.
 */
const CHARACTER_FIELDS: Record<string, (value: unknown) => boolean> = {
  id: (value) => typeof value === 'string' && value !== '',
  name: (value) => typeof value === 'string' && value !== '',
  configurationId: (value) => typeof value === 'string' && value !== '',
  raceIds: isIdList,
  investedStatPoints: isNumberMap,
  investedSkillPoints: isNumberMap,
  currentResourceValues: isNumberMap,
  experience: (value) => typeof value === 'number' && Number.isFinite(value),
  createdAt: (value) => typeof value === 'string',
  updatedAt: (value) => typeof value === 'string',
};

/** What each field must be, in the words a User reads */
const CHARACTER_FIELD_RULES: Record<string, string> = {
  id: 'must be a non-empty string',
  name: 'must be a non-empty string',
  configurationId: 'must be a non-empty string',
  raceIds: 'must be an array of race ids',
  investedStatPoints: 'must be an object of finite numbers keyed by stat id',
  investedSkillPoints: 'must be an object of finite numbers keyed by skill id',
  currentResourceValues: 'must be an object of finite numbers keyed by stat id',
  experience: 'must be a finite number',
  createdAt: 'must be a string',
  updatedAt: 'must be a string',
};

/**
 * What is wrong with a character a client asked the server to store (v3 Req 36.5)
 *
 * **Stricter than {@link isReadableCharacter}, and the difference is which side wrote the bytes.**
 * That predicate guards data *this app* put in LocalStorage, so it only has to catch a record from
 * an older build; this one guards a **request body**, where nothing about the shape is known. The
 * review that caught the gap put it plainly: `investedStatPoints !== undefined` accepts `null` and
 * accepts a number, and a `Character` stored with either is a `TypeError` for whichever surface
 * reads it first — including the server's own re-derivation (D5), since `calculateCharacter` walks
 * `inventory.equippedItems` and `raceIds` without guarding them.
 *
 * So every field a reader dereferences is checked, and `archetypeId` and `purse` — the two the type
 * marks optional — are not.
 *
 * **Nothing derived is checked, because nothing derived is accepted.** A level, a stat value and a
 * point budget are all re-derived at read time on whichever side is asking, so a request body
 * carrying one is carrying a field the server never looks at.
 *
 * @param candidate Whatever arrived in the request body's `characters` array
 * @param path Where it sits, for the message — `characters[2]`
 * @returns One error per problem, empty when the record can be stored
 */
export function uploadedCharacterErrors(candidate: unknown, path: string): string[] {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return [`${path} must be an object`];
  }

  const record = candidate as Record<string, unknown>;

  return [
    ...Object.entries(CHARACTER_FIELDS)
      .filter(([field, accepts]) => !accepts(record[field]))
      .map(([field]) => `${path}.${field} ${CHARACTER_FIELD_RULES[field]}`),
    ...inventoryErrors(record.inventory, `${path}.inventory`),
  ];
}

/**
 * A character whose retired per-tier wallet has become a base-tier purse (TICKET-CUR-02)
 *
 * **In the Kernel, not in the store, and that is the review's correction rather than a preference.**
 * It is a pure `(character, tiers) → character` rule over a *document*, and the server holds
 * character documents that can carry a `wallet` — TICKET-IO-04 uploads a browser roster verbatim, so
 * one written before this ticket keeps its wallet until something converts it. A rule the server
 * cannot call is a rule that will be written twice (D5).
 *
 * `convertCurrency` walks the rates: a second implementation of *how many coppers is a gold* here is
 * exactly the drift the engine exists to prevent. The holdings are summed in the **base** tier
 * because that is where all of them are expressible without inventing a fraction.
 *
 * **`null` means leave the character exactly as it is**, which covers one that never had a wallet,
 * one whose wallet is empty, and a ruleset with no tiers to convert by — guessing at a rate would
 * invent money. The retired key is dropped whenever a wallet *was* read, so the conversion runs at
 * most once per character.
 *
 * **An entry the ruleset cannot price is dropped rather than added.** `convertCurrency` returns a
 * value *unchanged* when either tier is unknown, which is right for its own contract and wrong as a
 * summand: a stored `{ gold: 3 }` whose tier the User has since deleted would contribute 3 rather
 * than 300 — silently, and in the direction that loses money. The same filter refuses an amount that
 * is not a finite number, which `isReadableCharacter` deliberately never checked for this field.
 *
 * @param character The stored character, which may still carry a `wallet`
 * @param tiers The ruleset's currency tiers
 * @returns The converted character, or `null` when there is nothing to convert
 */
export function purseFromStoredWallet(
  character: Character,
  tiers: CurrencyTier[]
): Character | null {
  // The retired shape, read off the stored object rather than off the type — which no longer has it
  const wallet = (character as { wallet?: Record<string, number> }).wallet;
  const base = baseTier(tiers);

  if (!wallet || !base) return null;

  const total = Object.entries(wallet)
    .filter(
      ([tierId, amount]) =>
        Number.isFinite(amount) && tiers.some((candidate) => candidate.id === tierId)
    )
    .reduce(
      (running, [tierId, amount]) =>
        running + convertCurrency({ tierId, amount }, base.id, tiers).amount,
      character.purse ?? 0
    );

  const { wallet: _retired, ...rest } = character as Character & { wallet?: unknown };

  return { ...rest, ...(total > 0 ? { purse: total } : {}) };
}
