/**
 * Character Store
 *
 * Zustand store for managing player character data.
 * Implements character CRUD operations, inventory management, and stat updates
 * with auto-save to LocalStorage.
 *
 * **Validates: Requirements 11.1, 12.2, 12.3, 12.5, 12.6, 14.2, 14.3, 14.4, 14.5, 17.2, 17.4**
 */

import { create } from 'zustand';
import { MAX_RACE_COUNT } from '#shared/engine/calculators/statCalculator';
import { validateStatAllocation } from '#shared/engine/skillAllocation';
import { buildCharacter } from '#shared/services/characterCreation';
import { purseFromStoredWallet } from '#shared/services/characterShape';
// The experience rules **moved** here from this module with TICKET-DM-01, rather than being copied
// into a DM route — the same thing PLY-01 did to the sheet's other writes, and for the same reason
import { addExperience, removeExperience, setDreamLevel } from '#shared/services/dmActions';
// `addToPack` and `removeFromPack` are deliberately absent: the browser's pack has never had a rule
// to share — its picker is built from the ruleset's item list — and the *server* is the side that
// has to check, because a request is not a picker. See `addMiscItem` below.
import {
  adjustPurseBy,
  adjustResourceValue,
  emptySlot,
  equipToSlot,
  investInSkill,
  investInStat,
  isRefusal,
  moveItemToEquipment,
  moveItemToMisc,
  type PlayerActionResult,
  resetResourceToMax,
  setPurseAmount,
  setResourceValue,
} from '#shared/services/playerActions';
import type {
  DmAction,
  DreamLevelRequest,
  ExperienceRequest,
  GrantRequest,
  LevelRequest,
  PlayerAction,
  ResourceValueRequest,
  SheetAction,
} from '#shared/types/api';
import { DM_ACTION, PLAYER_ACTION } from '#shared/types/api';
import type { Character, CharacterCreationData, Inventory } from '#shared/types/character';
import type { Configuration, CurrencyTier } from '#shared/types/config';
import {
  ACTION_OUTCOME,
  CREATION_OUTCOME,
  createSessionCharacter,
  fetchCharacter,
  sendPlayerAction,
} from '../services/characterSync';
import { RULESET_HOME, type RulesetSource } from '../services/rulesetSync';
import { loadCharacters, saveCharacters } from '../services/storage';
import { useUIStore } from './uiStore';

/**
 * What {@link CharacterState.updateCharacter} may patch (CR-12)
 *
 * The three fields of a character that are plain content: what they are called, what they are, and
 * how they grow. Everything else on `Character` is either an invariant somebody else enforces
 * (`experience`, `investedStatPoints`, `currentResourceValues`, `inventory`) or identity nothing
 * may rewrite (`id`, `configurationId`, `createdAt`, `updatedAt`). Widening this type is how a
 * future feature says it needs a new patchable field — and the place to ask whether that field
 * wants a guarded action of its own instead.
 *
 * Module-local: callers pass object literals and TypeScript infers, so exporting it would be
 * supported API nothing consumes (the CR-39 rule).
 */
type CharacterPatch = Partial<Pick<Character, 'name' | 'raceIds' | 'archetypeId'>>;

/**
 * Character store state
 */
/**
 * What creating a character came to (TICKET-CHAR-04)
 *
 * A discriminated union rather than `Character | null`, because the **session** path has something
 * to say when it refuses: the server names the rule that was broken — an unaffordable allocation, a
 * missing archetype, a race the Snapshot does not have — and a bare `null` would throw that away
 * and leave the wizard showing a Player a spinner that stopped. The local path has no such sentence
 * and says so in one of its own.
 */
type CharacterCreation = { created: Character } | { created: null; message: string };

export interface CharacterState {
  /**
   * The characters this browser holds, in LocalStorage
   *
   * **Local mode's own list, and nothing else is ever in it** (D6). A character that plays at a
   * table lives on the server and is held in {@link CharacterState.tableCharacter}; putting one here
   * would put it in `dnd_builder_characters` on the next write, which is the one thing signing in is
   * promised never to do (v3 Req 36.2).
   */
  characters: Character[];
  isLoaded: boolean;

  /**
   * The character open at a table, if one is (TICKET-PLY-01)
   *
   * **One at a time, because a sheet is one page.** Every write to it goes through the server and
   * what comes back replaces this whole object — the server is authoritative, and adopting its
   * answer rather than patching our own is what keeps a client from believing an action landed
   * differently than it did (D5).
   */
  tableCharacter: Character | null;
  /**
   * Which table {@link CharacterState.tableCharacter} plays at (TICKET-ROLL-07)
   *
   * **Deleted in PLY-01 and back with a reader**, which is the honest order: it was written and read
   * by nothing, so it went; the roll log is session-scoped — `GET /api/sessions/:id/rolls` — and the
   * sheet has no other way to know which session to ask.
   */
  tableSessionId: string | null;
  /**
   * Whose {@link CharacterState.tableCharacter} is (TICKET-DM-01)
   *
   * **What tells a DM's view of a sheet from a Player's, and it needs no second request to do it.**
   * The server only opens a character to its owner or to the DM of its table
   * (`requireCharacterWriter`), so *this is at a table and it is not mine* has exactly one meaning:
   * I am the DM here. Asking `GET /api/sessions/:id/members` to learn the same thing would be a
   * round trip to re-derive what the document already said.
   */
  tableCharacterOwnerId: string | null;
  /**
   * True while a player action is on the wire, and **a second one is refused while it is**
   *
   * Not a spinner: it is what keeps one write in flight per character, which `rulesetSync` does for
   * a ruleset and for the same reason. Two overlapping actions would both be applied to the row as
   * the server found it and the later answer would replace the earlier one — a Player tapping
   * *damage 5* twice would lose one of them. The review found this documented and unenforced.
   */
  isActing: boolean;
  /**
   * Why the last action at a table was refused, **in the server's own words**
   *
   * The sheet renders this and keeps showing the state as it was: the engine knows which rule was
   * broken — the budget, the fit of an item, a pool nothing can price — and a client that flattened
   * those into *that did not work* would be inventing a message nobody decided on (v3 Req 41.5).
   */
  actionError: string | null;

  // Initialization
  loadCharacters: () => void;
  /**
   * Forget every loaded character without writing anything (TICKET-IO-03)
   *
   * Half of the start-fresh path: `configStore.discardStoredData` clears the keys and calls this
   * so the in-memory list matches the now-empty storage. It persists nothing itself — the keys
   * are already gone by the time it runs.
   */
  resetCharacters: () => void;

  // Character CRUD
  /**
   * Write a new character, or `null` when the data is one the model cannot hold
   *
   * Nullable since TICKET-RACE-02: more races than the blend is defined over is the first thing
   * this action refuses outright rather than storing. A caller that gets `null` should stay where
   * it is — nothing was saved. TICKET-RES-02 added the second refusal: an allocation the derived
   * budget cannot pay for, checked here as well as in the wizard so the rule has one home.
   */
  createCharacter: (data: CharacterCreationData, config: Configuration) => Character | null;
  /**
   * Write a new character to **whichever home the open ruleset lives in** (TICKET-CHAR-04)
   *
   * The action the creation wizard calls, and the one place the two destinations meet. Which they
   * are is `useConfigStore.source`'s answer and the branch belongs to
   * [`characterSync`](../services/characterSync.ts) — the same shape RUL-02 gave a ruleset's save,
   * for the same reason: a component that decided this would be a component that could decide it
   * differently from the next one.
   *
   * **Local mode goes through {@link createCharacter} unchanged**, synchronous LocalStorage write
   * and all. The promise here is for the *session* path, which is a request; a signed-out visitor
   * pays nothing for it beyond an already-resolved promise (D6).
   *
   * **The source is passed in rather than read**, and that is a real constraint rather than a
   * preference: `configStore` already imports this module — it clears the roster when a User starts
   * fresh — so reaching back for `useConfigStore` here would be a dependency cycle, which
   * `no-circular` refuses and which would make *which store owns this* unanswerable. The caller
   * reads one field off the config store and hands it over; the decision is still made here.
   *
   * @param source Which ruleset is open, and therefore where the character goes
   * @param data The Player's choices
   * @param config The ruleset they were made against — the browser's, or a session's Snapshot
   * @returns The character, or the reason there is none — the server's own sentence on the session
   *   path, which names the rule it broke
   */
  createCharacterHere: (
    source: RulesetSource,
    data: CharacterCreationData,
    config: Configuration
  ) => Promise<CharacterCreation>;
  /**
   * Patch the fields of a character that no other action owns
   *
   * Deliberately **not** `Partial<Character>` (CR-12). A free-form patch could write `experience`,
   * which only `awardExperience`/`deductExperience` may touch since `level` derives from it; or
   * `investedStatPoints`, whose budget refusal has one home in `setInvestedStatPoints`; or
   * `id`/`configurationId`/`createdAt`, which are identity rather than content. Every one of those
   * has a guarded action, so this one takes only what is left: see {@link CharacterPatch}.
   */
  updateCharacter: (id: string, updates: CharacterPatch) => void;
  deleteCharacter: (id: string) => void;
  getCharacter: (id: string) => Character | undefined;

  /**
   * Read a character that lives on the server and hold it open (TICKET-PLY-01)
   *
   * **It does not open the rules**, and that absence is deliberate: `configStore` already imports
   * this module, so reaching back for `openSessionSnapshot` here would be the cycle `no-circular`
   * refuses. The session id comes back so the caller can do it — the same shape
   * `createCharacterHere` uses for the same reason.
   *
   * @param characterId Which character
   * @returns The table it plays at, or `null` when it could not be read
   */
  openTableCharacter: (characterId: string) => Promise<string | null>;
  /** Let go of the character open at a table, and of whatever it last said */
  closeTableCharacter: () => void;
  /** Dismiss the last refusal — the state it refused to change is already on screen */
  dismissActionError: () => void;

  // Inventory Management
  equipItem: (
    characterId: string,
    equipmentSlotType: string,
    itemId: string,
    config: Configuration
  ) => void;
  unequipItem: (characterId: string, equipmentSlotType: string) => void;
  addMiscItem: (characterId: string, itemId: string) => void;
  removeMiscItem: (characterId: string, itemId: string) => void;
  moveItemToMisc: (characterId: string, equipmentSlotType: string) => void;
  moveItemToEquipment: (
    characterId: string,
    itemId: string,
    equipmentSlotType: string,
    config: Configuration
  ) => void;

  // Current Stat Value Updates
  updateCurrentStatValue: (
    characterId: string,
    statId: string,
    value: number,
    config: Configuration
  ) => void;
  // `updateCurrentStatValues`, the batch write, went with TICKET-PLY-01. Its only caller was the
  // single-stat action delegating *to* it; the table path needs a named intent per stat, so the
  // delegation reversed and the batch was left with nothing but its own tests calling it.

  /**
   * Put points into one invested stat, refusing anything the derived budget cannot pay for
   *
   * The level-up mechanic (TICKET-RES-02): unspent points stay spendable, so a Player who gains a
   * level simply has more to allocate and does it here rather than through a second wizard. The
   * refusal is a **refusal**, not a clamp — silently spending fewer points than asked would leave
   * a Player believing an investment landed. It takes the `Configuration` because the budget is
   * derived from the character's level, which is never stored on them.
   */
  setInvestedStatPoints: (
    characterId: string,
    statId: string,
    points: number,
    config: Configuration
  ) => void;

  /**
   * Put points into one skill
   *
   * Deliberately **not** budgeted, unlike its stat counterpart, because the ruleset has no skill
   * pool to budget against: `skillAllocation.ts` prices stat points and nothing else, and the
   * creation wizard already lets a Player type any number into a skill. Refusing here would make
   * the sheet stricter than the wizard that produced the character, which is the wrong direction
   * for the two to disagree in.
   *
   * The only rule is the one the data itself has: a whole number, not negative. If a later ticket
   * gives skills a pool, this is where the refusal goes, next to `setInvestedStatPoints`'s.
   */
  setInvestedSkillPoints: (characterId: string, skillId: string, points: number) => void;

  /**
   * Set what the character is carrying, in the ruleset's base tier (Concept 16, TICKET-CUR-02)
   *
   * **One number, not a tier-by-tier breakdown** — see `Character.purse` for why. Which tier a
   * Player is *shown* is `formatPurse`'s answer and is re-asked every render, so retuning the
   * ruleset's rates changes every display and rewrites nothing.
   *
   * Below zero is **refused with the shortfall named** rather than clamped, which is
   * `deductExperience`'s precedent: a purchase that quietly emptied a purse instead of refusing
   * would leave a table believing it had been paid for.
   */
  setPurse: (characterId: string, amount: number) => void;
  /** Move the purse by a delta — Concept 20's quick entry, with the same refusal below zero */
  adjustPurse: (characterId: string, delta: number) => void;
  /**
   * Convert any stored per-tier wallet into a base-tier purse (TICKET-CUR-02)
   *
   * **A one-way migration for a field that never had a ticket.** `wallet?: Record<tierId, number>`
   * arrived outside the process and CUR-02 replaced it; this is what keeps the money. Each tier's
   * holding is converted down to the base tier by `convertCurrency` and summed, so a purse of 3 gold
   * and 40 copper becomes one amount worth exactly that.
   *
   * **The tiers are passed in rather than read**, for `createCharacterHere`'s reason: `configStore`
   * imports this module, so reaching back would be the cycle `no-circular` refuses.
   * `useAppHydration` has the ruleset by the time it restores the roster, and calls this once.
   *
   * A character with no wallet, or a ruleset with no tiers to convert by, is left exactly as it is.
   */
  adoptStoredWallets: (tiers: CurrencyTier[]) => void;

  /**
   * Move a resource pool by a delta rather than setting it (Concept 20's quick entry)
   *
   * `-7` off a pool of 30 leaves 23. The delta applies to what is **stored**, not to what is
   * displayed, so a pool already above a shrunken maximum loses exactly what was asked for. The
   * write still clamps at the maximum and still allows a negative result (Requirements 14.3, 14.4).
   */
  adjustCurrentStatValue: (
    characterId: string,
    statId: string,
    delta: number,
    config: Configuration
  ) => void;
  /**
   * Fill a resource pool to its calculated maximum — Concept 20's "Regain mana to full"
   *
   * The maximum is derived, so this is the one write that reads it: a pool whose formula cannot be
   * evaluated has no maximum to reset to and is left alone rather than zeroed.
   */
  resetCurrentStatValueToMax: (characterId: string, statId: string, config: Configuration) => void;

  // Experience (Concept 20, TICKET-RES-01) — level derives from this, so nothing else may write it
  /** Add experience. A non-positive or non-finite amount is refused rather than treated as a deduct. */
  awardExperience: (characterId: string, amount: number) => void;
  /**
   * Remove experience, refusing to take a character below 0.
   *
   * A **refusal**, not a clamp: `exp.gs` deducts a stated amount, and quietly deducting less than
   * asked would leave the table believing a penalty landed in full. Nothing is written when the
   * amount is more than the character has.
   */
  deductExperience: (characterId: string, amount: number) => void;

  /**
   * Set how far a character stands in their dream (TICKET-RES-04)
   *
   * **The local half of a DM action**, and it is here for the reason {@link awardExperience} is:
   * signed out there is no DM, the Player keeps their own sheet, and the rule is the Kernel's either
   * way. At a table it is refused with the same sentence the purse and experience are refused with —
   * {@link dmSetDreamLevel} is the DM's route to the same field.
   *
   * A refusal is reported, because the box is one a Player types into and *below 1* is a thing they
   * can genuinely type.
   *
   * Named `update…` beside the DM's `dmSet…` exactly as {@link updateCurrentStatValue} sits beside
   * {@link dmSetResource}: one name per actor, one Kernel rule behind both.
   */
  updateDreamLevel: (characterId: string, level: number) => void;

  /*
   * The Dungeon Master's controls (TICKET-DM-01, v3 Req 42.1-42.4)
   *
   * **Table-only, and named apart from the Player's own actions rather than sharing them.** The two
   * award experience to the same field, and they are still different acts: one is somebody moving a
   * number on their own sheet with nobody to answer to, the other is the DM moving somebody else's
   * and is logged as such. Sharing an action would have meant one call site deciding which, which is
   * the branch v3 Req 42 exists to keep on the server.
   */
  /** Award experience to a character at the caller's table — the level follows on its own */
  dmAwardExperience: (characterId: string, amount: number) => void;
  /** Take experience away, refused below zero rather than clamped */
  dmDeductExperience: (characterId: string, amount: number) => void;
  /**
   * Put a character at a level by writing what the ruleset prices that level at
   *
   * The level is an **instruction**, never a stored value (D9): the server reads the `xp_thresholds`
   * curve, writes the experience, and refuses when the curve cannot price the level asked for.
   */
  dmSetLevel: (characterId: string, level: number) => void;
  /** Set the extra spendable stat points the DM has handed out — a total, not a delta */
  dmSetGrantedPoints: (characterId: string, points: number) => void;
  /** Set how far a character at the caller's table stands in their dream — a total, not a delta */
  dmSetDreamLevel: (characterId: string, level: number) => void;
  /** Write where one of a character's resource pools stands, under the Player's own Kernel rule */
  dmSetResource: (characterId: string, statId: string, value: number) => void;
}

/**
 * The character with this id, wherever it lives (TICKET-PLY-01)
 *
 * **Exported because two hooks need it** — the sheet and the inventory panel both used to reach for
 * `characters.find(...)`, which since this ticket is only half the answer: a character at a table is
 * not in that list and never will be. A third caller would be a signal, not a surprise.
 *
 * @param state The store as it stands
 * @param characterId Which character
 * @returns The character, or `null` when neither home has one
 */
export function selectCharacter(state: CharacterState, characterId: string): Character | null {
  const local = state.characters.find((candidate) => candidate.id === characterId);
  if (local) return local;

  return state.tableCharacter?.id === characterId ? state.tableCharacter : null;
}

/**
 * Whether a set of races is one the composition can blend (TICKET-RACE-02)
 *
 * The upper bound is the rule: past {@link MAX_RACE_COUNT} the sheet's hybrid has no meaning, so
 * the store refuses the write rather than storing a character whose bases cannot be computed.
 *
 * **No lower bound.** Concept 04 describes a character as one or two creatures, but a ruleset is
 * free to define no races at all, and a raceless character is a coherent state the sheet already
 * has an empty state for (Requirement 11.2). Requiring one would make the wizard unusable on a
 * ruleset that has none — see the ticket's implementation note.
 */
function hasBlendableRaces(raceIds: string[]): boolean {
  return raceIds.length <= MAX_RACE_COUNT;
}

/**
 * Apply a change to one character's inventory, then stamp and persist
 *
 * Every inventory action is the same three steps — find the character, replace its `Inventory`,
 * save — differing only in how the new inventory is derived. That difference is the `update`
 * callback; returning the inventory unchanged is how an action declines to do anything.
 */
function patchInventory(
  set: (partial: Partial<CharacterState>) => void,
  get: () => CharacterState,
  characterId: string,
  update: (inventory: Inventory) => Inventory
): void {
  const { characters } = get();

  const updated = autoSave(
    characters.map((char) => {
      if (char.id !== characterId) return char;

      const inventory = update(char.inventory);
      if (inventory === char.inventory) return char;

      return updateTimestamp({ ...char, inventory });
    })
  );

  set({ characters: updated });
}

/** Zustand's partial setter, as every helper here takes it */
type SetState = (partial: Partial<CharacterState>) => void;

/**
 * Run one Kernel rule against a character in **this browser**, persisting what it accepted
 *
 * The local half of every player action, and the reason each one is now three lines: the rules moved
 * to [`playerActions.ts`](../../shared/services/playerActions.ts) in TICKET-PLY-01 so the server
 * could run the same ones (D5), and what is left here is finding the character, stamping it and
 * writing LocalStorage — which is what this store has always been for.
 *
 * **A refusal is silent by default**, as it has always been on this path. The browser has a wizard
 * and a set of disabled controls in front of most of these, so a refusal there means something else
 * is already wrong; the *server* path reports the Kernel's sentence, because it has nothing standing
 * in front of it. `reportRefusal` is for the surfaces on this side that are equally bare — see the
 * branch below.
 */
function applyLocally(
  set: SetState,
  get: () => CharacterState,
  characterId: string,
  rule: (character: Character) => PlayerActionResult,
  options: { reportRefusal?: boolean } = {}
): void {
  const { characters } = get();
  const character = characters.find((candidate) => candidate.id === characterId);
  if (!character) return;

  const result = rule(character);

  if (isRefusal(result)) {
    // …unless the surface has nothing standing in front of it. The purse is a free-text box with
    // relative entry, so `-40` against 5 is a thing a Player can genuinely type — and the review
    // found it snapping the box back to 5 with the Kernel's *"7 short"* sentence built and thrown
    // away (v3 Req 43.4). `actionError` renders on any drawable sheet, not only at a table.
    if (options.reportRefusal) set({ actionError: result.refusal });
    return;
  }

  const updated = autoSave(
    characters.map((candidate) =>
      candidate.id === characterId ? updateTimestamp(result.character) : candidate
    )
  );

  set({ characters: updated });
}

/**
 * Send one player action to the table, and adopt whatever comes back
 *
 * **Send, wait, adopt** — optimistic updates are out of scope for TICKET-PLY-01, so nothing is
 * changed on the way out and the character is replaced wholesale on the way in. A refusal leaves the
 * character exactly as it was and puts the server's sentence in `actionError`, which is v3 Req 41.5:
 * the surface never shows an action that did not land.
 */
async function sendToTable(
  set: SetState,
  characterId: string,
  action: SheetAction,
  body: unknown
): Promise<void> {
  set({ isActing: true, actionError: null });

  const outcome = await sendPlayerAction(characterId, action, body);

  set(
    outcome.outcome === ACTION_OUTCOME.APPLIED
      ? { tableCharacter: outcome.character, isActing: false }
      : { actionError: outcome.message, isActing: false }
  );
}

/**
 * Route a write to the table when that is where the character lives (TICKET-PLY-01)
 *
 * **The one branch, and every action's first line.** RUL-02 put the same decision for a ruleset in
 * `rulesetSync.ts`; a character's is here because the store is what knows which of its two lists an
 * id belongs to, and the module that knows *how* to reach the server is still `characterSync.ts`.
 *
 * @returns True when the write was sent to the table and the caller should stop
 */
function toTable(
  set: SetState,
  get: () => CharacterState,
  characterId: string,
  action: PlayerAction,
  body: unknown
): boolean {
  if (get().tableCharacter?.id !== characterId) return false;

  // **One write in flight per character**, which is `rulesetSync`'s rule one aggregate over. Two
  // overlapping actions are each applied to the row the server found, so the second answer replaces
  // the first and one of them is silently lost. Swallowed rather than queued: these are one action
  // per human decision, and a second tap is the same decision made twice.
  if (get().isActing) return true;

  void sendToTable(set, characterId, action, body);
  return true;
}

/**
 * Refuse a write that belongs to the DM once the character is at a table (TICKET-PLY-01)
 *
 * Experience and the purse are the DM's at a game session
 * ([D9](../../../docs/v3.0_backend/overview.md#d9--level-stays-derived-points-to-spend-becomes-a-grant),
 * v3 Req 42), so there is no player route for either and these actions have nothing to send. The
 * sheet does not draw the controls — but **the rule belongs here, not to a JSX conditional**: the
 * review found that a table character simply fell through to `characters.find(...)`, matched
 * nothing and no-opped in silence, so a second surface reaching for the same action would have
 * inherited the bug rather than the refusal.
 *
 * @returns True when the write was refused and the caller should stop
 */
function refuseAtTable(
  set: SetState,
  get: () => CharacterState,
  characterId: string,
  subject: string
): boolean {
  if (get().tableCharacter?.id !== characterId) return false;

  set({
    actionError: `${subject} is the Dungeon Master's to change at a table, so it cannot be edited here.`,
  });

  return true;
}

/**
 * Send one DM adjustment to the table, and adopt whatever comes back (TICKET-DM-01)
 *
 * `toTable`'s counterpart for the other actor, and it exists rather than reusing that one because
 * the two ask different questions. `toTable` decides *which home does this character live in*, and
 * every player action calls it first. A DM adjustment has no local home at all — signed out there is
 * no DM, and the person on their own sheet awards their own experience through the ordinary
 * `awardExperience` — so *is this at a table* is a precondition here rather than a branch.
 *
 * @returns Nothing; the sheet reads `tableCharacter` and `actionError`
 */
function adjustAtTable(
  set: SetState,
  get: () => CharacterState,
  characterId: string,
  action: DmAction,
  body: unknown
): void {
  // Unreachable from the sheet, which only draws the DM panel for an open table character — and a
  // silent no-op is what the review found happening the last time a surface reached a store action
  // in a state it had not thought about (`refuseAtTable`)
  if (get().tableCharacter?.id !== characterId) {
    set({ actionError: 'That character is not at a table, so there is nothing to adjust.' });
    return;
  }

  // One write in flight per character, exactly as a player action has: two overlapping adjustments
  // are each applied to the row the server found, so the second answer replaces the first
  if (get().isActing) return;

  void sendToTable(set, characterId, action, body);
}

/**
 * Auto-save helper — saves characters and reports a write that did not land
 *
 * The configuration store's `autoSave` for the same reason and with the same contract (CR-11):
 * this is the one place a write can fail, and on failure what comes back is the character list
 * already in memory, so the caller's `set` is a no-op and memory keeps matching disk.
 *
 * @param characters - The list to persist
 * @returns What the store should now hold: the saved list, or the unchanged current one
 */
function autoSave(characters: Character[]): Character[] {
  try {
    saveCharacters(characters);
  } catch (error) {
    useUIStore.getState().reportStorageFailure(error);
    return useCharacterStore.getState().characters;
  }

  return characters;
}

/**
 * Update character timestamp
 */
function updateTimestamp(character: Character): Character {
  return {
    ...character,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Character store
 */
export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  isLoaded: false,
  tableCharacter: null,
  tableSessionId: null,
  tableCharacterOwnerId: null,
  isActing: false,
  actionError: null,

  // Load characters from LocalStorage
  loadCharacters: () => {
    const characters = loadCharacters();
    set({ characters, isLoaded: true });
  },

  resetCharacters: () => {
    set({ characters: [], isLoaded: true });
  },

  // Create new character
  createCharacter: (data: CharacterCreationData, config: Configuration) => {
    if (!hasBlendableRaces(data.raceIds)) return null;

    // **The character's shape is the Kernel's since TICKET-CHAR-04**, so the browser and
    // `POST /api/sessions/:id/characters` mint the same thing — a resource seeded from the same
    // maxima, an experience of 0, an empty inventory. What stays here is *this store's* two
    // refusals; the fuller set the wizard applies is `characterCreationErrors`, which the server
    // route calls because it has no wizard standing in front of it.
    const character = buildCharacter(data, config, {
      id: crypto.randomUUID(),
      now: new Date().toISOString(),
    });

    // The same engine verdict `setInvestedStatPoints` asks for, so creation and the level-up spend
    // cannot disagree about what is affordable. The wizard's step already blocks this, but the
    // judgement belongs to the store rather than to a hook — a second creation path, or a bug in
    // that one, would otherwise mint an over-budget character with nothing to refuse it.
    if (!validateStatAllocation(character, config).isValid) return null;

    const { characters } = get();
    const updated = autoSave([...characters, character]);
    set({ characters: updated });
    return character;
  },

  createCharacterHere: async (
    source: RulesetSource,
    data: CharacterCreationData,
    config: Configuration
  ) => {
    // **The only branch on the home, and it is one line** — everything about *how* a session
    // character is created lives in `characterSync`, the way a ruleset's server save lives in
    // `rulesetSync` (TICKET-RUL-02's shape, one aggregate over)
    if (source.home === RULESET_HOME.SESSION) {
      const outcome = await createSessionCharacter(source.sessionId, data);

      return outcome.outcome === CREATION_OUTCOME.CREATED
        ? { created: outcome.character }
        : { created: null, message: outcome.message };
    }

    // Local mode, unchanged from v2.0 down to the synchronous write. A signed-out visitor pays an
    // already-resolved promise for the shared signature and nothing else (D6).
    const created = get().createCharacter(data, config);

    return created
      ? { created }
      : {
          created: null,
          message: 'That character cannot be saved as it stands. Check the points you have spent.',
        };
  },

  // Update character — see `CharacterPatch` for what this may and may not touch
  updateCharacter: (id: string, updates: CharacterPatch) => {
    // Same rule as on create: a patch that would put a character past the blend is not applied
    if (updates.raceIds !== undefined && !hasBlendableRaces(updates.raceIds)) return;

    const { characters } = get();
    const updated = autoSave(
      characters.map((char) => (char.id === id ? updateTimestamp({ ...char, ...updates }) : char))
    );
    set({ characters: updated });
  },

  // Delete character
  deleteCharacter: (id: string) => {
    const { characters } = get();
    const updated = autoSave(characters.filter((char) => char.id !== id));
    set({ characters: updated });
  },

  // Get character by ID — wherever it lives, since TICKET-PLY-01
  getCharacter: (id: string) => selectCharacter(get(), id) ?? undefined,

  openTableCharacter: async (characterId: string) => {
    set({ isActing: true, actionError: null });

    try {
      const document = await fetchCharacter(characterId);

      // **A character at no table is not one this can open** (v3 Req 36.5). `GET /api/characters/:id`
      // answers an IO-04 upload to its owner quite correctly, and holding one here would be a sheet
      // whose rules are the browser's, whose purse and experience are hidden as though a DM owned
      // them, and whose every write meets the routes' 409. It is *not found* as far as a table is
      // concerned, and the sheet's own notice says that better than a banner would.
      if (document.sessionId === null) {
        set({ isActing: false });
        return null;
      }

      set({
        tableCharacter: document.character,
        tableSessionId: document.sessionId,
        tableCharacterOwnerId: document.ownerAccountId,
        isActing: false,
      });

      return document.sessionId;
    } catch {
      // The message is deliberately ours rather than the server's: every refusal this can meet is
      // the same indistinguishable 404 (v3 Req 32.5), and repeating *Not found* would tell a Player
      // nothing about what to do next
      set({
        isActing: false,
        actionError: 'That character could not be opened. It may have been removed from the table.',
      });

      return null;
    }
  },

  closeTableCharacter: () => {
    set({
      tableCharacter: null,
      tableSessionId: null,
      tableCharacterOwnerId: null,
      actionError: null,
      isActing: false,
    });
  },

  dismissActionError: () => {
    set({ actionError: null });
  },

  // Equip item to equipment slot
  equipItem: (
    characterId: string,
    equipmentSlotType: string,
    itemId: string,
    config: Configuration
  ) => {
    const body = { equipmentSlotType, itemId };
    if (toTable(set, get, characterId, PLAYER_ACTION.EQUIP_ITEM, body)) return;

    applyLocally(set, get, characterId, (character) =>
      equipToSlot(character, config, equipmentSlotType, itemId)
    );
  },

  // Unequip item from equipment slot
  unequipItem: (characterId: string, equipmentSlotType: string) => {
    const body = { equipmentSlotType };
    if (toTable(set, get, characterId, PLAYER_ACTION.UNEQUIP_ITEM, body)) return;

    applyLocally(set, get, characterId, (character) => emptySlot(character, equipmentSlotType));
  },

  // Add item to miscellaneous inventory
  addMiscItem: (characterId: string, itemId: string) => {
    if (toTable(set, get, characterId, PLAYER_ACTION.TAKE_ITEM, { itemId })) return;

    // **No Kernel call, because there is no shared rule to share.** The browser's picker is built
    // from the ruleset's item list, so this has never checked anything; the *server* does check,
    // because a request is not a picker (`playerActions.takeItem`). A server that is stricter than
    // its client is the right direction for the two to differ in.
    patchInventory(set, get, characterId, (inventory) => ({
      ...inventory,
      miscItems: [...inventory.miscItems, itemId],
    }));
  },

  // Remove item from miscellaneous inventory
  removeMiscItem: (characterId: string, itemId: string) => {
    if (toTable(set, get, characterId, PLAYER_ACTION.DROP_ITEM, { itemId })) return;

    patchInventory(set, get, characterId, (inventory) => ({
      ...inventory,
      miscItems: inventory.miscItems.filter((id) => id !== itemId),
    }));
  },

  // Move equipped item to miscellaneous inventory
  moveItemToMisc: (characterId: string, equipmentSlotType: string) => {
    const body = { equipmentSlotType };
    if (toTable(set, get, characterId, PLAYER_ACTION.STOW_ITEM, body)) return;

    applyLocally(set, get, characterId, (character) =>
      moveItemToMisc(character, equipmentSlotType)
    );
  },

  // Move miscellaneous item to equipment slot
  moveItemToEquipment: (
    characterId: string,
    itemId: string,
    equipmentSlotType: string,
    config: Configuration
  ) => {
    const body = { equipmentSlotType, itemId };
    if (toTable(set, get, characterId, PLAYER_ACTION.WEAR_ITEM, body)) return;

    applyLocally(set, get, characterId, (character) =>
      moveItemToEquipment(character, config, itemId, equipmentSlotType)
    );
  },

  // Update single current stat value
  updateCurrentStatValue: (
    characterId: string,
    statId: string,
    value: number,
    config: Configuration
  ) => {
    const body = { statId, value };
    if (toTable(set, get, characterId, PLAYER_ACTION.SET_RESOURCE, body)) return;

    applyLocally(set, get, characterId, (character) =>
      setResourceValue(character, config, statId, value)
    );
  },

  adjustCurrentStatValue: (
    characterId: string,
    statId: string,
    delta: number,
    config: Configuration
  ) => {
    const body = { statId, delta };
    if (toTable(set, get, characterId, PLAYER_ACTION.ADJUST_RESOURCE, body)) return;

    applyLocally(set, get, characterId, (character) =>
      adjustResourceValue(character, config, statId, delta)
    );
  },

  resetCurrentStatValueToMax: (characterId: string, statId: string, config: Configuration) => {
    const body = { statId };
    if (toTable(set, get, characterId, PLAYER_ACTION.RESET_RESOURCE, body)) return;

    applyLocally(set, get, characterId, (character) =>
      resetResourceToMax(character, config, statId)
    );
  },

  setInvestedStatPoints: (
    characterId: string,
    statId: string,
    points: number,
    config: Configuration
  ) => {
    const body = { statId, points };
    if (toTable(set, get, characterId, PLAYER_ACTION.INVEST_STAT_POINTS, body)) return;

    // The engine decides, so the sheet and the wizard cannot disagree about what is affordable —
    // and since TICKET-PLY-01 the *server* asks the same engine the same question, because the
    // rule moved to the Kernel rather than being copied there.
    applyLocally(set, get, characterId, (character) =>
      investInStat(character, config, statId, points)
    );
  },

  setInvestedSkillPoints: (characterId: string, skillId: string, points: number) => {
    const body = { skillId, points };
    if (toTable(set, get, characterId, PLAYER_ACTION.INVEST_SKILL_POINTS, body)) return;

    // No budget check — see the note on the action's declaration. The whole rule is the shape.
    applyLocally(set, get, characterId, (character) => investInSkill(character, skillId, points));
  },

  setPurse: (characterId: string, amount: number) => {
    // A purse at a table is the DM's until TICKET-DM-02 gives them the control (D9, v3 Req 42.5)
    if (refuseAtTable(set, get, characterId, 'A purse')) return;

    applyLocally(set, get, characterId, (character) => setPurseAmount(character, amount), {
      reportRefusal: true,
    });
  },

  adjustPurse: (characterId: string, delta: number) => {
    if (refuseAtTable(set, get, characterId, 'A purse')) return;

    applyLocally(set, get, characterId, (character) => adjustPurseBy(character, delta), {
      reportRefusal: true,
    });
  },

  adoptStoredWallets: (tiers: CurrencyTier[]) => {
    const { characters } = get();

    const converted = characters.map(
      (character) => purseFromStoredWallet(character, tiers) ?? character
    );

    // Nothing to convert is the overwhelmingly common case, and writing the whole roster back for
    // it would be a save on every page load
    if (converted.every((character, index) => character === characters[index])) return;

    set({ characters: autoSave(converted) });
  },

  // The rule moved to the Kernel with TICKET-DM-01 rather than being copied into a DM route: the
  // shape of the amount, the unreadable-total guard and the refuse-don't-clamp deduction are one
  // implementation now, which is what makes the DM's `dm-award-experience` and this the same rule
  awardExperience: (characterId: string, amount: number) => {
    if (refuseAtTable(set, get, characterId, 'Experience')) return;

    applyLocally(set, get, characterId, (character) => addExperience(character, amount));
  },

  deductExperience: (characterId: string, amount: number) => {
    if (refuseAtTable(set, get, characterId, 'Experience')) return;

    applyLocally(set, get, characterId, (character) => removeExperience(character, amount));
  },

  updateDreamLevel: (characterId: string, level: number) => {
    if (refuseAtTable(set, get, characterId, 'A dream level')) return;

    applyLocally(set, get, characterId, (character) => setDreamLevel(character, level), {
      reportRefusal: true,
    });
  },

  dmAwardExperience: (characterId: string, amount: number) => {
    adjustAtTable(set, get, characterId, DM_ACTION.AWARD_EXPERIENCE, {
      amount,
    } satisfies ExperienceRequest);
  },

  dmDeductExperience: (characterId: string, amount: number) => {
    adjustAtTable(set, get, characterId, DM_ACTION.DEDUCT_EXPERIENCE, {
      amount,
    } satisfies ExperienceRequest);
  },

  dmSetLevel: (characterId: string, level: number) => {
    adjustAtTable(set, get, characterId, DM_ACTION.SET_LEVEL, { level } satisfies LevelRequest);
  },

  dmSetGrantedPoints: (characterId: string, points: number) => {
    adjustAtTable(set, get, characterId, DM_ACTION.GRANT_POINTS, { points } satisfies GrantRequest);
  },

  dmSetResource: (characterId: string, statId: string, value: number) => {
    adjustAtTable(set, get, characterId, DM_ACTION.SET_RESOURCE, {
      statId,
      value,
    } satisfies ResourceValueRequest);
  },

  dmSetDreamLevel: (characterId: string, level: number) => {
    adjustAtTable(set, get, characterId, DM_ACTION.SET_DREAM_LEVEL, {
      dreamLevel: level,
    } satisfies DreamLevelRequest);
  },
}));
