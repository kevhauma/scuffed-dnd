---
name: data-model
description: Persistence and data-shape reference for Custom DnD Builder — the Configuration and Character types, LocalStorage keys, derived vs. stored values, import/export validation, and the rules for changing a persisted shape. Use when adding or changing an entity, writing a store action, or planning a data migration.
---

# Data Model (TypeScript types + LocalStorage)

**Signed out there is no database and no backend**, and that path is not going away
([D6](../../../docs/v3.0_backend/overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)).
Two JSON blobs in LocalStorage hold everything, and the
type definitions in [src/shared/types/](../../../src/shared/types/) are the schema. Read
[config.ts](../../../src/shared/types/config.ts) and [character.ts](../../../src/shared/types/character.ts)
directly — this skill covers the rules, not a copy of the fields.

The types live in `shared/` since TICKET-DX-07 because they are the **Kernel**: one definition of
a persisted shape, imported as `#shared/types/config` by the client *and*, since TICKET-SRV-01, by
`src/server/`. Everything about persistence below is the *local-mode* story, and v3.0's D6 keeps it
exactly as it is — LocalStorage stays the source of truth for a signed-out browser, not a cache and
not a staging area.

**Signed in, a second home appears.** Since TICKET-DB-01 there is a SQLite file at `DATABASE_URL`
holding the server's own model. A server-stored Ruleset is the *same* `Configuration` shape kept as
a JSON document, with `schemaVersion` and `revision` as real columns
([D4](../../../docs/v3.0_backend/overview.md#d4--a-ruleset-is-stored-as-a-json-document-not-normalised)).
TICKET-RUL-01/02 add the records and routes. There is **no sync** between the two homes and no
background copying — an edit saves to whichever one is open, and uploading is an explicit,
repeatable copy. Nothing below changed when that arrived.

**TICKET-IO-04 built that copy, and it is a copy in the strict sense**: `POST /api/rulesets/import`
takes a document (from a file, or read out of this browser's keys) and **creates** a Ruleset, never
overwrites one. Both LocalStorage keys are byte-identical afterwards, which
`client/services/rulesetUpload.test.ts` asserts by comparing the raw strings rather than by counting
requests. Two consequences for the shapes below:

- **A `character` row may now belong to no Game_Session.** `character.session_id` became nullable in
  migration `0003_uploaded_characters`, because an uploaded character was built against a *local*
  ruleset and there is no Snapshot for it to be valid against. `session_id IS NULL` means *at no
  table*, and `requireCharacterWriter` reads it as *only the owner may write to this one*.
  TICKET-CHAR-04 decides whether one can later be brought into a session.
- **Every uploaded character's `configurationId` is rewritten** to the ruleset the import just
  created, and its `id` is reminted — otherwise the same roster uploaded twice would collide on a
  primary key, and every copy would point at a ruleset that exists only in somebody's browser.

Whether a stored character can be read at all is one rule in one place since IO-04:
[`shared/services/characterShape.ts`](../../../src/shared/services/characterShape.ts). The browser
asks it on load (`loadCharacters` refuses a roster rather than dropping records — CR-05) and the
server asks it on upload.

**A third home arrived with TICKET-GAM-01, and it is a *copy* rather than a reference.** A
Game_Session stores a **Snapshot**: the whole `Configuration` as it stood when the session was
created ([D7](../../../docs/v3.0_backend/overview.md#d7--a-game-session-plays-against-a-pinned-snapshot)).
Three things follow, and the first is the one to hold on to:

- **Editing a Ruleset never changes a running game.** Nothing in `src/server/` loads a Ruleset by a
  session's `ruleset_id` to evaluate a rule; `sessionPayloads.snapshotOf` reads the pinned column and
  is the only way a session's rules are obtained. `game_session.ruleset_id` is provenance — *this
  table came from that ruleset* — and is `ON DELETE SET NULL`, so deleting the ruleset leaves the
  game playable and merely anonymous about where it came from.
- **Pulling the ruleset's current state in is a deliberate act that can be refused.**
  `POST /api/sessions/:id/snapshot` compares every character at the table against the candidate and
  refuses when one would **break** (v3 Req 37.6), naming the character and what broke. Validity is
  `validateStatAllocation`'s answer, not a second definition — and since TICKET-RES-05 the check is
  a **comparison**: a character the *currently pinned* Snapshot already refuses does not block, since
  they are broken either way and refusing on their account would freeze the table against every
  candidate, the fixing one included. Every arm of the verdict has a sentence
  (`snapshotConflicts.ts`'s `allocationReason`); an arm without one renders a reason that stops at
  its own colon, which is how the overspend arm was found.
- **Storing a whole ruleset per table is accepted duplication**, and the alternative (a
  content-addressed ruleset-version table) is a versioning system the milestone put out of scope.

**TICKET-GAM-02 needed no migration**, which is worth recording as the shape of a well-sized ticket
rather than as luck: `session_invite` and `session_member` were both in DB-01's schema and unused,
so the whole feature is rows in existing tables. Two properties of those rows are enforced by the
database rather than by code and must not be re-implemented above it — **one live invite per
session** (issuing revokes-then-inserts in a single transaction, so reissuing is what retires the
previous code) and **one membership row per (session, account)**, which is what lets
`seatSessionMember` be `ON CONFLICT DO NOTHING` plus a read-back and makes a double-clicked invite
link idempotent by constraint. An invite code is never written into a document; it is a column, and
`game_session.snapshot` knows nothing about it.

**TICKET-GAM-03 did need one, and it is the smallest kind**: `session_invite.code` became
**nullable** (`0004_addressed_invites`). One table now holds two kinds of row and every query says
which it means — a *shared door* has a `code` and `email IS NULL`, an *addressed letter* has an
`email` and `code IS NULL`. That is not tidiness: a `NULL` code makes *this invitation is not
redeemable by code* true of the **row** rather than true of whichever lookups happen to filter it
out, and SQLite counts `NULL`s as distinct so the unique index on `code` is untouched. Two rules
follow, and neither may be re-derived elsewhere:

- **The five invite states are derived from four timestamps** — `revoked_at`, `declined_at`,
  `redeemed_at` and `expires_at` versus the clock — by `routes/invitations/invitationPayloads.ts`.
  There is deliberately no `state` column: a stored copy is the one that goes stale, which is the
  same rule the character's level rests on.
- **A settle write only lands on a pending row.** Accepting, declining and revoking all go through
  one statement whose `WHERE` carries the pending condition, so the loser of any race updates
  nothing rather than overwriting somebody's answer — and a declined invitation keeps saying
  `declined` even after the DM revokes it, because *they turned you down* is the more useful of the
  two facts.

**TICKET-GAM-04 needed no migration either, and its rule is about rows that are *not* deleted.**
Removing a Member — or a Member leaving; they are one act — deletes one `session_member` row and
**nothing else**. Their Characters keep both `session_id` and `owner_account_id`, which is what
makes them readable by the remaining Members, writable by nobody (`requireCharacterWriter` checks
the *owner's* membership, not only the caller's), and writable again the moment that Account
rejoins, with nothing to repair. Do not reassign character ownership on removal: the whole property
rests on ownership never moving. Transferring the DM role writes `session_member.role` on two rows
**and** `game_session.dm_account_id` in one transaction — the membership is the authority and the
column is the mirror, and a listing that read a stale mirror would name the wrong DM.

**TICKET-CHAR-04 needed one, and it is the shape of a state that was only half recorded.**
`character.ruleset_id` (migration `0005_uploaded_character_ruleset`) with `ON DELETE CASCADE`.
**Exactly one of `session_id` and `ruleset_id` is set**: a session character plays by a Snapshot and
names no ruleset, an uploaded one names a ruleset and sits at no table. Before it, which ruleset an
uploaded character belonged to lived only in `data.configurationId` — inside a document, which the
server may not query on (D4) and which nothing could cascade from, so deleting the ruleset left
invisible rows forever. Two things follow:

- **`drizzle-kit` cannot generate this one.** It emits the `ALTER TABLE … ADD` without the
  `ON DELETE cascade`, which reads correctly in `schema.ts` and does nothing in the database. The
  SQL is hand-written and the migration test deletes a ruleset and counts rows.
- **A new character's shape is the Kernel's**, in `shared/services/characterCreation.ts`:
  `buildCharacter` seeds `currentResourceValues` from the Snapshot's maxima and sets `experience` to
  0, and both the browser's store and `POST /api/sessions/:id/characters` call it. Neither restates
  it. `characterCreationErrors` beside it is the *wizard's and the server's* rule set — the store
  keeps its own two narrower refusals, deliberately, so local mode is unchanged.

Two consequences worth holding on to before changing a persisted shape:

- **A document change is not a migration.** Adding `grantedStatPoints` (DM-01), `purse` (CUR-02),
  `dreamLevel` (RES-04), `focusSkillIds` (SKL-05) or `learnedSpellIds` (SPL-02)
  changes what is *inside* `character.data` and `ruleset.data`, which are `TEXT` columns. The rules
  in *Changing a persisted shape* below are the ones that apply — not a SQL file.

  **Whether it also needs a `SUPPORTED_SCHEMA_VERSION` bump is a separate question, and CUR-02 is
  the worked example of answering it *no*.** The version gates the **`Configuration`**: a bump makes
  `loadConfiguration` refuse a ruleset that did not change, so `IncompatibleDataNotice` replaces the
  routes and `loadCharacters` never runs. That is right when a build would otherwise *crash on a
  field that moved* — and wrong when the change ships a conversion, because the bump refuses to read
  the very data the conversion exists to keep. Bump **or** migrate; a change cannot do both. Say
  which, and why, in the ticket.
- **A schema change is forward-only and ships a test.** `src/server/db/schema.ts` describes the
  normalised half — ownership, membership, invites, events. Edit it, run `yarn run db:generate`,
  and land the generated SQL with a test that applies it to the previous schema
  ([`migrate.test.ts`](../../../src/server/db/migrate.test.ts) is the pattern). There are no `down`
  files; recovery is the backup.

## Storage

| Key | Holds | Written by |
|---|---|---|
| `dnd_builder_config` | one `Configuration` object | `saveConfiguration()` ← `useConfigStore` |
| `dnd_builder_characters` | `Character[]` | `saveCharacters()` ← `useCharacterStore` |
| `better-auth.message` | a cross-tab ping: `{event, data:{trigger}, clientId, timestamp}` | **Better Auth's client**, on sign-out and profile updates (TICKET-AUTH-01) |

**The app writes two keys; the third is the library's** and is not ours to manage. It carries **no
identity** — the Auth_Session is an `HttpOnly` cookie that no client-side code can read (v3 Req
30.4), and this is only a nudge telling other tabs to re-ask the server who is signed in.
`clearAllData()` deliberately does not touch it: clearing the app's data is not signing out, and
signing out is a server-side invalidation rather than a key to delete.

**One exception to *no client-side code can read it*, added knowingly by TICKET-AUTH-04.** The
`/account` page lists an Account's active sessions and offers to end one, and Better Auth's
`revokeSession({ token })` names a session by its **token** — so `/list-sessions` returns those
tokens and the page holds them in React state for as long as it is open. Nothing is persisted and
the *current* session's cookie is still unreadable, but an XSS on `/account` could exfiltrate every
device's session token. Accepted rather than worked around: the alternative is a bespoke
revoke-by-id endpoint, which is a ticket rather than a line, and the exposure is bounded by the
same 90-day ceiling everything else is.

`dnd_builder_ui_state` was defined and cleared by `clearAllData()` while nothing ever wrote it;
CR-39 removed it. `useUIStore` is entirely in-memory — open dialogs, the active mode and roll
history all end with the tab. Persisting any of that adds a key in the same change as the code that
writes it.

**One tab at a time, by decision** (CR-43). Nothing listens for the `storage` event, so two tabs
each hydrate once at load and then last-write-wins on every action: the second tab's next edit
persists its whole in-memory ruleset over whatever the first tab wrote. That is accepted for a
single-user browser app rather than overlooked — making it safe means a `storage` listener that
rehydrates both stores, and that is a ticket, not a footnote.

All access goes through [src/client/services/storage.ts](../../../src/client/services/storage.ts). It wraps
`JSON.stringify`/`parse` and normalizes failures into `StorageError`, `StorageQuotaError`, and
`StorageParseError`. **Components, hooks, and engine code never touch `localStorage` directly,
and never call the storage service directly either** — they go through the store, which persists
as part of the action. That is the equivalent of a repository layer here.

**Since TICKET-RUL-02 the store has a second destination, and the rule above is unchanged.**
`useConfigStore.source` says which home the open ruleset lives in, and
[`services/rulesetSync.ts`](../../../src/client/services/rulesetSync.ts) is the only module that
decides where a save goes: the browser home writes `saveConfiguration` exactly as before (a
synchronous write whose throw the action still catches and rolls back), and the account home sends a
debounced `PUT` guarded by `revision`. A server refusal does **not** roll the edit back — it becomes
`useUIStore.saveConflict` with the edit still on screen, because a conflict means somebody else's
change also exists rather than that this one cannot be kept (v3 Req 33.8).

## Configuration (the ruleset)

One `Configuration` per browser — **and many per Account** (TICKET-RUL-01). The browser still holds
exactly one, in `dnd_builder_config`, and that is what keeps local mode identical to v2.0; an
Account holds as many rows as it likes in the server's `ruleset` table, each with the same
`Configuration` as its `data` document (D4). The two homes are shown side by side at `/rulesets` and
there is no sync between them —
[`useRulesetManager`](../../../src/client/components/rulesets/useRulesetManager.ts) is where the
local half and the account half meet without touching. **A new ruleset is seeded identically in both
homes**, by
[`createFreshConfiguration`](../../../src/shared/services/freshConfiguration.ts) in the Kernel, which
both `useConfigStore.initializeConfig` and `POST /api/rulesets` call (v3 Req 33.3).

A `Configuration` is: id, name, version, **`schemaVersion: 10`** (raised from 9 by TICKET-INV-05,
which is v4.0's one bump — see the clean-break section below), timestamps,
plus the entity arrays — `stats`, `skills`,
`materials`, `materialCategories`, `items`, `equipmentSlots`, `races`,
`currencyTiers`, the optional `constants` (TICKET-CST-01), `curves` (TICKET-CRV-01),
`archetypes` (TICKET-ARC-01), `diceLadders` (TICKET-ROLL-03), `rollDefinitions`
(TICKET-ROLL-05), `inlays` (TICKET-INL-01) and `spells` (TICKET-SPL-01) — plus the two **word
lists** `creatureSizes` and
`creatureTypes` (TICKET-RACE-03), which are `string[]` rather than entity arrays and are described
under `Race` below.

**`Skill` is the sheet's Skill since TICKET-SKL-02**: `{ id, name, description, statWeights:
[{ statId, weight }], category? }`. It replaced v1's `SpecialitySkill` outright — no `code`, no
`maxBaseLevel`, no `bonusFormula`. The arithmetic is not per-skill any more: `level = ceil(Σ(weight ×
stat value) × focus) + invested` and `bonus = ceil(level / const.bonus_divider)` live once, in
[skillCalculator.ts](../../../src/shared/engine/calculators/skillCalculator.ts), so a global rebalance is
one constant rather than 48 formula edits. A weight row names a stat by **id**, so a rename cannot
orphan it, and a formula reaches a skill as `skills.<name-slug>` (`.bonus` for the integer).

`constants?: Constant[]` is the worked example of an optional field done right, and the pattern to
copy: **absent means none and stays absent**, so a ruleset written before TICKET-CST-01 round-trips
without growing an empty array; every reader writes `config.constants ?? []`.

**A field that is retired is refused, not ignored** (TICKET-RES-02). `RETIRED_FIELDS` in
[importExport.ts](../../../src/shared/services/importExport.ts) maps each removed key to what replaced it,
and `validateConfigurationShape()` errors when an imported file still carries one — importing a ruleset
that plays differently from the one the User exported is worse than refusing it. Add to that map
when you delete a persisted field, and bump `SUPPORTED_SCHEMA_VERSION` in the same change.

**A field retired from an *entity* goes on that collection's `EntitySpec.retired`** (TICKET-INV-05)
— the same sentence one level down, keyed by field name and reported as `items[0].materialId is no
longer a field — <replacement>`. It lives beside the fields that took the job over rather than in the
configuration-level map, and it is walked by `collectionShapeErrors`, which was already walking the
entries; a second pass over the same collections would be a second place to forget one. The worked
example is `items.retired`, which names the fused `materialId` / `materialLevel` pair.

The same rule applies inside an entity. `updateStat` merges through `mergeClearingAbsent`
(TICKET-STAT-02), so a patch setting `min`, `max` or `formula` to `undefined` **deletes** the key
rather than leaving it present-and-empty — a User who clears a bound gets an unbounded stat, not
a phantom one. Copy that when an update action can clear an optional field.

**`Stat.order` is written by `reorderStats(orderedIds)`, never by hand.** It rewrites the stored
array *and* renumbers `order` from each position, so the two can never disagree for anything the
store wrote. Reordering changes no value; references are by id (Concept 01).

**Nothing outside the store guarantees that, though**, so the display hooks sort defensively:
`useStatManager`, `useCharacterSheet` and `useCharacterCreation` each read
`[...stats].sort((a, b) => a.order - b.order)` and hand the result down (TICKET-STAT-03). An
imported JSON file only has to satisfy the shape check — `order` must be a number, not a number
agreeing with its array position — so `order` is the field that decides, and a hand-edited export
displays the way it reads rather than the way it happens to be stored. **Sort in the hook, never in
a component**: the two consumers of the ordered list (`SkillAllocationStep`, `ReviewStep`) take it
as a prop.

**`Archetype` is what a character is good at growing** (Concept 03, TICKET-ARC-01):
`{ id, name, description, statAffinity: Record<statId, StatAffinity> }` on the optional
`Configuration.archetypes`, with `Character.archetypeId?` pointing at one. The three affinity values
are not a scale the app interprets — they are **column names in the `point_buy` curve**, which is
what makes "flatten the archetype advantage" a table edit. They also name how **Dream level** enters
the gain (`main × dream`, `sub + dream`, `non` untouched — TICKET-ARC-04), which is why they are a
const object (`STAT_AFFINITY` in [types/config.ts](../../../src/shared/types/config.ts)) rather than
a bare union: the engine spells two of them in code now. Two rules, both load-bearing:

- **`non` is absence.** A tagging is stored **sparsely** and a stat missing from the record reads
  `non`. A stored `non` would count as a reference and make `deleteStat` refuse for every stat every
  archetype had ever been saved over — the trap `Race.statValues` avoids by pruning zeros. The
  validator *reports* the defaulting as a warning rather than letting it happen silently.
- **Every affinity in use needs a `point_buy` column**, `non` always included (a stat added later
  defaults to it). A missing one is a config-level **error**: without the column there is nothing to
  route a spent point through.

**Adding a purely optional field does not need a `SUPPORTED_SCHEMA_VERSION` bump.** RACE-01's
"bump on every reshape" is about a build *crashing on a field that moved*; an additive optional key
is readable by both builds, so `archetypes?` and `archetypeId?` shipped at version 7, and
`diceLadders?` at version 8. Bump when a field moves or is removed.

**`DiceLadder` is how a number becomes a pool** (Concept 07, TICKET-ROLL-03):
`{ id, name, description, dieSizes: number[], maxPerDie?, showZeroTerms, remainder: 'flat' }` on the
optional `Configuration.diceLadders`. Four things to know:

- **`dieSizes` is arbitrary and strictly descending** — a d100 is data. Descending is what makes the
  greedy walk in [diceLadder.ts](../../../src/shared/engine/dice/diceLadder.ts) mean anything, so
  `engine/validator.ts` errors on a ladder that is not, on a non-positive size, and on a
  `maxPerDie` that would allow no dice. A large smallest die is *information*, not a defect.
- **`name` is free text, not an identifier.** Unlike a constant or a curve, a ladder is never
  spelled in a formula — a roll definition points at one by id (Concept 08, TICKET-ROLL-05) — so it
  is outside `references.ts` entirely.
- **`remainder` is an enum of one.** A file claiming `smallest_die` is refused rather than silently
  read as `flat`. The delete shipped **unguarded** and was guarded by TICKET-ROLL-05, which brought
  the first thing that can point at a ladder — a guard with no possible referrer can never fire.
- `DiceConfig` and `CombatSkill` are **gone** (TICKET-ROLL-06), and with them `rollDice`,
  `DIE_SIDES` and `formatDiceNotation`. A pool is derived from a character now, never typed.

**`RollDefinition` is a named, rollable line** (Concept 08, TICKET-ROLL-05):
`{ id, name, description, input, ladderId, category?, order }` on the optional
`Configuration.rollDefinitions`. It replaced `CombatSkill` outright in ROLL-06, and the difference is the
whole point: a combat skill hand-types six dice counts and bolts a formula on as a flat bonus; a
roll *derives* its pool by feeding `input` down `ladderId`.

- **`input` is user-authored formula text** at the `roll-input` attachment point — a row in
  `scoping.ts`, sharing a derived stat's namespaces (`stats` / `skills` / `const` / `curve`) and its
  stat abbreviations, because a roll is another reading of the character. It round-trips through
  `references.ts` like every other formula, so renaming a stat re-spells every roll reading it.
- **A roll is a leaf.** Nothing can name one: there is no `rolls` namespace (a roll produces dice,
  and a formula carries no randomness), and history is session state in `useUIStore`. So
  `deleteRollDefinition` is guarded but always succeeds, and a roll input cannot be in a cycle.
- **A fresh ruleset seeds four rolls with `input: '0'`**, not the stat expressions Concept 08 shows.
  A new configuration has no stats, so those would name missing members and open with four errors;
  the descriptions say what the sheet reads and the corpus carries the real expressions. Copy that
  when seeding anything whose formula references entities a fresh ruleset does not have.

**`Inlay` is a gem family, and the shape mirrors `Material`** (TICKET-INL-01, v4 systems/10):
`{ id, name, description, group?, tiers: [{ tier, bonuses: StatModifier[] }] }` on the optional
`Configuration.inlays`. The other ingredient a composed item is made of (systems/12), so it holds
the *same* `{ statId, modifier }` row a material tier holds, keyed by stat **id** — which means
`references.ts` translates neither and a rename cannot orphan one. Four rules:

- **A family may have a gap, and the shape says so by carrying the rung number on the row.** The
  sheet's Zircon has tiers 1–9 and a **blank** tenth, which is a gap rather than a zero: importable,
  selectable up to 9, the User's to fill, and reported by nothing. `Material.levels` already
  tolerates one for the same reason — a `MaterialLevel` carries its own `level` and nothing indexes
  the array by rung — so this is that property, not a new rule. **Nothing generates a tier**: 23 of
  the sheet's 25 families happen to be linear, but Obsidian is hand-authored across all ten rows,
  and linearity is a property the capture verified rather than one to impose.
- **No price and no per-tier name.** `MaterialLevel` has both because the *old* workbook named and
  priced every rung; the new one does neither for a gem
  ([v4 D5](../../../docs/v4.0_sheet_parity/overview.md#d5--what-is-deliberately-not-parity)).
- **`group?` is a free User string** — the sheet's *Common Gems* / *Precious Gems*. `Stat.group`'s
  rules exactly (TICKET-STAT-04): presentation only, validated against nothing, absent means
  ungrouped, and the panel's headings are the **distinct values present** rather than a list the app
  knows. `updateInlay` clears it through `mergeClearingAbsent` and `addInlay` runs the same cleaner,
  so an unstated heading is absent rather than `""`.
- **Additive-optional, so no `SUPPORTED_SCHEMA_VERSION` bump** — absent means none and stays absent,
  `constants`' rule. It is an `optional`-presence row in `ENTITY_SPECS`, and its tier ladder is a
  `custom` checker (`inlayTierShapeErrors`) because a nested array is what a field table cannot
  express. A tier's rung must be a whole number from 1 up and unique within the family; *contiguous*
  is deliberately not checked, since inventing that rule means inventing the missing row.

The **socket** that names a family — `inlayId` + `inlayLevel` — landed in TICKET-INV-05, on the
character's `ComposedItem` rather than on the item template (see *Composed items* under `Character`).
`dependencies.ts`'s `inlay` case walks it, so deleting a gem a Player has socketed is refused; the
other direction, `inlayBonusReferences`, makes deleting a stat a gem family grants refuse.

**A rung is looked up by `InlayTier.tier`, never by array position.** `tiers` is stored in insertion
order and a family may skip a rung (the sheet's Zircon has no tenth), so indexing reads the wrong row
for a family edited out of order and *some* row for a rung that does not exist.

**`Spell` is one entry of the compendium** (TICKET-SPL-01, v4 systems/13):
`{ id, name, description?, manaCost?, rangeTime, effectTemplate }` on the optional
`Configuration.spells`. Additive-optional and absent-means-none, `constants`' rule, so it needs no
`SUPPORTED_SCHEMA_VERSION` bump; an `optional`-presence row in `ENTITY_SPECS` with no `custom`
checker, since nothing about a spell is nested. Four rules, and three of them are about what the shape
**permits**:

- **`manaCost` is optional, and absent means the ruleset does not price the spell.** The workbook's
  `mighty fortress` row has its mana and range **columns swapped**, so its cost cell holds `1 Mile`;
  under v4 D1 that row is recorded as it stands, which a required `number` makes impossible — the
  choice would be inventing a cost or dropping the spell, and *never invent a number to fill a
  required field* is the compendium's own rule. Zircon's blank tenth tier is the same decision one
  entity over. **This diverges from the ticket's to-be**, which wrote the field required; see its
  implementation note 1. TICKET-SPL-02 decides what an unpriced spell costs to cast.
- **`rangeTime` and `effectTemplate` are required strings whose empty value is a real state.** Six of
  the sheet's range cells are blank and one effect cell is a live `#VERW!` error, which the corpus
  records as an **empty template with a note** rather than as invented text. Nothing trims, defaults
  or normalises either — the sheet spells one idea a dozen ways (`60f`, `60 Feet`, `120`, `touch`),
  and deciding which of them mean the same thing is the User's edit.
- **Effect text is a template** since TICKET-SPL-03 — prose with `{formula}` placeholders, evaluated
  per caster at the `spell-effect` attachment point
  ([v4 D4](../../../docs/v4.0_sheet_parity/overview.md#d4--spell-effect-text-goes-through-the-formula-engine)).
  The field's **type did not change** and neither did the schema version: it is the same `string`,
  and what moved is who reads it. Three consequences for anyone reshaping a spell:
  - **It has two forms, like every other formula.** `translateConfiguration` walks it through
    `mapTemplateFormulas`, so the *placeholders* are id-resolved on the way to storage while the
    prose round-trips byte-for-byte. A rename re-spells 326 effects; nothing hand-edits one. A whole
    string translation would tokenize the sentence and rewrite the word `STR` in *"gains STR"* into a
    uuid.
  - **It is a guarded reference.** `dependencies.ts`'s `formulaSources` lists it fourth, so a stat
    read only by Fireball blocks that stat's delete — and `formulaReferences` dedupes by holder and
    field, because a spell is the first holder that can carry more than one formula.
  - **`engine/validator.ts` reports a placeholder that cannot resolve**, one issue per placeholder,
    quoting it. Prose reports nothing, which is what keeps the 92 plain-text effects quiet.
  The editor is still a `Textarea` — the field is not a formula — and FORM-08's *every formula field
  ships a preview* is paid by `TemplatePreview`. The grammar for a transcriber is
  [`spell-template-grammar.md`](../../../docs/v4.0_sheet_parity/spell-template-grammar.md).
- **Two spells may share a name; two may not share an id.** Nothing reaches a spell from a formula,
  so a name collides with nothing — a `Skill`'s rule since TICKET-SKL-02, and the sheet does repeat
  itself. `engine/validator.ts` reports an id collision (`duplicateIdIssues`) and says nothing about a
  name.

`dependencies.ts` reaches a spell **from two directions now**, and it reached it from neither when
the kind was minted — `dice-ladder`'s and `inlay`'s state on their own first day. The `spell` arm
walks `Character.learnedSpellIds` (TICKET-SPL-02), so deleting a spell Players have learned is
refused naming them; and a spell is itself a **formula holder** since TICKET-SPL-03, so a stat its
effect reads cannot be deleted either. `shared/engine/referenceArms.test.ts` carried a vacuous row
against the first of those before the field existed, and **it fired** — red on the run that added
`learnedSpellIds`, before the walk was written.

**`Passive` is the same story told forwards** (TICKET-PAS-01, v4 systems/14):
`{ id, name, effectText }` and nothing else, because the source tab has two columns and nothing in the
sheet grants a passive yet (v4 D5) — no cost, no category, no `sourceKind` for an automatic grant
that does not exist. Its `effectText` is prose with `{formula}` placeholders at the **same attachment
point a spell effect uses** (`FORMULA_OWNER.SPELL_EFFECT`, reused rather than a `passive-effect` row
minted: two of the workbook's 26 read a skill level, which that scope already covers). So it is a
formula holder in `dependencies.ts`, a translated field in `references.ts`, and a reported one in
`validator.ts` — wherever a spell's template is, a passive's is beside it. Its `passive` walker arm
was written **filled**, unlike `inlay`'s and `spell`'s, because `Character.passiveIds` lands in the
same ticket; the third `referenceArms.test.ts` row is there for the next referrer rather than this
one. **Duplicate names are legal and expected** — the sheet's poison-resistance ladder appears twice,
four rows — while duplicate **ids** are a `duplicateIdIssues` error, because a revoke addresses by
id.

**`Item` is a template, and since TICKET-ITEM-01 it is a per-skill bonus vector** (v4 systems/11):
`{ id, name, description, categoryId?, equipmentSlotType?, shop?, skillBonuses? }`. What a template
*is* moves skills; what it is *made of* is a fact about the thing a Player **built** and lives on the
`ComposedItem` (TICKET-INV-05 retired the fused `materialId` / `materialLevel` pair). Four rules:

- **`skillBonuses?: SkillModifier[]` is sparse and keyed by skill id.** `SkillModifier` is
  `{ skillId, modifier }` — `StatModifier`'s shape one entity over, and deliberately a **second type**
  rather than one generic `{ targetId, modifier }`, because a shared shape would let a material tier's
  row point at a skill. Id-keyed, so `references.ts` translates nothing and a rename cannot orphan a
  bonus (TICKET-MAT-01's precedent). **Only the skills a template actually moves are stored**: a zero
  contributes nothing, and storing one would make every skill look referenced by every item. The
  editor prunes zeros (`sparseSkillBonuses` in `useItemManager`); the import gate **accepts** a stored
  zero, because sparseness is a storage convention rather than an identity rule and a file carrying a
  zero plays identically. **It also prunes a non-finite modifier, and that half is not a
  convention**: a number box registered `{ valueAsNumber: true }` yields `NaN` when cleared, which
  serialises as `null` and which the gate refuses — so a writer that let it through would produce a
  document this app cannot re-import. Copy the `Number.isFinite` guard into any new sparse-row writer;
  `useMaterialManager` and `useInlayManager` still lack it.
- **`shop?: string` is a free User word**, `Stat.group`'s and `Inlay.group`'s rules exactly:
  validated against nothing, the panel's headings are the distinct values present, absent means the
  template is in no shop. **It sits on the template rather than on a category record** because
  `categoryId` is itself a free string with no entity behind it — there is no `ItemCategory` — so the
  shop is the same kind of thing one level up, and minting an entity to hold it would be INV-05's
  reshape rather than this one's. The workbook's nine shop names are seed data, not a vocabulary.
- **Both are additive-optional, so no `SUPPORTED_SCHEMA_VERSION` bump** — `constants`' rule. `items`
  gained a `shop` field row and an `itemSkillBonusShapeErrors` `custom` checker in `ENTITY_SPECS`;
  `configStore.addItem` runs `mergeClearingAbsent` so an unset key is dropped rather than stored as
  `undefined`, which is `addInlay`'s and `addRace`'s rule.
- **A vector is a config→config reference and is guarded like one.** `itemSkillBonusReferences` in
  `dependencies.ts` makes deleting a skill that templates grant refuse, naming them;
  `engine/validator.ts` reports a row naming a skill the ruleset no longer defines, once per row,
  because the row is what has to be repointed. The engine drops such a row rather than inventing a
  target.

The engine term is `calculateEquipmentSkillBonuses` (`calculators/equipmentBonusCalculator.ts`),
which walks **`config.equipmentSlots`** — one, six and twelve slots are all ordinary (TICKET-INV-04)
— and sums into the skill's **bonus**, outside the round-up: `ceil(level / bonus_divider) + Σ gear`.
`calculateEquipmentBonuses` walks the same list, so an item worn in a slot the User force-deleted
grants nothing on either axis rather than half of itself. Both terms read **composed items** since
TICKET-INV-05: `equippedCompositions` resolves each filled slot to `{ template, materialBonuses,
inlayBonuses }`, and the stat term sums the two tier rows while the skill term reads the template's
vector.

**`Race` is a stat block, not a bag of bonuses** (TICKET-RACE-01):
`{ id, name, description, statValues: Record<statId, number> }`, holding the **absolute** value a
member of that race has, like the sheet's creature rows. Two rules follow, and both are load-bearing:

- **Keyed by stat *id*, not abbreviation.** So a stat block needs no display↔stored translation at
  all — `references.ts` has no `races` branch, and a rename passes straight through it. The
  guarded-delete walker matches it by id too (`raceStatBlockReferences` in `dependencies.ts`).
  A material tier's modifiers are keyed the same way since TICKET-MAT-01
  (`materialBonusReferences`), so **no persisted modifier names a spelling any more**.
- **A stat absent from the record reads 0.** Adding a stat to the ruleset therefore costs nothing:
  every existing race is already defined over it. Keep that when reading a block —
  `race.statValues[stat.id] ?? 0`, never a bare index — and let the editor be the thing that
  writes a complete block (`useRaceManager`'s `handleSave` normalises against the ruleset as it
  stands at save time).

**A race also carries the creature identity the old sheet never gave it** (TICKET-RACE-03, v4
systems/04): optional `type?`, `size?` and `challengeRate?`. Four rules:

- **`type` and `size` are free User strings, not references.** They are compared by *spelling*
  against two optional reference lists on the `Configuration` — `creatureSizes?: string[]` and
  `creatureTypes?: string[]` — which hold the User's own words, `humaniod` and `guargantian`
  included. A race naming a word its ruleset's list does not offer is an `engine/validator.ts`
  **warning**, never a refusal, and a ruleset with no list (or an empty one) validates nothing. The
  editor still *offers* an off-list word as a selected option, so editing a race imported from
  elsewhere cannot quietly change its kind.
- **Both lists follow `constants`' absent-means-none rule**, and the store enforces it: emptying one
  in the panel deletes the key rather than storing `[]` (`emptyToAbsent` in `configStore`), so a
  ruleset that never named a vocabulary round-trips unchanged. They are two fields rather than one
  `{ sizes, types }` container because *absent means none* has to be answerable per list.
- **`challengeRate` is stored and built on nothing.** It is 0 for every playable race in the
  workbook — a creature-facing number waiting for a bestiary — so it is recorded because the sheet
  has it and read only by its own plumbing (the declaration, the shape gate, the race editor).
  `components/config/races/challengeRate.test.ts` scans `src/` and fails the day a fifth module
  names it. Copy that guard for the next field stored ahead of its mechanic.
- **`updateRace` merges through `mergeClearingAbsent`**, like `updateStat`, so clearing an identity
  field deletes the key; `addRace` runs the same cleaner so a race arrives without empty ones.

All three fields and both lists are **additive-optional**, so TICKET-RACE-03 needed no
`SUPPORTED_SCHEMA_VERSION` bump. **The shape gate has two tables now** (`importExport.ts`):
`ENTITY_SPECS` over the array-of-*entity* keys, and `REFERENCE_LIST_SUBJECTS` over the
array-of-*string* keys, both derived from `Configuration` so adding either kind of collection without
a check is a **type error** rather than silence. A new word list is a row in the second table.

**Two tables are not automatically exhaustive, and the third kind is guarded rather than assumed.**
An array that is neither entities nor strings — a `number[]`, a `boolean[]`, a mixed union — matches
neither key type and would ship unchecked, which is the hole CR-22's single `readonly unknown[]` key
existed to close. `EveryCollectionIsChecked` is intersected onto `REFERENCE_LIST_SUBJECTS`'s type and
turns that case into a required property no literal can satisfy, so the build fails **on the table**
and the message names the offending key. If you add a third kind of collection, give it its own table
and widen that union — do not delete the guard.

Race blocks are the composition's **`base` term** and they **blend, never stack** (TICKET-RACE-02):
one race is its own block, more are `roundup(Σ / const.race_blend_divisor)` per stat, and a
stat one block omits is a real 0 in that average. **Since TICKET-RACE-03 the sheet's `MAX(1, …)`
floor applies to both**: a blend that comes to *nothing* reads 1 rather than 0. It is deliberately
narrower than the workbook's literal `MAX(1, …)` — a negative pairing is left alone, because the app
lets a ruleset write a negative block and the sheet has no negative row to say otherwise — and it
reaches only the stats the blocks *mention*, since a block prunes its zeros and a stat neither race
names is absent from the map entirely. Never re-derive a race contribution in a component: call
`calculateRaceStatBases`, the same function the composition calls.

**How many races a character has is the ruleset's, not the engine's** (TICKET-RACE-04).
`Character.raceIds` holds **exactly `const.race_count`** of them, duplicates legal — the same race
in every slot is a pure-blood, which is what retired the old `Empty` placeholder row. The number
lives in exactly one module,
[engine/races.ts](../../../src/shared/engine/races.ts): `raceCount(constants)` is the dial (absent or
unusable means the sheet's **2**, the reader's rule — nothing is backfilled and no schema bump is
owed), `racesRequired(config)` is the creation rule's number with its one stated exception (**a
ruleset that offers no races requires none**, which is where v1.0 Req 11.2's raceless character
lives), and `resolveRaces(config, raceIds)` turns picks into blocks **in pick order, duplicates kept,
capped at the count** — never `config.races.filter(r => raceIds.includes(r.id))`, which collapses a
pure-blood to one block. **Resolve through it rather than capping anywhere else**: the count is a
dial a User can lower under a character created at the old one, and the cap living in the resolver is
what stops a sheet naming three lineages while it blends two.
`const.race_blend_divisor` **defaults to the count** and stays an independent dial, so a
3-race ruleset averages by default and can still be told to sum — which also means **turning the dial
re-values stored characters**, and nothing warns about that yet. `characterCreationErrors` refuses
any other length naming the count, on both sides; `CharacterPatch` no longer carries `raceIds`,
because a patch has no ruleset to count against. The one deliberate non-caller is
`useCharacterListManager`, which names every id a character holds (`Unknown race` where the ruleset
cannot answer) precisely so a stale roster looks stale.

**`schemaVersion` is the clean break** (TICKET-STAT-01, TICKET-IO-03). v1 files have no such key,
which is exactly how they are recognised. The number itself lives in
[types/config.ts](../../../src/shared/types/config.ts) as `SUPPORTED_SCHEMA_VERSION` — not in either
service, so both gate on the same value and `createFreshConfiguration` writes it rather than a
literal. v1's focus stat, spend-derived level and speciality base levels have no faithful mapping
into v2, so a conversion would invent a ruleset nobody authored.

**Bump it on every reshape for the rest of the v2.0 milestone** (User decision, 2026-08-09,
recorded on TICKET-RACE-01). The persisted shape is not stable until v2.0 lands, so a ticket that
changes an entity's shape raises `SUPPORTED_SCHEMA_VERSION` in the same commit — otherwise stored
data from a day earlier crashes on the field that moved instead of meeting IO-03's notice. It is
one line plus a `schemaVersion: N` sweep over the test fixtures, `scripts/build-sheet-import.mjs`
**and `examples/demo-ruleset.json`**. The last two have their own guards — `sheetImport.test.ts`
and `exampleRuleset.test.ts` — so forgetting them fails the suite rather than shipping a corpus the
app refuses to import; that is what caught them on TICKET-RES-01.

**v4.0 bumps once, not per reshape**
([D6](../../../docs/v4.0_sheet_parity/overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)),
and **TICKET-INV-05 landed it: 9 → 10.** Every later v4.0 ticket inherits the number rather than
raising its own — landing the milestone in pieces makes the tree briefly unreadable to old data
either way, so a version per ticket would buy nothing. The rule *above* still governs the sweep: the
bump is one line plus the four other places that spell it. **TICKET-INV-06 then deleted a
*Character* field under that same 10** (`Inventory.miscItems`), which is the rule working rather than
an exception to it — and note where the retirement is recorded: `RETIRED_FIELDS` and
`EntitySpec.retired` are both **configuration** surfaces, so a character-side retirement is
documented on the type and enforced only by `isReadableCharacter` / `uploadedCharacterErrors`. A
stored `miscItems` is not refused, because refusing it would buy nothing: every build it named is in
`composedItems`, so such a character opens with all of them in the bag.
There is deliberately **no migration path**: the ruleset is regenerable from
[`docs/imports/`](../../../docs/imports/README.md), and the notice offers a backup before anything
is cleared.

The refusal has three surfaces, and they behave differently on purpose:

| Path | What happens |
|---|---|
| **Load** (`loadConfiguration()`, and `loadCharacters()` since CR-05) | throws `StorageSchemaError`; **nothing is loaded and nothing is deleted**. `useAppHydration` turns it into `incompatibleData`, and `RootLayout` renders `IncompatibleDataNotice` *instead of* the routes — so no route can mint a fresh ruleset and save it over the old data. |
| **Backup** | `downloadStoredBackup()` in `client/services/configFiles.ts` reads `readStoredSnapshot()` and splices both raw strings into one envelope by concatenation, so the file's bytes are the stored bytes; a blob that does not parse is embedded as a JSON string instead. |
| **Start fresh** | `useConfigStore.discardStoredData()` — the **only** path that calls `clearAllData()`. It clears both keys, empties both stores, and writes no replacement. |
| **Import** (`importConfiguration()`) | throws `SchemaVersionError` *before* `validateConfigurationShape()` runs, so a v1 file gets one version sentence rather than a field-by-field report. |

Import runs **both** validators before anything is persisted (CR-03): the shape gate in
`importExport.ts`, then `engine/validator.ts`'s reference report, and only then `replaceConfig`.
"Apply it anyway and show the report" is the decision about a *referentially* broken ruleset — one
whose ids dangle — never about one the engine cannot walk. Every collection gets a per-entry shape
check via `collectionShapeErrors(entries, field, shapeErrors)`; adding a collection without one is
how `{"currencyTiers":[null]}` used to reach LocalStorage.

`loadCharacters()` applies the same discipline to the characters key (CR-05): a stored character
with no `investedStatPoints`, no `currentResourceValues`, or a non-finite `experience` makes the
whole load throw `StorageSchemaError`, naming how many of how many. **It never filters** — the
filtered array was what the next `autoSave` wrote back, so an unrecognised character was silently
and permanently deleted. This closes TICKET-IO-03 implementation note 5's gap: a v1 characters key
beside an absent or v2 config now gets the same notice, backup offer and start-fresh choice the
ruleset has.

**`Stat` is the one numeric axis** (Concept 01, TICKET-STAT-01) — `MainSkill` is gone. Flags say
what a stat does: no `formula` means **invested**; `isResource` additionally means the value is a
*maximum* the character spends against; a `formula` makes it **derived** and it accepts no
investment. It also carries `abbreviation`, `order`, `countsTowardTotal`, optional `min`/`max`,
and `rounding` (`none` | `nearest` | `up` | `down`, applied after the clamp — and the clamp is
re-applied after it, so a fractional bound wins over the rounding mode rather than being rounded
past, CR-41).

**Plus an optional `group`** (TICKET-STAT-04) — which column of the character sheet the stat is
listed under, the source sheet's *Physical* / *Mental* / *Vitals*. Three things about it:
**presentation only** (nothing derives from a group and no rule reads one — `StatsSection` /
`ResourcesSection` reading it through `components/shared/labelledGroups.ts` is all that consumes it); a **User-named free string** validated against nothing, like `Skill.category`, so
two spellings of one word are two groups and that is the User's to fix; and **additive-optional**,
so absent means ungrouped and it needed no schema bump of its own. A group total or a per-group cap
would be a new decision, not an extension of the field. **`updateStat` clears it the way it clears
`min`/`max`/`formula`** — through `mergeClearingAbsent`, so emptying the field deletes the key.

Identity rules that the rest of the app depends on:

- **Every referenceable entity carries a stable `id`.** Since TICKET-REF-01 that includes stats
  and both skill kinds, whose `abbreviation` is renamable display data rather than the
  identity. **`updateSkill`/`deleteSkill` take the id** (TICKET-SKL-02 — a `Skill` has no code to
  address it by), and so do the roll and ladder actions. **No entity is addressed by a code**
  any more — the last one, `CombatSkill`, went in TICKET-ROLL-06. `EquipmentSlot` is still
  keyed by `type`.
- **A stat's `abbreviation` is an uppercase identifier and unique across the one flat formula
  space** (TICKET-STAT-01), which holds **stat abbreviations and nothing else**: the speciality
  half left with the code in TICKET-SKL-02, the combat codes with the entity in ROLL-06. Enforced in both places the rule needs:
  `validateConfigurationShape()` for import, `useStatManager`'s save path for User input. Renaming one
  is safe — the stored formula holds the stat's id — and there is **no character half left to
  carry**: `investedStatPoints` and `investedSkillPoints` are both keyed by id, which is why
  `renameSkillCode` and `useSkillCodeRename` were deleted. **Nothing escapes it any more**: the last
  code-keyed character field went with the focus stat in TICKET-ARC-03, so a rename has no character
  half at all and `combatSkillReferences` stopped taking characters.
- **A constant's `name` is a lowercase identifier (`^[a-z][a-z0-9_]*$`) and unique.** It is what a
  formula spells as `const.<name>`, and a duplicate splits identity from value — the stored formula
  points at one constant's id while `constantsNamespace` reads the other's number. Enforced in two
  places, both required: `validateConfigurationShape()` for untrusted import, and `useConstantManager`'s
  save path for User input (TICKET-CST-02).
- **A curve's `name` follows the same identifier rule as a constant's**, and so does each of its
  **column names**, which are formula segments (`curve.point_buy.main_type(3)`). Its `rows` must
  carry unique keys sorted ascending with one value per column, and a `reverse` curve's value
  column must not decrease — `engine/validator.ts` reports each as an error, and a `step` curve
  with a gap wider than its average step as a warning (TICKET-CRV-01). Both rules are enforced in
  two places: `validateConfigurationShape()` for import and `useCurveManager`'s save paths for User
  input (TICKET-CRV-03). **A column name is rename-safe too** — the one property segment that is
  id-resolved, because it is the one the User named. `references.ts` keys it by
  `curveId + columnName` (spellings are unique only within a curve) and the stored form is
  `curve.[curveId].[columnId](x)`; a column is a `curve-column` delete target, so removing one a
  formula reads is refused like any other guarded delete.
- **A curve column may be generated.** `CurveColumn.generator` is a formula evaluated once per row
  with the key bound as `key` (plus `const.*` — its own `curve-generator` row in
  `engine/formula/scoping.ts`), and `CurveRow.overridden` is a positional flag array marking cells
  a User hand-tuned. Both are optional and absent means the pre-TICKET-CRV-02 state: no generator
  = hand-entered column, no flags = nothing overridden. `engine/curveGenerator.ts` owns the
  regenerate/edit/clear semantics; an all-`false` flag array is normalised back to absent so a
  curve round-trips unchanged. **`columns`, `rows[].values` and `rows[].overridden` are three
  arrays on one index** — structural edits go through `engine/curveTable.ts` (and the store's
  `addCurveColumn`/`deleteCurveColumn`/`addCurveRow`/`deleteCurveRow`), never through a
  hand-assembled `updateCurve` patch.
- **A fresh ruleset seeds two curves** (TICKET-CRV-03): `point_buy` (`non`/`sub` hand-entered
  from Concept 06, including its `4.642857142857` anomaly; `main` generated `0.75 * (key + 1)`)
  and `xp_thresholds` (shape only — reverse/step/extrapolate, one row, real numbers still open).
- **Codes must stay unique across skill kinds.** One formula namespace serves all three, and the
  display form of a formula would be ambiguous otherwise. (TICKET-REF-01's to-be floated
  downgrading this to a warning; it is deliberately *not* done — see that ticket's divergence
  note.)
- **A persisted formula is id-resolved.** What the User writes and what is stored are two forms
  of the same expression: `STR + DEX` in display form, `[id-str] + [id-dex]` in stored form. The
  translation lives in [engine/formula/references.ts](../../../src/shared/engine/formula/references.ts)
  and is applied at exactly two places — `client/services/storage.ts` and
  `shared/services/importExport.ts`, so
  everything above them (stores, engine, components) works in display form only. **Formula strings
  are the only reference-carrying fields left**: a race's stat block (TICKET-RACE-01) and a
  material tier's modifiers (TICKET-MAT-01) hold stat ids, so `references.ts` translates neither.
  A rename is `toStoredConfiguration` → patch →
  `toDisplayConfiguration`, which `configStore`'s `applyRenameSafely` does for you; the reference
  index is **derived on every call and never persisted**.
  A `stats.*` member is a slug of the stat's name (`Max Health` → `stats.max_health`) until
  TICKET-STAT-01 gives stats a real code.
- **Formulas are strings** on `Stat.formula`, `RollDefinition.input`, and
  `CurveColumn.generator`. **A `Skill` carries none** — weight rows replaced the string in
  TICKET-SKL-02, which is also why there is no `skill` attachment point in `scoping.ts` and why a
  skill cannot be a node in the dependency graph. They are parsed by the formula engine, never `eval`'d, and a bare
  variable is only valid if it resolves to a configured skill code. Since TICKET-FORM-03 a formula
  may also carry **dotted namespaced references** (`stats.speed`, `const.bonus_divider`) and
  **namespaced calls** (`curve.xp_thresholds(x)`, `curve.point_buy.main_type(x)` — the third
  segment selects a value column); which of those a formula may use depends on its attachment
  point, per the tables in
  `engine/formula/scoping.ts` (TICKET-FORM-04). The save-time guard refuses out-of-scope
  namespaces and unknown members, so a persisted formula's references are in scope — but it can
  still fail to *evaluate*: `const.*` and `curve.*` resolve wherever they are in scope
  (TICKET-CST-01, TICKET-CRV-01), but `stats.*` and `skills.*` wait on STAT-01. Since
  TICKET-FORM-05 that failure is an **error value on that one entry**, not a throw.
- **Deletion is reference-checked in the store action** (TICKET-REF-02). Every `deleteX` returns
  `EntityReference[]`: non-empty means it refused and that is what points at the entity; empty
  means it deleted. `{ force: true }` overrides. The walker is
  [engine/dependencies.ts](../../../src/shared/engine/dependencies.ts) — pure over `(target, config,
  characters)`, so characters count as references (`raceIds`, inventories, allocations, current
  stat values). Panels render the returned list via `config/shared/BlockedDeleteDialog`; **no
  component derives references to decide whether a delete is safe** — that judgement is the store
  action's. Calling `findReferences` for *display* is fine and TICKET-CST-02 does it:
  `useConstantManager` builds a usage index so each constant's card can show its blast radius.
  A forced delete leaves the dependents dangling on purpose:
  the ruleset alone defines the main-skill namespace, so a formula naming the deleted code
  reports `Undefined variable` rather than reading a leftover allocation as a number.
  `engine/validator.ts` stays as the after-the-fact report for what an import brings in.

## Character (the play-mode data)

`Character` stores only what the player chose: `raceIds`, `investedStatPoints` (**keyed by stat
id**, so a rename cannot orphan an allocation),
`investedSkillPoints` (**keyed by skill id**, same reason — TICKET-SKL-02 replaced v1's
code-keyed `specialitySkillBaseLevels`), `archetypeId`, `focusSkillIds` (**three picks, duplicates
legal** — TICKET-SKL-05), `learnedSpellIds` (**the ids that are on**, duplicates refused —
TICKET-SPL-02), `passiveIds` (**what the DM handed them**, duplicates refused — TICKET-PAS-01),
`currentResourceValues`,
`experience`,
and an `Inventory` (`equippedItems: Record<slotType, composedItemId>` + `composedItems:
ComposedItem[]` — **two collections since TICKET-INV-06**, where the third, `miscItems`, was deleted
as a stored derivation). It carries `configurationId` so a character is always read against the
ruleset it was built on.

### Composed items — what a Player built (TICKET-INV-05, v4 systems/12)

`ComposedItem` is `{ id, templateId, materialId?, materialLevel?, inlayId?, inlayLevel? }`, and it is
the thing an inventory actually holds: **`equippedItems` names a `ComposedItem.id`, not an
`Item.id`.** The shape of that collection did not change, only what the id resolves to.

- **It stores links, never numbers.** No stat row, no skill row, no display name. Every number is read
  off the parts at calculation time, which is why retuning Iron Ore tier 10 relabels every axe made of
  it on the next read instead of rewriting none of them — *derived values are computed, never stored*
  applied to an aggregate.
- **All four part links are optional, and the field tolerates while the action insists.** A rope has no
  metal in it; `Character.focusSkillIds` is the same split (optional on the type, three required by
  `characterCreationErrors`). **`composeBuild` requires a material and its rung** (TICKET-INV-06), so a
  record naming neither is one an older build minted or an import carried.
- **A part the ruleset no longer defines contributes nothing** — a dangling `templateId` drops the
  whole build from both equipment terms, a dangling tier drops only that tier's rows. An `inlayLevel`
  naming a rung the family *skips* (the sheet's Zircon has no tenth) is the same case at calculation
  time; at **build** time it is a refusal naming the gap, which is where the Player can act on it.
- **The Backpack is derived, so a build is worn or in it — there is no third place** (TICKET-INV-06).
  `backpackOf(character, config)` is `composedItems` minus what the ruleset's slots hold, which is the
  sheet's own `FILTER`. `equipToSlot` takes a build off any other slot (`slotsWithout`) and puts it in
  one; `unequipSlot` clears a slot and the build is in the bag by not being worn; **`discardBuild` is
  the only action that destroys**, and it refuses a build being worn. A build stranded in a slot the
  User *force-deleted* is not worn — `wornBuildIds` walks `config.equipmentSlots` — so it comes back
  to the bag instead of becoming invisible.
- **The id is minted by the caller** — `crypto.randomUUID()` in the store, the same in the route —
  for `CharacterIdentity`'s reason: `shared/` reaches for no global.
- **`isReadableCharacter` requires `inventory.composedItems`**, which is what routes a roster written
  before builds to `IncompatibleDataNotice` rather than silently stripping every Player's gear.

**`equippedItems` has no fixed key set, and no code may assume one** (TICKET-INV-04). A ruleset's
equipment slots are User-built — the list is CRUD in `EquipmentSlotsConfigPanel`, the board is a
grid the User sizes in `EquipmentLayoutPanel`, and `EquipmentSlot.type` is free text — so one, six
and twelve slots are all ordinary, and none is the app's number. `SEED_PLACEMENTS` in
[equipmentLayout.ts](../../../src/shared/engine/equipmentLayout.ts) recognises a couple of dozen
spellings (both workbooks' — `main_hand` and `right_hand`, `chest` and `upperbody_gear`) purely so
the builder opens on a figure instead of a column of boxes; a slot it has never heard of seeds
unplaced and costs nothing. Anything summing or rendering per slot walks the ruleset's own list.

**`investedStatPoints` holds points *spent*, not levels gained** (TICKET-ARC-02). The `point_buy`
curve is the exchange rate between the two, selected by the archetype's affinity for that stat —
15 points buy 12 on a main-type stat and 5 on a non-type one. Nothing about the stored shape
changed; what changed is what the number means, so never read an entry as a stat's value. Ask
`statGain` (or read `validateStatAllocation(...).gains`) instead.

**And a gain is not a function of these points alone** (TICKET-ARC-04): `dreamLevel` multiplies a
main-tagged stat's gain and adds to a sub-tagged one's, so **a stat with no entry here still has a
gain**, and it can be fractional (`main(0)` is 0.75 on the seeded curve). Two persisted fields feed
one derived number, which is the reason to route every reader through `statGain` rather than
through the allocation map.

**Derived values are never persisted.** Composed stat values, the stat total, skill levels and
bonuses, roll inputs, and equipment bonuses are computed on demand from
`src/shared/engine/`. `calculateCharacter(character, config)` in
[calculator.ts](../../../src/shared/engine/calculator.ts) is the single entry point that produces a
`CalculatedCharacter` with every derived field populated; `calculateCharacterStats()` is a thin
wrapper over it for callers that only want the stat values. **A derived value's *explanation* is
derived too** — TICKET-SKL-03 added `skillContributions`, one already-multiplied
`SkillStatContribution` per weight row, so the sheet can label a breakdown without a component
redoing the arithmetic. When a surface needs to show how a number was reached, widen the calculator's
return rather than recomputing the terms at the render site. If you find yourself wanting to store a
computed number on `Character`, the answer is a recalculation call at read time instead. There are
exactly **five** deliberate exceptions. `currentResourceValues` — the player's *current* HP/mana,
which is state, not derivation (its maximum is derived; its current value is not). **Only `isResource` stats appear
there**, and the store action enforces it: a stat you cannot spend has no current distinct from
its value, which is what v1 got wrong by giving every stat one.

And `experience` (TICKET-RES-01) — stored because nothing else in the app knows it: XP is awarded
at the table. **`level` derives *from* it**, through a reverse lookup on the `xp_thresholds` curve
in [characterSummary.ts](../../../src/shared/engine/characterSummary.ts), which is the single definition
every screen reads. This inverts v1.0, where level was the sum of points spent; the chain now runs
`XP → level → budget → spend`. `calculateCharacterLevel(character, config)` returns a
`FormulaResult`, because the curve is User data that can be deleted or set to refuse out-of-range
input — a level that cannot be read chips rather than showing a confident 1. Since TICKET-DM-01 the
rules that write it live in [dmActions.ts](../../../src/shared/services/dmActions.ts) —
`addExperience` / `removeExperience`, called by `characterStore` in local mode and by
`routes/dm/` on the server — and a deduction below 0 is **refused**, not clamped, in one place for
both.

**"Set level to N" is a convenience over experience, never a stored level** (v3 Req 42.2, D9).
`experienceForLevel(character, config, level)` reads the *same* `xp_thresholds` curve **forwards** —
what does level N cost — and `setLevelExperience` writes that total to `experience`. It refuses,
rather than guessing, when the curve cannot price the level: the answer is fed back through
`calculateCharacterLevel` and anything that does not read back as N is reported as an error. A
single-row placeholder curve happily extrapolates *0 XP* for level 7, which is exactly the
plausible-but-wrong number that check exists to catch.

And **`purse`** (TICKET-CUR-02) — **one amount, in the ruleset's base tier** (`order: 0`, the least
valuable), optional and absent-means-none. Money is spent at the table and derived from nothing, so
it is the third exception rather than a computed number stored.

- **Not a per-tier breakdown, and that is the decision to defend.** It replaced an untickted
  `wallet?: Record<tierId, number>`: a per-tier purse makes every payment a change-making problem,
  makes *"do I have 3 gold"* a conversion, and lets one amount of wealth have two representations.
  `engine/currency.ts`'s `formatPurse` answers the only question worth asking — *which tier should I
  show this in* — from `baseTier` → `normalizeCurrency` → `formatCurrency`, every render. So
  retuning the ruleset's rates relabels every purse in the game and rewrites none of them, and a
  ruleset with **no** tiers shows a bare number rather than hiding a Player's money.
- **Below zero is refused with the shortfall named**, not clamped — `deductExperience`'s precedent,
  in `shared/services/playerActions.ts`'s `setPurse` / `adjustPurse`. Fractions pass: a tier rate may
  be fractional, so rounding on write would lose money. Round for display only.
- **A stored `wallet` is converted, not dropped.** `characterStore.adoptStoredWallets(tiers)` sums
  each holding down to the base tier through `convertCurrency` and removes the retired key, called
  once from `useAppHydration` because it needs the ruleset's rates. `isReadableCharacter` therefore
  still **accepts** a character carrying `wallet` — refusing one would mean the migration could never
  run. **No `SUPPORTED_SCHEMA_VERSION` bump**: `purse` is additive-optional, nothing reads `wallet`,
  and a bump would make every stored roster unreadable behind `IncompatibleDataNotice` — destroying
  the very data the conversion exists to keep. A bump and a migration are mutually exclusive.

And **`grantedStatPoints`** (TICKET-DM-01) — the extra spendable stat points the DM has handed out,
optional and absent-means-none, whole and not negative. It is the fourth exception because nothing
derives it: *"the DM gave you three points"* is new information, the same test that admitted
`experience`.

- **A grant, not a budget.** The pool stays `level × const.points_per_level + grants`, so awarding
  experience still moves it underneath the grant. A stored *budget* would be a derived value with a
  second writer, silently disagreeing with the level the moment XP changed.
- **One number, not one per stat.** Points are fungible; what they *buy* per stat is the `point_buy`
  curve's answer (TICKET-ARC-02), so a per-stat grant would be a second, contradictory exchange rate.
- **Revoking below what has been spent is refused, naming the overspend** (v3 Req 42.4) — priced
  through `validateStatAllocation`, never by arithmetic. Raising a grant is never refused.
- **No `SUPPORTED_SCHEMA_VERSION` bump**, for `purse`'s reason: additive-optional, absent on every
  stored roster, and `CHARACTER_FIELDS` in `characterShape.ts` deliberately does not require it.

And **`dreamLevel`** (TICKET-RES-04, v4 systems/02) — *"how far you stand in your dream"*, the new
workbook's identity block. The fifth exception, on `experience`'s exact test: **nothing derives it**,
and the archetype gains derive *from* it (a **main**-affinity stat's gain is the point-table value
**× dream**, a **sub**-affinity stat's is **+ dream** even at zero points — TICKET-ARC-04, live in
[calculators/pointBuy.ts](../../../src/shared/engine/calculators/pointBuy.ts)'s `statGain`, whose
fourth parameter is the level and is **required** so that no caller can grow a second default).

- **Optional, and absent means 1** — not 0, because the role is multiplicative and 1 is the neutral
  value the sheet's own sample shows. **The default is the reader's rule, not a stored backfill**:
  read it through `dreamLevelOf` in
  [engine/dreamLevel.ts](../../../src/shared/engine/dreamLevel.ts), never `character.dreamLevel ?? 1`
  at a call site, so the header, the gain formula and the DM's before/after cannot disagree. A stored
  number is returned as it stands and never repaired — only the setter writes this field, so a clamp
  in the reader would be a second rule competing silently with the refusal.
- **The DM raises it, as an action** (User ruling, 2026-08-29): `setDreamLevel` in
  [dmActions.ts](../../../src/shared/services/dmActions.ts), beside the experience pair, called by
  `characterStore.dmSetDreamLevel` at a table and `updateDreamLevel` locally (signed out there is no
  DM — `awardExperience`'s precedent). **Below 1 is refused and the refusal names the floor**, whole
  numbers only; a clamp would silently zero every main-affinity gain.
- **No `SUPPORTED_SCHEMA_VERSION` bump**, for `grantedStatPoints`' reason: additive-optional, absent
  on every stored roster, and not in `CHARACTER_FIELDS`. v4.0's single milestone-wide bump
  ([D6](../../../docs/v4.0_sheet_parity/overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29))
  belongs to whichever reshaping ticket lands first; this is not one.

And **`focusSkillIds`** (TICKET-SKL-05, v4 systems/06) — the three **Focus skill** slots the new
workbook's Setup form names. It is **not** a sixth exception to *derived values are never stored*,
because it is not a number anything computes: it is a pick, like `raceIds` and `archetypeId` beside
it. What it feeds is the skill level — each slot contributes `const.focus_chosen` to the skill it
names and `const.focus_other` to every other, summed into one multiplier per skill (0.9 / 2.1 /
**3.3** at the sheet's 1.5 / 0.3), applied *inside* `skillCalculator`'s round-up and *before* the
invested points.

- **A list, not a set, and slot order is what it stores.** Duplicates are legal and **stack** — the
  sample character picked Arcane twice on purpose. Empty slots are **not** stored: a Player part-way
  through choosing has fewer than three entries and the missing slots count as *other*, which is what
  lets the sheet's picker fill them one at a time. `toFocusSlots` pads for a picker; nothing pads the
  document.
- **Optional, and absent means none — with exactly one spelling.** `focusPicksField` is what writes
  it: an empty list stores **no field at all**, so a Player who cleared their last pick and one who
  never made any are the same document and export identically. Read it through `focusPicksOf` in
  [engine/focusSkills.ts](../../../src/shared/engine/focusSkills.ts) rather than `?? []` at a call
  site. (Both halves were found by review: creation dropped an empty list while the sheet's picker
  stored `[]`.) **Absent picks are not the neutral case**: against a ruleset that states the
  dials, no picks computes every skill at **0.9**, which is the workbook's own arithmetic for a form
  nobody filled in. What *is* neutral is a ruleset that states **neither dial** — each defaults to
  `1 / FOCUS_SLOT_COUNT`, so three slots multiply by exactly 1 and every skill computes as it did
  before focus existed.
- **Two writes, one shape rule.** `focusPickRefusal` — at most three, every one a skill the ruleset
  defines — is called by `characterCreationErrors` and by `playerActions.chooseFocusSkills`, so a
  wizard and a live edit cannot disagree. *All three filled* is **creation's** rule and only when the
  ruleset states a dial; the sheet's picker deliberately accepts fewer, because a character created
  before this field existed has none.
- **It is a guarded reference, like `raceIds`.** `dependencies.ts` walks it, so deleting a skill three
  characters focus is refused rather than merely survived — and a stale focus id is worse than a stale
  race id: `focusPickRefusal` refuses the *whole* list, so one dangling pick makes every slot
  unwritable. **Any new `Character` field naming a config entity by id owes the walker a case.**
- **It has to reach the server on creation, not only on the sheet.** `CharacterCreateRequest` carries
  it and `creationDataFrom` reads it, because `POST /api/sessions/:id/characters` re-runs
  `characterCreationErrors` against the Snapshot — a request that dropped the picks would be refused
  for naming none. (It did, until review: the field-by-field request builder in `characterSync.ts` is
  the place a new choice is most easily forgotten.)
- **No `SUPPORTED_SCHEMA_VERSION` bump**, for `dreamLevel`'s reason: additive-optional, absent on
  every stored roster, and not in `CHARACTER_FIELDS`.

And **`learnedSpellIds`** (TICKET-SPL-02, v4 systems/13) — which spells this character has unlocked,
by id. The workbook carries a per-player `locked`/`Learned` flag beside all 418 compendium rows and
its `Spellbook` sheet is one `FILTER` down to the `learned` ones; the app stores **the ids that are
on** rather than a state per row, so a ruleset that grows a spell does not grow a field on every
character who will never cast it. Like `focusSkillIds`, it is a **pick** rather than a sixth
exception to *derived values are never stored*.

- **Optional, absent means none, read through `learnedSpellIdsOf`** in
  [engine/spellbook.ts](../../../src/shared/engine/spellbook.ts) — never `?? []` at a call site.
  Unlike `focusSkillIds` there is no `…Field` helper, because only one write can empty the list:
  `removeLearnedSpell` drops the key inline when the last spell goes, so a Player who forgot their
  last spell and one who never learned any are the same document.
- **The Spellbook is derived, never stored** — `spellbookOf(character, config)` is the sheet's own
  `FILTER`, returning the learned subset in **compendium order** (the sheet's table order, so a book
  reads the same way down every page) with any id the ruleset has lost appended after it as an entry
  whose `spell` is `null`. It is not pruned on read: silently dropping an id would be a repair
  nobody asked for and nobody could see, and the row is what makes the leftover clearable.
- **Guarded, like `raceIds` and `focusSkillIds`.** `dependencies.ts`'s `spell` arm walks it, so
  deleting a spell three Players have learned is refused naming them. This is the arm SPL-01 shipped
  vacuous and `referenceArms.test.ts` armed — the row went red on the run that added this field,
  before the walk was written, which is the first time that check has fired.
- **Duplicates are refused at the write, not de-duplicated on read.** `addLearnedSpell` refuses a
  spell already in the book (unlike `focusSkillIds`, where repeats are the mechanic), so a repeat in
  a stored list came from a hand-edited file and is left alone.
- **Casting spends through the ordinary resource action.** `spendSpellCost` ends in
  `adjustResourceValue(…, -manaCost)`, so a cast and a hand-typed deduction move a pool by the same
  arithmetic. **The pool is named by the caller** — no ruleset field says which resource casting
  draws on (User ruling) — and an unaffordable cast is **refused with the shortfall named** rather
  than taking the pool negative, which is where it deliberately parts from `setResourceValue`.
- **No `SUPPORTED_SCHEMA_VERSION` bump**, for `dreamLevel`'s and `focusSkillIds`' reason:
  additive-optional, absent on every stored roster, not in `CHARACTER_FIELDS`, and not in
  `CharacterCreateRequest` either — a spell is learned after creation, never during it.

And **`passiveIds`** (TICKET-PAS-01, v4 systems/14) — which passive abilities this character has been
handed, by id. `learnedSpellIds`' shape one entity over, and a **pick** for its reason rather than a
sixth exception to *derived values are never stored*. What differs is only who writes it:

- **Optional, absent means none, read through `heldPassiveIdsOf`** in
  [engine/passives.ts](../../../src/shared/engine/passives.ts) — never `?? []` at a call site. Like
  `learnedSpellIds` there is no `…Field` helper: only `removeHeldPassive` can empty the list and it
  drops the key inline, so *none* has one spelling on the document.
- **The list a sheet reads is derived** — `passivesOf(character, config)` resolves the ids against
  the catalog in **catalog order**, appending any id the ruleset has lost as an entry whose `passive`
  is `null`; `grantablePassives` is the complement, which is what the picker offers. Nothing is
  pruned on read, so a force-deleted passive stays visible and therefore revocable.
- **Two writers, and which one depends on where the character lives.** At a table it is the **DM's
  alone** — `dm-grant-passive` / `dm-revoke-passive` behind `requireCharacterDM`, with **no player
  route to the field at all**. On a local sheet the **Player** writes it, because signed out there is
  no DM and the same person plays both parts; `characterStore.grantPassive` / `revokePassive` refuse
  the moment the character sits at a session. That is `dreamLevel`'s split exactly.
- **Two actions rather than one whole-list write**, and the reason is the stale id: `removeHeldPassive`
  takes **no `Configuration`**, so a passive the User force-deleted can still be taken back. A
  `set-passives` validating every id it was handed would refuse the very edit that clears it — the
  trap `focusPickRefusal` sets for `set-focus-skills`.
- **Guarded.** `dependencies.ts`'s `passive` arm walks it, so deleting a passive somebody holds is
  refused naming them — **live from the first day**, unlike `spell` and `inlay`, because the catalog
  and the holder's list land in one ticket. A passive is *also* a formula holder, so a skill its
  effect reads cannot be deleted either.
- **No `SUPPORTED_SCHEMA_VERSION` bump**, for the three reasons above it.

**The point budget closes that chain** (TICKET-RES-02, TICKET-DM-01, TICKET-RES-05):
`validateStatAllocation(character, config)` in
[skillAllocation.ts](../../../src/shared/engine/skillAllocation.ts) prices the pool as
`level × const.points_per_level + grantedStatPoints` — derived, never stored — and
`Configuration.mainSkillPointBudget` is gone with its "absent means unlimited". Both money numbers
are `FormulaResult`s, so a level that cannot be read makes the allocation *invalid* rather than
unlimited, and a grant does **not** rescue a pool that cannot be derived at all. The result reports
`grantedPoints` separately so a surface can say *8 incl. 3 granted* rather than a number nobody can
account for. Spending post-creation goes through `characterStore.setInvestedStatPoints` /
`setInvestedSkillPoints`, which **refuse** an unaffordable spend rather than clamping it — a partial
investment would read as one that landed.

**One pool pays for `investedStatPoints` *and* `investedSkillPoints`** (TICKET-RES-05). That is the
source sheet's own arithmetic — `Points to Use = level × 3 − Points Spend`, where Points Spend sums
the stat boxes and all 48 skill boxes (`Background Charater Sheet Calcu` AK3:AK4) — and it is a
**behavioural change for every ruleset**: skill investment used to be free. Four consequences worth
knowing before touching either map:

- **Only the ruleset's own skills are charged.** Points against an id `config.skills` does not hold
  raise the level of nothing, so they cost nothing either — `unknownStatIds`' rule. Such an id is
  still refused at *creation* by `characterCreationErrors`, which is where it can be acted on.
- **A negative in either map never refunds.** It lands in `violations` (stats) or `skillViolations`
  (skills) and is counted as zero.
- **Characters built before this are ordinarily over budget**, which is *reported* — `isOverBudget`,
  the crimson tally — and never rewritten. Nothing rewrites a stored allocation.
- **A refund is never refused.** Both invest actions let any change lowering the total spend through,
  whatever state the sheet is in; without it an over-budget character could read the report and do
  nothing about it.

Neither field's *shape* moved, so there is no schema-version consequence.

**Since TICKET-CALC-02, every *configured* stat has a value; absence is not a state.**
`calculateStatValues` seeds every stat in `config.stats` before applying investment, racial
modifiers and equipment, so `statValues` is the configured namespace in full and
a stat the character never invested in reads as `0` rather than as an undefined variable in every
formula naming it. `Undefined variable` is reserved for stats the configuration genuinely does not
define. Seed in the calculator — never default in a component or back-fill
`Character.investedStatPoints` on save.

**Derived stats resolve in passes**, because one may read another (`stats.apt` over `stats.speed`).
When a pass resolves nothing new, what is left is a cycle and each stat in it gets its own error
value — the composition terminates rather than reporting a cycle the validator is what properly
names.

**Since TICKET-FORM-05 the formula-derived maps hold `FormulaResult` — a number *or* a
`FormulaError`** (`statValues`, `skillLevels`, `skillBonuses`, `rollInputs`; `statTotal` is
a plain number, and a stat that failed contributes nothing to it rather than poisoning it).
`calculateCharacter` **always returns**: a broken formula poisons its own entry and nothing else
(Concept 00 §7). Read entries with `numberOr(result, fallback)` or `asNumber(result)` from
[engine/formula/errors.ts](../../../src/shared/engine/formula/errors.ts) — never `?? 0`, which cannot
tell an error from a missing key. Errors carry `source` (the owning stat/skill) and `cause` (the
upstream error), so `describeFormulaError` can render a chain. **Never `numberOr` an error into a
number the user then sees as authoritative** — surface it, or let the caller show the error.

Because the maximum *is* derived,
`updateCurrentStatValue(characterId, statId, value, config)` and its plural sibling both take the
`Configuration` and clamp to `calculateCharacter().statValues` inside the action (Req 14.3);
negatives pass through (Req 14.4). A stat with no calculated maximum — an unknown id, or one whose
formula produced an error — is written unclamped. Don't clamp in a component; the rule lives in the
store so no caller can bypass it. `adjustCurrentStatValue(…, delta, config)` and
`resetCurrentStatValueToMax(…, config)` (TICKET-RES-03) are the other two writers: a delta applies
to what is **stored**, not to a clamped reading of it, and a reset leaves the pool alone when the
maximum cannot be calculated rather than writing 0.

**A derived maximum never silently overwrites a stored current** (Concept 20, TICKET-RES-03). When a
maximum falls below the value a Player is tracking — an item unequipped, a formula edited — the
current is **kept** and flagged (`StatBreakdown.isOverMax`), never rewritten. Write-clamping is what
resolves it, the next time the Player touches the pool. Nothing in the app may reconcile the two
behind their back.

The same holds for equipment: `equipItem(characterId, slotType, composedId, config)` takes the
`Configuration` and refuses any build whose **template's** `equipmentSlotType` does not equal the
target slot — including a template with no slot type, one the ruleset does not define, and (since
TICKET-INV-05) **a build this character does not have**. Every inventory action is a Kernel call now:
`buildItem` mints a `ComposedItem` out of three checked picks through `composeBuild`, and
`discardItem` unmakes one through `discardBuild`, where the pair used to patch the inventory in
place — how a build is made and unmade is a rule the server has to agree with, not a picker
convenience, and `patchInventory` was deleted with its last caller. **The store's four inventory
actions are `equipItem` / `unequipItem` / `buildItem` / `discardItem`** since TICKET-INV-06 collapsed
the wear-and-stow pair away; each is named for the **act**, and the Kernel rule it calls is named for
what happens to the document (`equipToSlot`, `unequipSlot`, `composeBuild`, `discardBuild`).
Equipping triggers no recalculation — derived values read `equippedItems` at read time.

## Changing a persisted shape

There is no schema version and no migration runner. That makes compatibility a hand-checked
concern, so:

- **Prefer additive, optional fields** (`newThing?: X`). Existing stored JSON must still parse
  and render.
- If a change cannot be additive, it needs an explicit migration step in `storage.ts`'s load path
  (read old shape → transform → return new shape) plus a test that feeds it the old shape.
  Bumping `Configuration.version` alone changes nothing — nothing reads it yet; if you start
  relying on it, wire it into the load path in the same change.
- **Import/export is a public boundary.** `importConfiguration()` gates on `schemaVersion` first
  (`SchemaVersionError`), then `validateConfigurationShape()` inspects untrusted JSON before it is
  applied; any new required field must be added to that check, or a file exported by an older
  build will be accepted and then break at render time.
  Import validates **twice**, and the two are not interchangeable: `importExport.ts` checks
  *structure* and refuses to apply a file that fails, while `engine/validator.ts` checks
  *references* (formula codes, slot types, categories, cycles) and only reports — a
  referentially-broken ruleset is still applied, so the User can repair it in the app.
  `useConfigStore.replaceConfig(config)` is what applying an import means (the app holds one
  configuration, so it replaces rather than appends); `renameConfig(name)` renames it.
- Round-trip test: export → import must reproduce an equivalent configuration.
- **The sheet-import corpus moves with the shape.** `docs/imports/` holds one JSON fragment per
  built feature carrying that feature's real data from the source spreadsheet, merged into
  `docs/imports/ducklets.json` by `yarn run sheet:import` and validated by
  `src/shared/services/sheetImport.test.ts`. A changed entity shape means updating that entity's fragment
  and regenerating in the same change — see [docs/imports/README.md](../../../docs/imports/README.md).

## Data flow

0. **App start** — `RootLayout` calls `useAppHydration()` (`components/shared/`), which probes
   `isStorageAvailable()` and then restores both stores once per page load. Nothing else reads
   storage at start-up, and each store's `isLoaded` guard keeps it to one read.
1. **Config edit** — panel hook calls a `useConfigStore` action → state patched → `saveConfiguration()`.
2. **Character edit** — component calls a `useCharacterStore` action → state patched → `saveCharacters()`.
   `createCharacter(data, config)` takes the whole `Configuration`, not just its id: it seeds
   `currentResourceValues` to the calculated maxima — resources only — so a new character starts
   at full health. That is the one place a derived number is written onto a `Character`, and it is
   player state from then on — see the `currentResourceValues` exception above.
3. **Anything displayed as a number** — component reads `calculateCharacter(character, config)`;
   the engine parses the relevant formulas and returns the `CalculatedCharacter`.
4. **Equipment change** — inventory action updates `Inventory` → next `calculateCharacter()` call
   picks up the changed bonuses on main, speciality *and* combat skills (wiring this to the sheet
   is task 14.1).
5. **Import** — file → `validateConfigurationShape()` → `importConfiguration()` → store replaces config
   → persisted. Invalid files are rejected before anything is overwritten.
