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
// `addToPack` and `removeFromPack` are deliberately absent: the browser's pack has never had a rule
// to share — its picker is built from the ruleset's item list — and the *server* is the side that
// has to check, because a request is not a picker. See `addMiscItem` below.
import {
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
  setResourceValue,
} from '#shared/services/playerActions';
import type { PlayerAction } from '#shared/types/api';
import { PLAYER_ACTION } from '#shared/types/api';
import type { Character, CharacterCreationData, Inventory } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
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
   * Set what the character is carrying in one currency tier (Concept 16)
   *
   * Stored per tier, exactly as entered: 15 silver stays 15 silver rather than being rolled up
   * into 1 gold 5 silver on write. Normalising is a *display* choice and belongs where the total
   * is rendered — a purse that reorganises itself the moment you look away is a purse a Player
   * cannot reconcile against the table.
   *
   * Negative is refused rather than clamped, on the same reasoning as `deductExperience`: owing
   * money is a thing a table may well want, but it is a mechanic, and inventing it here silently
   * would be worse than not having it. Fractions are allowed — a rate of 10 makes half a gold an
   * ordinary amount to hold.
   */
  setWalletAmount: (characterId: string, tierId: string, amount: number) => void;

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
 * **A refusal is silent**, as it has always been on this path. The browser has a wizard and a set of
 * disabled controls in front of these, so a refusal here means something else is already wrong;
 * the *server* path reports the Kernel's sentence, because it has nothing standing in front of it.
 */
function applyLocally(
  set: SetState,
  get: () => CharacterState,
  characterId: string,
  rule: (character: Character) => PlayerActionResult
): void {
  const { characters } = get();
  const character = characters.find((candidate) => candidate.id === characterId);
  if (!character) return;

  const result = rule(character);
  if (isRefusal(result)) return;

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
  action: PlayerAction,
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
 * Whether an amount is a real, positive quantity of experience
 *
 * Award and deduct each state their own direction, so a negative amount is a caller mistake rather
 * than a way to reverse the operation — accepting it would let `awardExperience(-100)` take XP away
 * without passing the below-zero refusal.
 */
function isAwardableAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0;
}

/**
 * Apply one experience change, then stamp and persist
 *
 * The counterpart to `updateCharacterInventory`, and takes its arguments in the same order:
 * `change` returns the new total, or `undefined` to refuse — in which case nothing is written,
 * nothing is stamped, and the array identity is unchanged so no subscriber re-renders over a no-op.
 */
function applyExperienceChange(
  set: (partial: Partial<CharacterState>) => void,
  get: () => CharacterState,
  characterId: string,
  change: (experience: number) => number | undefined
): void {
  const { characters } = get();

  let changed = false;
  const next = characters.map((char) => {
    if (char.id !== characterId) return char;

    // Belt and braces with `loadCharacters`' filter: a character whose stored total is not a
    // number would compute `undefined + amount` and persist `NaN`, which reads as level 1 forever
    // and cannot be undone from the UI. Refused rather than repaired — inventing a total is the
    // same mistake as inventing a level.
    if (!Number.isFinite(char.experience)) return char;

    const experience = change(char.experience);
    if (experience === undefined) return char;

    changed = true;
    return updateTimestamp({ ...char, experience });
  });

  if (!changed) return;

  set({ characters: autoSave(next) });
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

      set({ tableCharacter: document.character, isActing: false });

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
    set({ tableCharacter: null, actionError: null, isActing: false });
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

  setWalletAmount: (characterId: string, tierId: string, amount: number) => {
    if (refuseAtTable(set, get, characterId, 'A purse')) return;

    const { characters } = get();
    const character = characters.find((candidate) => candidate.id === characterId);
    if (!character) return;

    if (!Number.isFinite(amount) || amount < 0) return;

    const updated = autoSave(
      characters.map((candidate) =>
        candidate.id === characterId
          ? updateTimestamp({
              ...candidate,
              wallet: { ...(candidate.wallet ?? {}), [tierId]: amount },
            })
          : candidate
      )
    );
    set({ characters: updated });
  },

  awardExperience: (characterId: string, amount: number) => {
    if (refuseAtTable(set, get, characterId, 'Experience')) return;

    applyExperienceChange(set, get, characterId, (experience) =>
      isAwardableAmount(amount) ? experience + amount : undefined
    );
  },

  deductExperience: (characterId: string, amount: number) => {
    if (refuseAtTable(set, get, characterId, 'Experience')) return;

    applyExperienceChange(set, get, characterId, (experience) => {
      if (!isAwardableAmount(amount)) return undefined;
      // Refused rather than clamped: a partial deduction would read as a penalty that landed
      return amount > experience ? undefined : experience - amount;
    });
  },
}));
