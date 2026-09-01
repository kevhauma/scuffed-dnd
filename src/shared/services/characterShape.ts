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

import type { Character } from '../types/character';

/**
 * Whether a stored record is a character this build can read
 *
 * A character written before TICKET-STAT-01 has no `investedStatPoints` at all, and every read of
 * it would be a crash rather than a number. `experience` joined the check with TICKET-RES-01 and
 * is the one whose absence is *quiet* rather than loud: `lookupCurve(curve, undefined)` falls
 * through every range check and returns the first row — a confident **level 1** — and an award
 * computes `undefined + n` and persists `NaN`.
 *
 * **`inventory.composedItems` joined it with TICKET-INV-05**, which is v4.0's clean break reaching
 * the roster: a character written before composed items has an `equippedItems` full of *template*
 * ids, and reading one as a build's id equips nothing while looking like an ordinary empty sheet.
 * Refusing here is what routes such a roster to `IncompatibleDataNotice` — a backup and a fresh
 * start — instead of quietly stripping every Player's gear
 * ([D6](../../../docs/v4.0_sheet_parity/overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)).
 *
 * Checked here rather than left to the schemaVersion gate because that gate reads the
 * *Configuration*: a characters key beside a fresh or absent config never meets it
 * (TICKET-IO-03 implementation note 5).
 *
 * **This gate is why no conversion code survives the milestone** (TICKET-DX-09). A character old
 * enough to carry a retired key — CUR-02's per-tier `wallet` was the last one anything adapted —
 * predates `inventory.composedItems` and is refused here, so an adapter for it could never run.
 * The clean break is the whole compatibility story; nothing rewrites an old record on the way in.
 *
 * @param character The record as it was stored
 * @returns Whether every field a reader depends on is there
 */
export function isReadableCharacter(character: Character | null | undefined): boolean {
  return (
    character?.investedStatPoints !== undefined &&
    character?.currentResourceValues !== undefined &&
    Number.isFinite(character?.experience) &&
    Array.isArray(character?.inventory?.composedItems)
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

/** A plain list of ids — what `raceIds` is */
function isIdList(value: unknown): boolean {
  return Array.isArray(value) && value.every((id: unknown) => typeof id === 'string');
}

/** A required identity — the two fields a build cannot be resolved without */
function isIdentity(value: unknown): boolean {
  return typeof value === 'string' && value !== '';
}

/**
 * One optional link to a part: the family it names, and the rung of that family
 *
 * The material half and the inlay half of a build read identically — an id and a number, both
 * optional, both meaningless alone — so they are asked the same question rather than spelled out
 * twice. A rung that is not a finite number is refused because `materialTierOf` compares it against
 * `MaterialLevel.level`, where a `null` would silently match nothing while looking like a build the
 * Player made.
 */
function isPartReference(id: unknown, rung: unknown): boolean {
  const named = id === undefined || typeof id === 'string';
  const numbered = rung === undefined || (typeof rung === 'number' && Number.isFinite(rung));

  return named && numbered;
}

/**
 * One built thing, as a request body has it (v4 systems/12, TICKET-INV-05)
 *
 * Every field a reader dereferences, and no more. The **id and the template are required** because
 * the two are what the rest of the inventory and the engine resolve through — a record with neither
 * is a row nothing can equip, drop or price. The **material and inlay links are optional in pairs**,
 * matching `ComposedItem` — see {@link isPartReference}.
 *
 * Whether the ids name anything *this ruleset has* is not asked here, for `uploadedCharacterErrors`'
 * standing reason: a stale part contributes nothing rather than crashing, and the ruleset a
 * character is read against is not the one it was written against.
 */
function isComposedItem(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;

  return (
    isIdentity(record.id) &&
    isIdentity(record.templateId) &&
    isPartReference(record.materialId, record.materialLevel) &&
    isPartReference(record.inlayId, record.inlayLevel)
  );
}

/**
 * The inventory's two collections: what was built, and which of those are worn
 *
 * **`miscItems` left with TICKET-INV-06**, which made the Backpack a derivation (`backpackOf`) rather
 * than a stored list. A body still carrying one is not refused — it is a field nothing reads, the way
 * every other unknown key is — and the builds it named are in `composedItems` either way, so such a
 * character opens with everything it was carrying in the bag.
 */
const INVENTORY_FIELDS: Record<string, { accepts: (value: unknown) => boolean; rule: string }> = {
  equippedItems: { accepts: isIdMap, rule: 'must be an object keyed by equipment slot type' },
  composedItems: {
    accepts: (value) => Array.isArray(value) && value.every(isComposedItem),
    rule: 'must be an array of { id, templateId, materialId?, materialLevel?, inlayId?, inlayLevel? } records',
  },
};

/** The inventory: what was built, and what is equipped, keyed by slot type */
function inventoryErrors(value: unknown, path: string): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`${path} must be an { equippedItems, composedItems } object`];
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
 * `Character`, so a character that has neither is not an old character but an ordinary one: no
 * archetype picked, no money carried. Requiring either would refuse a roster that is entirely
 * current.
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
