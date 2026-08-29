/**
 * Configuration Store
 *
 * Zustand store for managing user-defined configuration data.
 * Implements CRUD operations for all config entities with auto-save to LocalStorage.
 *
 * Deletes are guarded here (TICKET-REF-02): an entity something still points at is refused, and
 * the action hands the caller the reference list instead of a silent success.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.5, 2.6, 17.1, 17.3; Concept 00 §6**
 */

import { create } from 'zustand';
import type { RegenerationReport } from '#shared/engine/curveGenerator';
import {
  clearCurveOverride as clearCurveOverrideCell,
  regenerateCurve as regenerateCurveTable,
  setCurveCell as setCurveCellValue,
} from '#shared/engine/curveGenerator';
import {
  addCurveColumn as addColumnToCurve,
  addCurveRow as addRowToCurve,
  removeCurveColumn,
  removeCurveRow,
} from '#shared/engine/curveTable';
import type { EntityReference, ReferenceTargetKind } from '#shared/engine/dependencies';
import { findReferences } from '#shared/engine/dependencies';
import {
  cellKey,
  clampEquipmentLayout,
  DEFAULT_EQUIPMENT_LAYOUT,
  isWithinLayout,
  prunePlacements,
  seedPlacements,
} from '#shared/engine/equipmentLayout';
import { toDisplayConfiguration, toStoredConfiguration } from '#shared/engine/formula/references';
import { createFreshConfiguration } from '#shared/services/freshConfiguration';
import type {
  Archetype,
  Configuration,
  Constant,
  CurrencyTier,
  Curve,
  CurveColumn,
  DiceLadder,
  EquipmentLayout,
  EquipmentSlot,
  EquipmentSlotPlacement,
  Inlay,
  Item,
  Material,
  MaterialCategory,
  Race,
  RollDefinition,
  Skill,
  Stat,
} from '#shared/types/config';
import { ApiError } from '../services/api';
import {
  cancelPendingSaves,
  fetchRuleset,
  fetchSessionSnapshot,
  LOCAL_SOURCE,
  persistRuleset,
  RULESET_HOME,
  type RulesetSource,
  SAVE_OUTCOME,
  type SaveOutcome,
} from '../services/rulesetSync';
import { clearAllData, loadConfiguration } from '../services/storage';
import { useCharacterStore } from './characterStore';
import { RULESET_ALERT, useUIStore } from './uiStore';

/**
 * How a delete should behave when something still points at the entity
 *
 * The default is to refuse. `force` is the User overriding that decision knowingly: the entity
 * goes, and every formula naming it starts reporting an `undefined-variable` error value
 * (Concept 00 §7) rather than quietly reading as zero.
 */
export interface DeleteOptions {
  force?: boolean;
}

/**
 * Why a write was refused for colliding with something already in the ruleset (CR-17)
 *
 * The write counterpart to `guardedDelete`'s `EntityReference[]`, and it exists for the same reason
 * that docstring gives: an advisory check in the UI is a check that can be bypassed. The managers
 * did enforce these rules, so nothing the dialogs could do was wrong — but any other write path (a
 * bulk action, a test, direct store use) could persist a ruleset that saves fine, engine-validates
 * fine, and is then **refused by the app's own import**. An export that cannot round-trip is the
 * concrete cost.
 *
 * Duplicate names also interact with first-wins formula resolution (CR-18) to make a formula bind
 * to the wrong entity, which is why the store refuses rather than warns.
 *
 * `null` from an action means the write landed; a refusal means nothing was written.
 */
export interface UniquenessRefusal {
  /** Which identity slot was already taken */
  field: 'id' | 'abbreviation' | 'name';
  /** The value that is taken */
  value: string;
  /** What holds it already, as a sentence a dialog can render verbatim */
  message: string;
}

/**
 * The browser's own ruleset, reduced to what a row on `/rulesets` renders (TICKET-RUL-02)
 *
 * Module-local: `useRulesetManager` reads it off the store and TypeScript infers, so exporting it
 * would be supported API nothing consumes (the CR-39 rule).
 */
interface LocalSummary {
  name: string;
  /** ISO, as a `Configuration` stores it */
  updatedAt: string;
}

/**
 * Configuration store state
 */
interface ConfigState {
  config: Configuration | null;
  isLoaded: boolean;
  /**
   * Which home the open ruleset lives in, and therefore where its edits are saved (TICKET-RUL-02)
   *
   * **Defaults to the browser**, which is what makes local mode the unchanged path: a visitor who
   * never signs in never touches this, and every action persists through `saveConfiguration` as it
   * always did (D6).
   */
  source: RulesetSource;
  /**
   * What **this browser** holds, whichever home is open (TICKET-RUL-02)
   *
   * `/rulesets` draws both homes at once, so the local row cannot read `config` — that is the
   * *account's* ruleset whenever one is open. Two fields rather than the whole document, because
   * two fields is all a row renders and a second copy of a 306 KB `Configuration` in memory is not
   * a cache anybody asked for.
   */
  localSummary: LocalSummary | null;

  // Initialization
  initializeConfig: (name: string) => void;
  loadConfig: () => void;
  replaceConfig: (config: Configuration) => void;
  renameConfig: (name: string) => void;
  /**
   * Open a ruleset from the Account, replacing whatever is open (TICKET-RUL-02)
   *
   * **Reads nothing from LocalStorage and writes nothing to it.** The two homes never meet: this
   * fetches the document the server holds and points `source` at it, and the browser's own ruleset
   * sits untouched in `dnd_builder_config` waiting to be opened again (v3 Req 36.2).
   *
   * @param id Which ruleset on the Account
   * @returns Whether it opened; `false` leaves whatever was open exactly as it was
   */
  openAccountRuleset: (id: string) => Promise<boolean>;
  /**
   * Open the rules a game session plays by (TICKET-CHAR-04)
   *
   * **The Snapshot, never the Ruleset it was taken from** (D7). A table stopped following its
   * ruleset the moment the session began, so this is what a character built at that table has to be
   * priced by — and it is what the creation wizard runs against once this is open.
   *
   * **Read-only, and the store does not have to remember that**: `persistRuleset` refuses the
   * session home, so an edit made against it is refused where every other edit is decided rather
   * than by each surface knowing not to offer one.
   *
   * @param sessionId Which table's rules
   * @returns Whether they opened; `false` leaves whatever was open exactly as it was
   */
  openSessionSnapshot: (sessionId: string) => Promise<boolean>;
  /**
   * Go back to the ruleset this browser holds (TICKET-RUL-02)
   *
   * Re-reads LocalStorage rather than trusting anything in memory, because what is in memory is
   * the *account's* ruleset by the time anybody calls this.
   *
   * @returns Whether the stored ruleset could be read. **The home is switched either way**, so a
   *   caller that navigates on `false` lands on an empty Configuration mode rather than editing the
   *   Account's ruleset believing it is the browser's.
   */
  openLocalRuleset: () => boolean;
  /**
   * Throw away everything LocalStorage holds and start from nothing (TICKET-IO-03)
   *
   * The **only** path that clears the keys. Data this build cannot open is refused on load and
   * left exactly where it is; it goes away when — and only when — the User confirms this, having
   * been offered a backup first.
   */
  discardStoredData: () => void;

  // Stats CRUD
  /**
   * Write a new stat, or refuse it for taking an id or abbreviation already in use
   *
   * Nullable since CR-17, the way the deletes have been guarded since TICKET-REF-02: the invariant
   * lives in the action rather than in the dialog, so no write path can bypass it. See
   * {@link UniquenessRefusal}.
   */
  addStat: (stat: Stat) => UniquenessRefusal | null;
  /** Patch a stat, refusing a patch that would take another stat's abbreviation (CR-17) */
  updateStat: (id: string, updates: Partial<Stat>) => UniquenessRefusal | null;
  deleteStat: (id: string, options?: DeleteOptions) => EntityReference[];
  /**
   * Put the stats in the given order and renumber `order` to match (TICKET-STAT-02)
   *
   * Takes the whole ordering rather than a from/to pair so the array and the field can never
   * disagree: `order` is rewritten from each stat's position, and the stored array is written in
   * that same sequence, which is what makes every `config.stats.map(…)` in the app display in
   * the User's order without each caller remembering to sort.
   *
   * Ids not in the list keep their relative order at the end; unknown ids are ignored. Reordering
   * never changes a value — references are by id (Concept 01).
   */
  reorderStats: (orderedIds: string[]) => void;

  // Speciality Skills CRUD
  addSkill: (skill: Skill) => void;
  updateSkill: (id: string, updates: Partial<Skill>) => void;
  deleteSkill: (id: string, options?: DeleteOptions) => EntityReference[];

  // Material Categories CRUD
  addMaterialCategory: (category: MaterialCategory) => void;
  updateMaterialCategory: (id: string, updates: Partial<MaterialCategory>) => void;
  deleteMaterialCategory: (id: string, options?: DeleteOptions) => EntityReference[];

  // Materials CRUD
  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string, options?: DeleteOptions) => EntityReference[];

  /**
   * Inlays CRUD (v4 systems/10, TICKET-INL-01)
   *
   * The tiers are edited through `updateInlay` with the whole ladder, like a material's levels: a
   * tier has no identity of its own, so there is nothing for a per-tier action to address.
   *
   * The delete is guarded through the same surface as every other one, and — like `deleteDiceLadder`
   * before TICKET-ROLL-05 — nothing can point at an inlay yet, so it always succeeds. The socket
   * that gives the guard something to find lands in TICKET-INV-05.
   */
  addInlay: (inlay: Inlay) => void;
  updateInlay: (id: string, updates: Partial<Inlay>) => void;
  deleteInlay: (id: string, options?: DeleteOptions) => EntityReference[];

  // Items CRUD
  addItem: (item: Item) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  deleteItem: (id: string, options?: DeleteOptions) => EntityReference[];

  // Equipment Slots CRUD
  addEquipmentSlot: (slot: EquipmentSlot) => void;
  updateEquipmentSlot: (type: string, updates: Partial<EquipmentSlot>) => void;
  deleteEquipmentSlot: (type: string, options?: DeleteOptions) => EntityReference[];

  // Equipment layout — the grid the slots are arranged on (TICKET-INV-03)
  /** Resize the grid, dropping any placement the new size has no room for */
  setEquipmentLayout: (layout: EquipmentLayout) => void;
  /** Put a slot on a cell, or take it off the figure with `null` */
  placeEquipmentSlot: (type: string, placement: EquipmentSlotPlacement | null) => void;
  /** Give a ruleset that has never been laid out the sheet's own figure; a no-op afterwards */
  seedEquipmentLayout: () => void;

  // Races CRUD
  addRace: (race: Race) => void;
  updateRace: (id: string, updates: Partial<Race>) => void;
  deleteRace: (id: string, options?: DeleteOptions) => EntityReference[];

  // The creature reference lists a race's identity is picked from (v4 systems/14, TICKET-RACE-03)
  /** Replace the sizes a race may be; an empty list clears the key rather than storing `[]` */
  setCreatureSizes: (sizes: string[]) => void;
  /** Replace the creature types a race may be; empty clears the key, as sizes do */
  setCreatureTypes: (types: string[]) => void;

  // Archetypes CRUD (Concept 03, TICKET-ARC-01)
  addArchetype: (archetype: Archetype) => void;
  updateArchetype: (id: string, updates: Partial<Archetype>) => void;
  deleteArchetype: (id: string, options?: DeleteOptions) => EntityReference[];

  // Currency Tiers CRUD
  addCurrencyTier: (tier: CurrencyTier) => void;
  updateCurrencyTier: (id: string, updates: Partial<CurrencyTier>) => void;
  deleteCurrencyTier: (id: string, options?: DeleteOptions) => EntityReference[];

  // Constants CRUD
  /** Write a new constant, refusing an id or name already in use (CR-17) */
  addConstant: (constant: Constant) => UniquenessRefusal | null;
  /** Patch a constant, refusing a rename onto another constant's name (CR-17) */
  updateConstant: (id: string, updates: Partial<Constant>) => UniquenessRefusal | null;
  deleteConstant: (id: string, options?: DeleteOptions) => EntityReference[];

  // Curves CRUD
  /** Write a new curve, refusing an id or name already in use (CR-17) */
  addCurve: (curve: Curve) => UniquenessRefusal | null;
  /** Patch a curve, refusing a rename onto another curve's name (CR-17) */
  updateCurve: (id: string, updates: Partial<Curve>) => UniquenessRefusal | null;
  deleteCurve: (id: string, options?: DeleteOptions) => EntityReference[];
  /** Refill a curve's generated cells, keeping every override (TICKET-CRV-02) */
  regenerateCurve: (id: string) => RegenerationReport;

  /**
   * Curve grid editing (TICKET-CRV-03)
   *
   * Separate actions rather than `updateCurve` calls because `columns`, `rows[].values` and
   * `rows[].overridden` are three arrays addressed by one index: a caller that patches `columns`
   * alone moves every override flag onto the wrong cell. Routing the structural edits through
   * `engine/curveTable.ts` is what makes that unrepresentable rather than merely documented.
   */
  addCurveColumn: (curveId: string, column: CurveColumn) => void;
  /**
   * Guarded like every other delete: a column is a referenceable entity now that it is renamable,
   * so a formula reading `curve.point_buy.main(x)` refuses the removal of `main`.
   */
  deleteCurveColumn: (
    curveId: string,
    columnId: string,
    options?: DeleteOptions
  ) => EntityReference[];
  addCurveRow: (curveId: string, key: number) => void;
  deleteCurveRow: (curveId: string, key: number) => void;
  /** Type a number into a cell — which is what makes a generated cell an override */
  setCurveCell: (curveId: string, key: number, columnName: string, value: number) => void;
  /** Drop a cell's override, putting the generated value back */
  clearCurveOverride: (curveId: string, key: number, columnName: string) => void;

  /**
   * Dice Ladders CRUD (Concept 07, TICKET-ROLL-03)
   *
   * The delete is guarded like every other one as of TICKET-ROLL-05, which brought the first thing
   * that can point at a ladder. It shipped unguarded deliberately: a `ReferenceTargetKind` with no
   * possible referrer is a check that can never fire.
   */
  addDiceLadder: (ladder: DiceLadder) => void;
  updateDiceLadder: (id: string, updates: Partial<DiceLadder>) => void;
  deleteDiceLadder: (id: string, options?: DeleteOptions) => EntityReference[];

  /**
   * Roll Definitions CRUD (Concept 08, TICKET-ROLL-05)
   *
   * **No `applyRenameSafely`**, unlike the five update actions that have it. Those exist because
   * the entity's own display spelling lives in a formula namespace, so editing it has to re-spell
   * everything pointing at it. A roll's name is in no namespace — nothing can reference a roll —
   * so the round trip would be a no-op over the whole ruleset on every edit.
   */
  addRollDefinition: (roll: RollDefinition) => void;
  updateRollDefinition: (id: string, updates: Partial<RollDefinition>) => void;
  deleteRollDefinition: (id: string, options?: DeleteOptions) => EntityReference[];
}

/**
 * Apply an edit that may rename something, without breaking what points at it
 *
 * References are resolved to ids first, so the patch lands on a configuration where nothing is
 * identified by a spelling; translating back afterwards re-renders every formula, racial modifier
 * and material bonus with whatever the entity is now called (Concept 00 §6). A patch that renames
 * nothing round-trips to the same configuration, which is why the update actions can use this
 * unconditionally rather than sniffing for a changed code.
 *
 * @param config - The configuration before the edit
 * @param patch - The edit, applied to the id-resolved form
 * @returns The edited configuration, back in display form
 */
function applyRenameSafely(
  config: Configuration,
  patch: (config: Configuration) => Configuration
): Configuration {
  return toDisplayConfiguration(patch(toStoredConfiguration(config)));
}

/**
 * Merge a patch where an explicit `undefined` **clears** an optional field
 *
 * A plain spread would leave `min: undefined` sitting on the record — a key that is present,
 * reads as absent, and disappears the next time the ruleset is serialised. The data model's rule
 * is that an optional field is deleted rather than stored empty, so a caller clearing a bound or a
 * formula gets the key removed.
 *
 * @param entity - The record being edited
 * @param updates - The patch; a key set to `undefined` is a removal, an absent key is a no-op
 * @returns The merged record, with no `undefined`-valued keys
 */
function mergeClearingAbsent<T extends object>(entity: T, updates: Partial<T>): T {
  const merged = { ...entity, ...updates } as Record<string, unknown>;
  for (const key of Object.keys(merged)) {
    if (merged[key] === undefined) delete merged[key];
  }
  return merged as T;
}

/**
 * An optional list, with the empty one spelled as absence (TICKET-RACE-03)
 *
 * The data model's rule for an optional collection is *absent means none and stays absent* — a
 * ruleset that names no creature sizes must round-trip without growing a `"creatureSizes": []`.
 * Emptying the list in the panel is therefore the same act as never having had one, and this is
 * where the two are made identical rather than at each caller.
 *
 * @param values - What the editor now holds
 * @returns The list, or `undefined` when it holds nothing — which {@link mergeClearingAbsent} deletes
 */
function emptyToAbsent(values: string[]): string[] | undefined {
  return values.length === 0 ? undefined : values;
}

/**
 * Auto-save helper — saves config, updates the timestamp, and reports a write that did not land
 *
 * The one place in this store where a write can fail, which is why the catch is here (CR-11).
 * `saveConfiguration` has thrown `StorageQuotaError`/`StorageError` since Requirement 17.x and
 * nothing anywhere caught either, so on a full LocalStorage the exception escaped the action into
 * a React event handler: the edit silently didn't land and the User was told nothing.
 *
 * **On failure the caller's `set` becomes a no-op**, because what comes back is the configuration
 * already in memory rather than the edit. That is deliberate: the write is attempted before the
 * state changes, so a refused write leaves memory and disk agreeing rather than drifting apart —
 * the atomicity the throw used to give, kept without the throw.
 *
 * ## Two destinations since TICKET-RUL-02, and the branch is not here
 *
 * Which home the open ruleset lives in decides where this goes, and `services/rulesetSync.ts` is
 * the one place that decides it. **The local path is byte-for-byte what it always was** — a
 * synchronous `saveConfiguration` that throws on a full store, caught exactly as below — so a
 * signed-out visitor cannot tell this ticket happened (D6).
 *
 * **The account path is asynchronous and the state does not wait for it.** An edit lands in memory
 * immediately and the debounced `PUT` follows; a refusal comes back through
 * {@link reportSaveOutcome} as a banner rather than by rolling the edit back. That is the opposite
 * of the LocalStorage rule above, and deliberately: a full disk means the change *cannot* be kept,
 * while a conflict means somebody else's change also exists — throwing the User's work away to
 * resolve that would be the silent loss v3 Req 33.8 forbids.
 *
 * @param config - The configuration to persist
 * @returns What the store should now hold: the saved edit, or the unchanged current ruleset
 */
function autoSave(config: Configuration): Configuration {
  const updated = {
    ...config,
    updatedAt: new Date().toISOString(),
  };

  const { source } = useConfigStore.getState();

  try {
    void persistRuleset(source, updated).then(reportSaveOutcome).catch(reportSaveCrash);

    // The browser's row on `/rulesets` has to keep saying what *this browser* holds even while an
    // account ruleset is open, so the summary is refreshed here rather than in thirty actions —
    // `autoSave` is the one thing every one of them already funnels through
    if (source.home === RULESET_HOME.BROWSER) {
      useConfigStore.setState({ localSummary: summaryOf(updated) });
    }
  } catch (error) {
    useUIStore.getState().reportStorageFailure(error);
    // Nothing reached disk, so nothing should reach state either. The `?? updated` case is the
    // first write of a brand-new ruleset, where there is no previous state to fall back to —
    // holding it in memory beats dropping the User back onto an empty dashboard, and the banner
    // says it is unsaved.
    //
    // Only the **local** path can reach here: `persistRuleset` writes LocalStorage synchronously
    // and lets `storage.ts`'s throw out, while every server refusal arrives as an outcome.
    return useConfigStore.getState().config ?? updated;
  }

  return updated;
}

/**
 * Act on what a save came back as (TICKET-RUL-02)
 *
 * The local path resolves `saved` and there is nothing to do. The account path has three answers
 * worth acting on, and each is handled where it can be handled once:
 *
 * - **saved** — adopt the revision the server actually stored, so the next save states the right
 *   base. Adopting anything else here is how a client talks itself into a conflict.
 * - **conflict** — the User's edit stays exactly where it is and a banner appears (v3 Req 33.8).
 * - **failed** — the same, with what the server refused.
 *
 * @param outcome What `rulesetSync` reported
 */
/**
 * What the browser's row on `/rulesets` needs to know about the local ruleset
 *
 * Not a derived *value* in the engine's sense — it is a copy of two fields, kept so the local row
 * can still be drawn while the **account's** ruleset is the one in `config`. Before RUL-02 that
 * distinction did not exist, so the row read `config` and was right by construction; now reading
 * `config` would show the account's name under a heading saying *This browser*.
 */
function summaryOf(config: Configuration | null): LocalSummary | null {
  return config ? { name: config.name, updatedAt: config.updatedAt } : null;
}

/**
 * Point the store at the browser's home, cancelling anything queued for the Account
 *
 * Every action that replaces `config` with something that is by definition *this browser's* calls
 * this first — a fresh ruleset, a load, an import, a discard. Without it, doing any of those with an
 * account ruleset open would send the result to the Account: `autoSave` reads `source`, and `source`
 * would still be pointing there.
 */
function toLocalHome(): void {
  cancelPendingSaves();
  useConfigStore.setState({ source: LOCAL_SOURCE });
}

/**
 * A bug inside the save-outcome handling, rather than a refusal
 *
 * `persistRuleset` resolves rather than rejecting for everything a server can say, so anything
 * arriving here is ours. Logged rather than silently swallowed: without the `catch` it would be an
 * unhandled rejection with no banner and no console entry naming this path.
 */
function reportSaveCrash(error: unknown): void {
  console.error('[configStore] save outcome could not be handled', error);
}

function reportSaveOutcome(outcome: SaveOutcome): void {
  const { source } = useConfigStore.getState();

  // **Whose save was that?** A request already on the wire cannot be aborted, so a save for the
  // ruleset that *was* open can resolve after another one has been opened. Adopting its revision
  // onto whatever is open now would point the new ruleset at the old one's number and manufacture a
  // conflict on its next save — so an outcome for a ruleset nobody is editing any more is dropped.
  const isForOpenRuleset =
    outcome.rulesetId === undefined ||
    (source.home === RULESET_HOME.ACCOUNT && source.id === outcome.rulesetId);

  if (!isForOpenRuleset) return;

  if (outcome.outcome === SAVE_OUTCOME.SAVED) {
    if (source.home === RULESET_HOME.ACCOUNT && outcome.revision !== undefined) {
      useConfigStore.setState({ source: { ...source, revision: outcome.revision } });
    }

    // A save that landed *is* the resolution of a save that did not, unlike a full disk — so the
    // banner goes rather than sitting there claiming the change was lost until somebody dismisses it
    useUIStore.getState().dismissRulesetAlert();
    return;
  }

  useUIStore.getState().reportRulesetAlert({
    kind: RULESET_ALERT.SAVE_REFUSED,
    message: outcome.message,
    fields: outcome.outcome === SAVE_OUTCOME.FAILED ? outcome.fields : undefined,
  });
}

/**
 * Delete an entity only while nothing points at it (Concept 00 §6, TICKET-REF-02)
 *
 * The guard lives here rather than in the panels because an advisory check in the UI is a check
 * that can be bypassed — every route into a delete goes through the action. Characters count as
 * references, so the walker is given the character store's data; reading it here is what the
 * ticket's "the walker reads both stores, actions call it" note asks for, and the dependency runs
 * one way only (`characterStore` never reads this store).
 *
 * **It assumes the character store is hydrated**, which `RootLayout`'s `useAppHydration()` does
 * once per page load before any configuration route renders — an un-hydrated store would report
 * an empty character list and quietly weaken the guard's character half. When LocalStorage is
 * unavailable the shell renders `StorageNotice` instead of the routes, so no delete can reach
 * here in that state either.
 *
 * The removal is applied to the **display** form, so a formula naming the deleted entity keeps
 * its spelling and reports `Undefined variable: STR` rather than a bare id.
 *
 * @param kind - Which entity kind is being deleted
 * @param id - Its identifier — a code for skills, a type for equipment slots, an id otherwise
 * @param options - `force` deletes anyway
 * @param remove - Removes the entity from a configuration
 * @returns The references that blocked the delete; **empty means the entity was deleted**
 */
function guardedDelete(
  set: (partial: Partial<ConfigState>) => void,
  get: () => ConfigState,
  kind: ReferenceTargetKind,
  id: string,
  options: DeleteOptions | undefined,
  remove: (config: Configuration) => Configuration
): EntityReference[] {
  const { config } = get();
  if (!config) return [];

  const characters = useCharacterStore.getState().characters;
  const references = findReferences({ kind, id }, config, characters);

  if (references.length > 0 && !options?.force) {
    return references;
  }

  set({ config: autoSave(remove(config)) });
  return [];
}

/**
 * The entity already holding a value, or `undefined` when the slot is free
 *
 * @param entities - The collection the candidate is joining
 * @param selfId - The id of the entity being edited, which cannot collide with itself
 * @param candidateKey - The value being claimed, normalised the same way `keyOf` normalises
 * @param keyOf - How a stored entity's value is read for comparison
 */
function heldBy<T extends { id: string }>(
  entities: readonly T[],
  selfId: string | undefined,
  candidateKey: string,
  keyOf: (entity: T) => string
): T | undefined {
  return entities.find((entity) => entity.id !== selfId && keyOf(entity) === candidateKey);
}

/**
 * The flat formula space uppercases a stat's abbreviation, so `str` and `STR` are one slot
 *
 * `scopeFor` adds `stat.abbreviation.toUpperCase()`, which means the two would resolve to the same
 * reference no matter how they are stored. Comparing case-insensitively here is deliberately
 * stricter than the import check (which requires uppercase outright and then compares exactly) —
 * strictly stricter is the safe direction: the store can never persist something import refuses.
 */
function abbreviationKey(abbreviation: string): string {
  return abbreviation.trim().toUpperCase();
}

/**
 * Whether a stat write would take an id or an abbreviation another stat already holds
 *
 * @param config - The ruleset being written to
 * @param selfId - The stat being edited, or `undefined` for an addition
 * @param candidate - The fields being written; an absent key is not being changed
 * @returns The refusal, or `null` when the write may go through
 */
function statCollision(
  config: Configuration,
  selfId: string | undefined,
  candidate: { id?: string; abbreviation?: string }
): UniquenessRefusal | null {
  if (candidate.id !== undefined) {
    const owner = heldBy(config.stats, selfId, candidate.id, (stat) => stat.id);
    if (owner) {
      return {
        field: 'id',
        value: candidate.id,
        message: `A stat with this id already exists: "${owner.name}"`,
      };
    }
  }

  if (candidate.abbreviation !== undefined) {
    const key = abbreviationKey(candidate.abbreviation);
    const owner = heldBy(config.stats, selfId, key, (stat) => abbreviationKey(stat.abbreviation));
    if (owner) {
      return {
        field: 'abbreviation',
        value: candidate.abbreviation,
        message: `${key} is already used by "${owner.name}"`,
      };
    }
  }

  return null;
}

/**
 * Whether a constant write would take an id or a name another constant already holds
 *
 * A duplicate splits identity from value: the stored formula points at one constant's id while the
 * resolver reads the other's number (TICKET-CST-01). Names are compared exactly — they are
 * lowercase identifiers by the same rule the import enforces.
 *
 * @param config - The ruleset being written to
 * @param selfId - The constant being edited, or `undefined` for an addition
 * @param candidate - The fields being written; an absent key is not being changed
 * @returns The refusal, or `null` when the write may go through
 */
function constantCollision(
  config: Configuration,
  selfId: string | undefined,
  candidate: { id?: string; name?: string }
): UniquenessRefusal | null {
  const constants = config.constants ?? [];

  if (candidate.id !== undefined) {
    const owner = heldBy(constants, selfId, candidate.id, (constant) => constant.id);
    if (owner) {
      return {
        field: 'id',
        value: candidate.id,
        message: `A constant with this id already exists: "${owner.displayName}"`,
      };
    }
  }

  if (candidate.name !== undefined) {
    const owner = heldBy(constants, selfId, candidate.name, (constant) => constant.name);
    if (owner) {
      return {
        field: 'name',
        value: candidate.name,
        message: `A constant named ${candidate.name} already exists`,
      };
    }
  }

  return null;
}

/**
 * Whether a curve write would take an id or a name another curve already holds
 *
 * The `constants` rule for the same reason: a stored formula points at one curve's id while the
 * resolver reads the other's table.
 *
 * @param config - The ruleset being written to
 * @param selfId - The curve being edited, or `undefined` for an addition
 * @param candidate - The fields being written; an absent key is not being changed
 * @returns The refusal, or `null` when the write may go through
 */
function curveCollision(
  config: Configuration,
  selfId: string | undefined,
  candidate: { id?: string; name?: string }
): UniquenessRefusal | null {
  const curves = config.curves ?? [];

  if (candidate.id !== undefined) {
    const owner = heldBy(curves, selfId, candidate.id, (curve) => curve.id);
    if (owner) {
      return {
        field: 'id',
        value: candidate.id,
        message: `A curve with this id already exists: "${owner.displayName}"`,
      };
    }
  }

  if (candidate.name !== undefined) {
    const owner = heldBy(curves, selfId, candidate.name, (curve) => curve.name);
    if (owner) {
      return {
        field: 'name',
        value: candidate.name,
        message: `A curve named ${candidate.name} already exists`,
      };
    }
  }

  return null;
}

/**
 * Apply one engine edit to one curve and persist the result
 *
 * The shared body of the six grid actions (TICKET-CRV-03). The engine decides what the table
 * becomes; the store's job is to put it somewhere and save. An edit that does not apply — a key
 * already taken, a column that isn't there — comes back as the same curve and still saves, which
 * is a no-op write rather than a wrong one.
 *
 * Deliberately **not** rename-safe: none of these edits changes a spelling. Renaming a column
 * goes through `updateCurve`, which is, so the two paths stay separate.
 *
 * @param curveId - Which curve
 * @param edit - The engine function to apply, given the curve and the ruleset around it
 */
function editCurve(
  set: (partial: Partial<ConfigState>) => void,
  get: () => ConfigState,
  curveId: string,
  edit: (curve: Curve, config: Configuration) => Curve
): void {
  const { config } = get();
  if (!config) return;

  const curve = (config.curves ?? []).find((candidate) => candidate.id === curveId);
  if (!curve) return;

  const edited = edit(curve, config);
  const updated = autoSave({
    ...config,
    curves: (config.curves ?? []).map((candidate) =>
      candidate.id === curveId ? edited : candidate
    ),
  });
  set({ config: updated });
}

/**
 * Configuration store
 */
export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  isLoaded: false,
  source: LOCAL_SOURCE,

  localSummary: null,

  // Initialize empty configuration
  initializeConfig: (name: string) => {
    // A fresh ruleset is always this browser's. Without the switch, doing this with an account
    // ruleset open would `PUT` a brand-new empty ruleset over it.
    toLocalHome();

    const config = createFreshConfiguration(name);
    const saved = autoSave(config);
    set({ config: saved, isLoaded: true, localSummary: summaryOf(saved) });
  },

  // Load configuration from LocalStorage
  loadConfig: () => {
    toLocalHome();

    const config = loadConfiguration();
    set({ config, isLoaded: true, localSummary: summaryOf(config) });
  },

  openAccountRuleset: async (id: string) => {
    // Anything queued was aimed at the ruleset that is about to stop being open, and a write
    // against a revision nobody is holding any more is a write nobody asked for
    cancelPendingSaves();

    try {
      const opened = await fetchRuleset(id);

      set({
        config: opened.configuration,
        isLoaded: true,
        source: { home: RULESET_HOME.ACCOUNT, id: opened.id, revision: opened.revision },
      });

      return true;
    } catch (error) {
      // A **load** failure, not a refused save: nothing was being saved, and whatever was open is
      // still open. The banner picks its heading from the kind for that reason.
      useUIStore.getState().reportRulesetAlert({
        kind: RULESET_ALERT.LOAD_FAILED,
        message:
          error instanceof ApiError
            ? error.message
            : 'Could not open that ruleset. Check your connection and try again.',
      });

      return false;
    }
  },

  openSessionSnapshot: async (sessionId: string) => {
    // Anything queued was aimed at the ruleset that is about to stop being open — `openAccountRuleset`'s
    // reason, and it matters more here because what replaces it accepts no writes at all
    cancelPendingSaves();

    try {
      // Through `rulesetSync`, like every other ruleset read: that module owns *how* one is
      // fetched and this store owns what to do with it (RUL-02's own rule)
      const session = await fetchSessionSnapshot(sessionId);

      set({
        config: session.snapshot,
        isLoaded: true,
        source: { home: RULESET_HOME.SESSION, sessionId },
      });

      return true;
    } catch (error) {
      useUIStore.getState().reportRulesetAlert({
        kind: RULESET_ALERT.LOAD_FAILED,
        message:
          error instanceof ApiError
            ? error.message
            : 'Could not open that game’s rules. Check your connection and try again.',
      });

      return false;
    }
  },

  openLocalRuleset: () => {
    toLocalHome();

    try {
      const config = loadConfiguration();
      set({ config, isLoaded: true, localSummary: summaryOf(config) });
      return true;
    } catch (error) {
      // `loadConfiguration` throws on unreadable or incompatible stored data, and this is reached
      // from a click rather than from hydration. **The home has already been switched**, which is
      // the half that must not be skipped: a caller that navigated to Configuration mode anyway
      // would otherwise be editing the *account's* ruleset believing it was the browser's, and
      // every keystroke would `PUT`.
      useUIStore.getState().reportStorageFailure(error);
      return false;
    }
  },

  /**
   * Replace the whole configuration — what applying an import means
   *
   * The browser holds one configuration at a time, so an import discards the current one rather
   * than adding to a list. The caller is responsible for validating the incoming data and for
   * confirming with the User first; by the time this runs, the decision is made.
   *
   * **An import always lands in this browser** (TICKET-RUL-02), which is what it has always done
   * and is why the home is switched first. Without that, importing a file with an *account* ruleset
   * open would `PUT` the imported document straight over it — a ruleset destroyed by a button whose
   * label says it replaces "this ruleset", with no upload having been asked for. Putting a
   * `Configuration` on the Account is TICKET-IO-04's job and is a **create**, never an overwrite
   * (v3 Req 35.1).
   */
  replaceConfig: (config: Configuration) => {
    toLocalHome();

    const saved = autoSave(config);
    set({ config: saved, isLoaded: true, localSummary: summaryOf(saved) });
  },

  discardStoredData: () => {
    // Clearing the browser's storage is a statement about the browser's home, so the store has to
    // be *in* it afterwards — otherwise the next edit would `PUT` an emptied ruleset to the Account
    toLocalHome();

    clearAllData();
    // Loaded, and what was loaded is nothing — which is what lets the dashboard offer a fresh
    // ruleset rather than sitting on a spinner
    set({ config: null, isLoaded: true, localSummary: null });
    useCharacterStore.getState().resetCharacters();
  },

  /** Rename the current configuration; the export filename derives from this */
  renameConfig: (name: string) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({ ...config, name });
    set({ config: updated });
  },

  // Stats CRUD
  addStat: (stat: Stat) => {
    const { config } = get();
    if (!config) return null;

    const refusal = statCollision(config, undefined, stat);
    if (refusal) return refusal;

    const updated = autoSave({
      ...config,
      stats: [...config.stats, stat],
    });
    set({ config: updated });
    return null;
  },

  updateStat: (id: string, updates: Partial<Stat>) => {
    const { config } = get();
    if (!config) return null;

    const refusal = statCollision(config, id, updates);
    if (refusal) return refusal;

    const updated = autoSave(
      applyRenameSafely(config, (current) => ({
        ...current,
        // `undefined` clears rather than sticks: a User who empties `max` or `formula` is
        // making the stat unbounded or invested, and the key goes with it
        stats: current.stats.map((stat) =>
          stat.id === id ? mergeClearingAbsent(stat, updates) : stat
        ),
      }))
    );
    set({ config: updated });
    return null;
  },

  deleteStat: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'stat', id, options, (config) => ({
      ...config,
      stats: config.stats.filter((stat) => stat.id !== id),
    })),

  reorderStats: (orderedIds: string[]) => {
    const { config } = get();
    if (!config) return;

    const byId = new Map(config.stats.map((stat) => [stat.id, stat]));
    const named = orderedIds
      .map((id) => byId.get(id))
      .filter((stat): stat is Stat => stat !== undefined);
    // Anything the caller left out keeps its relative position, at the end — a partial list
    // reorders what it names rather than dropping the rest
    const namedIds = new Set(named.map((stat) => stat.id));
    const rest = config.stats.filter((stat) => !namedIds.has(stat.id));

    const updated = autoSave({
      ...config,
      stats: [...named, ...rest].map((stat, index) => ({ ...stat, order: index })),
    });
    set({ config: updated });
  },

  // Skills CRUD (Concept 02, TICKET-SKL-02)
  addSkill: (skill: Skill) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      skills: [...config.skills, skill],
    });
    set({ config: updated });
  },

  updateSkill: (id: string, updates: Partial<Skill>) => {
    const { config } = get();
    if (!config) return;

    // Renaming a skill re-spells every `skills.<name>` that points at it, the same way renaming a
    // stat does — the formulas hold the skill's id, so nothing has to chase the change
    const updated = autoSave(
      applyRenameSafely(config, (current) => ({
        ...current,
        skills: current.skills.map((skill) =>
          skill.id === id ? mergeClearingAbsent(skill, updates) : skill
        ),
      }))
    );
    set({ config: updated });
  },

  deleteSkill: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'skill', id, options, (config) => ({
      ...config,
      skills: config.skills.filter((skill) => skill.id !== id),
    })),

  // Material Categories CRUD
  addMaterialCategory: (category: MaterialCategory) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      materialCategories: [...config.materialCategories, category],
    });
    set({ config: updated });
  },

  updateMaterialCategory: (id: string, updates: Partial<MaterialCategory>) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      materialCategories: config.materialCategories.map((category) =>
        category.id === id ? { ...category, ...updates } : category
      ),
    });
    set({ config: updated });
  },

  deleteMaterialCategory: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'material-category', id, options, (config) => ({
      ...config,
      materialCategories: config.materialCategories.filter((category) => category.id !== id),
    })),

  // Materials CRUD
  addMaterial: (material: Material) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      materials: [...config.materials, material],
    });
    set({ config: updated });
  },

  updateMaterial: (id: string, updates: Partial<Material>) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      materials: config.materials.map((material) =>
        material.id === id ? { ...material, ...updates } : material
      ),
    });
    set({ config: updated });
  },

  deleteMaterial: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'material', id, options, (config) => ({
      ...config,
      materials: config.materials.filter((material) => material.id !== id),
    })),

  // Inlays CRUD (v4 systems/10, TICKET-INL-01)
  addInlay: (inlay: Inlay) => {
    const { config } = get();
    if (!config) return;

    // The editor states an unset `group` as an explicit `undefined`, which is how `updateInlay` is
    // told to *clear* one. On the way in there is nothing to clear, so the empty key is dropped
    // rather than stored — `addRace`'s rule (TICKET-RACE-03).
    const seeded = mergeClearingAbsent(inlay, {});

    // `inlays` is optional and absent means none, so the first family creates the array rather than
    // a fresh ruleset carrying an empty one — `constants`' rule (TICKET-CST-01)
    const updated = autoSave({
      ...config,
      inlays: [...(config.inlays ?? []), seeded],
    });
    set({ config: updated });
  },

  updateInlay: (id: string, updates: Partial<Inlay>) => {
    const { config } = get();
    if (!config) return;

    // `mergeClearingAbsent` because `group` is optional: clearing the Common/Precious heading in the
    // panel has to delete the key rather than store `""`, the way `updateStat` clears a bound
    const updated = autoSave({
      ...config,
      inlays: (config.inlays ?? []).map((inlay) =>
        inlay.id === id ? mergeClearingAbsent(inlay, updates) : inlay
      ),
    });
    set({ config: updated });
  },

  deleteInlay: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'inlay', id, options, (config) => ({
      ...config,
      inlays: (config.inlays ?? []).filter((inlay) => inlay.id !== id),
    })),

  // Items CRUD
  addItem: (item: Item) => {
    const { config } = get();
    if (!config) return;

    // The editor states an unset optional field as an explicit `undefined`, which is how
    // `updateItem` is told to *clear* one. On the way in there is nothing to clear, so the empty key
    // is dropped rather than stored — `addInlay`'s and `addRace`'s rule, owed here since
    // TICKET-ITEM-01 gave a template a `shop` and a `skillBonuses` vector to leave unset
    const seeded = mergeClearingAbsent(item, {});

    const updated = autoSave({
      ...config,
      items: [...config.items, seeded],
    });
    set({ config: updated });
  },

  updateItem: (id: string, updates: Partial<Item>) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      items: config.items.map((item) =>
        item.id === id ? mergeClearingAbsent(item, updates) : item
      ),
    });
    set({ config: updated });
  },

  deleteItem: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'item', id, options, (config) => ({
      ...config,
      items: config.items.filter((item) => item.id !== id),
    })),

  // Equipment Slots CRUD
  addEquipmentSlot: (slot: EquipmentSlot) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      equipmentSlots: [...config.equipmentSlots, slot],
    });
    set({ config: updated });
  },

  updateEquipmentSlot: (type: string, updates: Partial<EquipmentSlot>) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      equipmentSlots: config.equipmentSlots.map((slot) =>
        slot.type === type ? mergeClearingAbsent(slot, updates) : slot
      ),
    });
    set({ config: updated });
  },

  deleteEquipmentSlot: (type: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'equipment-slot', type, options, (config) => ({
      ...config,
      equipmentSlots: config.equipmentSlots.filter((slot) => slot.type !== type),
    })),

  // Equipment layout (TICKET-INV-03)
  setEquipmentLayout: (layout: EquipmentLayout) => {
    const { config } = get();
    if (!config) return;

    // Clamping is the store's job rather than the panel's: the panel is a pair of number inputs,
    // and "7 columns" arriving from a keystroke or a hand-edited import must land the same way
    const clamped = clampEquipmentLayout(layout);

    const updated = autoSave({
      ...config,
      equipmentLayout: clamped,
      // Shrinking is what makes a placement invalid, so pruning belongs in the same write — a
      // separate pass would leave a window where the stored grid and its placements disagree
      equipmentSlots: prunePlacements(config.equipmentSlots, clamped),
    });
    set({ config: updated });
  },

  placeEquipmentSlot: (type: string, placement: EquipmentSlotPlacement | null) => {
    const { config } = get();
    if (!config) return;

    const layout = config.equipmentLayout;

    // A cell that is not on the board is not a placement. Refusing here rather than clamping is
    // deliberate: clamping would drop the slot somewhere the User did not click.
    if (placement && (!layout || !isWithinLayout(placement, layout))) return;

    const target = placement ? cellKey(placement) : null;

    const updated = autoSave({
      ...config,
      equipmentSlots: config.equipmentSlots.map((slot) => {
        if (slot.type === type) {
          if (!placement) {
            const { placement: _cleared, ...rest } = slot;
            return rest;
          }
          return { ...slot, placement };
        }

        // One slot per cell. Whatever was standing on the target is turned out rather than hidden
        // under the newcomer, and lands in the unplaced list where the User can see it moved.
        if (target && slot.placement && cellKey(slot.placement) === target) {
          const { placement: _evicted, ...rest } = slot;
          return rest;
        }

        return slot;
      }),
    });
    set({ config: updated });
  },

  seedEquipmentLayout: () => {
    const { config } = get();
    if (!config || config.equipmentLayout) return;

    // A **copy** of the default, not the exported object: handing the module's own constant to a
    // ruleset would make every ruleset seeded in a session share one layout, and the day something
    // patches a grid in place they would all move together. `setEquipmentLayout` builds a new
    // clamped object every time, so this is latent rather than live — and closing it costs a spread
    // (TICKET-INV-04, which closed the same hazard class in `seedPlacementFor`).
    const seededSlots = seedPlacements(config.equipmentSlots);
    const updated = autoSave({
      ...config,
      equipmentLayout: { ...DEFAULT_EQUIPMENT_LAYOUT },
      equipmentSlots: seededSlots,
    });
    set({ config: updated });
  },

  // Races CRUD
  addRace: (race: Race) => {
    const { config } = get();
    if (!config) return;

    // A race arrives from the editor with its unstated identity fields explicitly `undefined` —
    // which is how `updateRace` is told to *clear* one (TICKET-RACE-03). On the way in there is
    // nothing to clear, so the empty keys are dropped rather than stored: an optional field is
    // absent or it has a value, never present-and-empty.
    const seeded = mergeClearingAbsent(race, {});

    const updated = autoSave({
      ...config,
      races: [...config.races, seeded],
    });
    set({ config: updated });
  },

  updateRace: (id: string, updates: Partial<Race>) => {
    const { config } = get();
    if (!config) return;

    // `mergeClearingAbsent` rather than a spread since TICKET-RACE-03 gave a race three optional
    // fields: clearing the creature type in the editor arrives as `type: undefined`, and a spread
    // would either keep the old value (if the key were omitted) or leave the key present and empty
    const updated = autoSave({
      ...config,
      races: config.races.map((race) =>
        race.id === id ? mergeClearingAbsent(race, updates) : race
      ),
    });
    set({ config: updated });
  },

  deleteRace: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'race', id, options, (config) => ({
      ...config,
      races: config.races.filter((race) => race.id !== id),
    })),

  // The creature reference lists (v4 systems/14, TICKET-RACE-03)
  setCreatureSizes: (sizes: string[]) => {
    const { config } = get();
    if (!config) return;

    // Absent means none and stays absent — the `constants`/`curves` treatment — so emptying the
    // list in the panel gives back the ruleset that never had one rather than one carrying `[]`
    const stored = emptyToAbsent(sizes);
    const patched = mergeClearingAbsent(config, { creatureSizes: stored });

    const updated = autoSave(patched);
    set({ config: updated });
  },

  setCreatureTypes: (types: string[]) => {
    const { config } = get();
    if (!config) return;

    const stored = emptyToAbsent(types);
    const patched = mergeClearingAbsent(config, { creatureTypes: stored });

    const updated = autoSave(patched);
    set({ config: updated });
  },

  // Archetypes CRUD (Concept 03, TICKET-ARC-01)
  addArchetype: (archetype: Archetype) => {
    const { config } = get();
    if (!config) return;

    // `archetypes` is optional and absent means none, so the first one creates the array rather
    // than a fresh ruleset shipping an empty one — the treatment `constants` and `curves` get
    const updated = autoSave({
      ...config,
      archetypes: [...(config.archetypes ?? []), archetype],
    });
    set({ config: updated });
  },

  updateArchetype: (id: string, updates: Partial<Archetype>) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      archetypes: (config.archetypes ?? []).map((archetype) =>
        archetype.id === id ? { ...archetype, ...updates } : archetype
      ),
    });
    set({ config: updated });
  },

  deleteArchetype: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'archetype', id, options, (config) => ({
      ...config,
      archetypes: (config.archetypes ?? []).filter((archetype) => archetype.id !== id),
    })),

  // Currency Tiers CRUD
  addCurrencyTier: (tier: CurrencyTier) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      currencyTiers: [...config.currencyTiers, tier],
    });
    set({ config: updated });
  },

  updateCurrencyTier: (id: string, updates: Partial<CurrencyTier>) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      currencyTiers: config.currencyTiers.map((tier) =>
        tier.id === id ? { ...tier, ...updates } : tier
      ),
    });
    set({ config: updated });
  },

  deleteCurrencyTier: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'currency-tier', id, options, (config) => ({
      ...config,
      currencyTiers: config.currencyTiers.filter((tier) => tier.id !== id),
    })),

  // Constants CRUD
  addConstant: (constant: Constant) => {
    const { config } = get();
    if (!config) return null;

    const refusal = constantCollision(config, undefined, constant);
    if (refusal) return refusal;

    const updated = autoSave({
      ...config,
      constants: [...(config.constants ?? []), constant],
    });
    set({ config: updated });
    return null;
  },

  updateConstant: (id: string, updates: Partial<Constant>) => {
    const { config } = get();
    if (!config) return null;

    const refusal = constantCollision(config, id, updates);
    if (refusal) return refusal;

    const updated = autoSave(
      applyRenameSafely(config, (current) => ({
        ...current,
        constants: (current.constants ?? []).map((constant) =>
          constant.id === id ? { ...constant, ...updates } : constant
        ),
      }))
    );
    set({ config: updated });
    return null;
  },

  deleteConstant: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'constant', id, options, (config) => ({
      ...config,
      constants: (config.constants ?? []).filter((constant) => constant.id !== id),
    })),

  // Curves CRUD
  addCurve: (curve: Curve) => {
    const { config } = get();
    if (!config) return null;

    const refusal = curveCollision(config, undefined, curve);
    if (refusal) return refusal;

    const updated = autoSave({
      ...config,
      curves: [...(config.curves ?? []), curve],
    });
    set({ config: updated });
    return null;
  },

  updateCurve: (id: string, updates: Partial<Curve>) => {
    const { config } = get();
    if (!config) return null;

    const refusal = curveCollision(config, id, updates);
    if (refusal) return refusal;

    const updated = autoSave(
      applyRenameSafely(config, (current) => ({
        ...current,
        curves: (current.curves ?? []).map((curve) =>
          curve.id === id ? { ...curve, ...updates } : curve
        ),
      }))
    );
    set({ config: updated });
    return null;
  },

  deleteCurve: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'curve', id, options, (config) => ({
      ...config,
      curves: (config.curves ?? []).filter((curve) => curve.id !== id),
    })),

  addCurveColumn: (curveId: string, column: CurveColumn) =>
    editCurve(set, get, curveId, (curve) => addColumnToCurve(curve, column)),

  deleteCurveColumn: (curveId: string, columnId: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'curve-column', columnId, options, (config) => ({
      ...config,
      curves: (config.curves ?? []).map((curve) =>
        curve.id === curveId ? removeCurveColumn(curve, columnId) : curve
      ),
    })),

  addCurveRow: (curveId: string, key: number) =>
    editCurve(set, get, curveId, (curve) => addRowToCurve(curve, key)),

  deleteCurveRow: (curveId: string, key: number) =>
    editCurve(set, get, curveId, (curve) => removeCurveRow(curve, key)),

  setCurveCell: (curveId: string, key: number, columnName: string, value: number) =>
    editCurve(set, get, curveId, (curve) => setCurveCellValue(curve, key, columnName, value)),

  clearCurveOverride: (curveId: string, key: number, columnName: string) =>
    editCurve(set, get, curveId, (curve, config) =>
      clearCurveOverrideCell(curve, key, columnName, config)
    ),

  regenerateCurve: (id: string) => {
    const empty: RegenerationReport = { written: 0, kept: 0, errors: [] };

    const { config } = get();
    const curve = (config?.curves ?? []).find((candidate) => candidate.id === id);
    if (!config || !curve) return empty;

    // The engine decides what the table becomes and reports what it did; the store's job is to
    // put the result somewhere and persist it
    const { curve: regenerated, report } = regenerateCurveTable(curve, config);

    const updated = autoSave({
      ...config,
      curves: (config.curves ?? []).map((candidate) =>
        candidate.id === id ? regenerated : candidate
      ),
    });
    set({ config: updated });

    return report;
  },

  // Dice Ladders CRUD (Concept 07, TICKET-ROLL-03)
  addDiceLadder: (ladder: DiceLadder) => {
    const { config } = get();
    if (!config) return;

    // Optional and absent-means-none, like `constants`, `curves` and `archetypes`: the first
    // ladder creates the array rather than a fresh ruleset shipping an empty one
    const updated = autoSave({
      ...config,
      diceLadders: [...(config.diceLadders ?? []), ladder],
    });
    set({ config: updated });
  },

  updateDiceLadder: (id: string, updates: Partial<DiceLadder>) => {
    const { config } = get();
    if (!config) return;

    // `maxPerDie` is optional, so clearing the cap has to remove the key rather than store
    // `undefined` — the same merge every optional-field editor uses
    const updated = autoSave({
      ...config,
      diceLadders: (config.diceLadders ?? []).map((ladder) =>
        ladder.id === id ? mergeClearingAbsent(ladder, updates) : ladder
      ),
    });
    set({ config: updated });
  },

  deleteDiceLadder: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'dice-ladder', id, options, (config) => ({
      ...config,
      diceLadders: (config.diceLadders ?? []).filter((ladder) => ladder.id !== id),
    })),

  // Roll Definitions CRUD (Concept 08, TICKET-ROLL-05)
  addRollDefinition: (roll: RollDefinition) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      rollDefinitions: [...(config.rollDefinitions ?? []), roll],
    });
    set({ config: updated });
  },

  updateRollDefinition: (id: string, updates: Partial<RollDefinition>) => {
    const { config } = get();
    if (!config) return;

    // `category` is optional, so clearing it removes the key rather than storing `undefined`
    const updated = autoSave({
      ...config,
      rollDefinitions: (config.rollDefinitions ?? []).map((roll) =>
        roll.id === id ? mergeClearingAbsent(roll, updates) : roll
      ),
    });
    set({ config: updated });
  },

  deleteRollDefinition: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'roll-definition', id, options, (config) => ({
      ...config,
      rollDefinitions: (config.rollDefinitions ?? []).filter((roll) => roll.id !== id),
    })),
}));
