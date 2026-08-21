# v2.1 — Code review

Full-codebase review performed **2026-08-21** at commit `6ae9e2e` (TICKET-DX-04). Method: fallow
static analysis (dead code, duplication, complexity, dependency graph) plus four parallel manual
deep-reads — engine, stores/services, config components, play/routes/ui. The top engine findings
were confirmed by executing the real modules against repro inputs, not just reading them.

**These are findings, not tickets.** Each file in [`findings/`](./findings/) is a detailed report
of one issue: evidence with file:line references, impact, and a suggested direction. When one is
picked up, expand it into a ticket with the `story-ticket` skill (respecting the three-to-be-item
size limit — several findings here will split into more than one ticket) and build it via
`work-ticket`.

## High — bugs that lose data, let broken rulesets through, or break the UI

- [ ] [CR-01 Circular-formula detection never fires in production](findings/CR-01-circular-formula-detection-dead-in-production.md) — graph keyed by ids, edges by spellings; every cycle saves cleanly with UUID ids. *(engine, repro-confirmed)*
- [ ] [CR-02 Stat formulas accept `skills.*` they can never evaluate](findings/CR-02-stat-formulas-accept-skills-they-cannot-evaluate.md) — validates and previews, always errors on the sheet. *(engine, repro-confirmed)*
- [ ] [CR-03 Malformed import persisted before validation](findings/CR-03-malformed-import-persisted-before-validation.md) — four entity kinds shape-unchecked; `replaceConfig` runs before the engine validator crashes. *(services)*
- [ ] [CR-04 Editing the lowest currency tier moves it to the end](findings/CR-04-currency-tier-order-zero-falsy.md) — `order: 0` falls through `||`. *(config)*
- [ ] [CR-05 Characters silently deleted on load](findings/CR-05-characters-silently-deleted-on-load.md) — load-time filter + next autoSave permanently drops unrecognized characters, no backup. *(services)*
- [ ] [CR-06 "Clear History" wipes every character's roll history](findings/CR-06-clear-history-wipes-all-characters.md) — display is scoped, the action isn't. *(play)*
- [ ] [CR-07 Selected archetype card is illegible](findings/CR-07-selected-archetype-card-illegible.md) — nested `Text` ink colors beat the pressed Button's parchment text. *(play)*
- [ ] [CR-20 Equipment-slot CRUD duplicated and double-mounted](findings/CR-20-equipment-slot-crud-duplicated.md) — two full implementations live on the same page. *(config)*

## Medium — correctness edges, missing guards, structural debt

- [ ] [CR-08 Phantom cycles from missing DFS backtracking](findings/CR-08-phantom-cycles-from-dfs-backtracking.md) — reports cycles along nonexistent edges; fix with CR-01. *(engine, repro-confirmed)*
- [ ] [CR-09 Tokenizer silently truncates malformed numbers](findings/CR-09-tokenizer-truncates-malformed-numbers.md) — `1.2.3` validates and evaluates as `1.2`. *(engine, repro-confirmed)*
- [ ] [CR-10 `skills.<name>.level` documented but rejected](findings/CR-10-skills-level-documented-but-rejected.md) — four doc sites vs one resolver. *(engine)*
- [ ] [CR-11 Storage quota/write errors never caught](findings/CR-11-storage-errors-thrown-but-never-caught.md) — edits silently fail to persist when LocalStorage is full. *(stores)*
- [ ] [CR-12 `updateCharacter` accepts an unguarded `Partial<Character>`](findings/CR-12-updatecharacter-unguarded-partial.md) — bypasses the XP and allocation invariants; zero callers today. *(stores)*
- [ ] [CR-13 `Dialog` lacks focus management](findings/CR-13-dialog-lacks-focus-management.md) — no trap, no initial focus, no restore; inherited by ~15 dialogs. *(ui)*
- [ ] [CR-14 Creation wizard recomputes the engine every keystroke](findings/CR-14-wizard-recomputes-engine-every-keystroke.md) — unmasked `watch()` + unmemoized `calculateCharacter`. *(play)*
- [ ] [CR-15 In-render `.sort()` mutates store state](findings/CR-15-in-render-sort-mutates-store-state.md) — `MaterialLevelFormDialog` sorts `config.currencyTiers` in place. *(config)*
- [ ] [CR-16 `DiceLaddersConfigPanel` missing the no-config guard](findings/CR-16-dice-ladders-panel-missing-config-guard.md) — interactive panel whose Add silently no-ops. *(config)*
- [ ] [CR-17 Stores enforce no uniqueness](findings/CR-17-stores-enforce-no-uniqueness.md) — bypassed UI checks can produce exports that refuse to re-import. *(stores/engine)*
- [ ] [CR-18 Slug collisions get no warning](findings/CR-18-slug-collisions-unwarned.md) — near-duplicate check compares the wrong normalization; stats have none at all. *(engine)*
- [ ] [CR-19 `engine/validator.ts` needs decomposition](findings/CR-19-engine-validator-needs-decomposition.md) — 392 lines, cyclomatic 62; half already shows the target shape. *(engine)*
- [ ] [CR-22 Shape validation should be data-driven](findings/CR-22-shape-validation-should-be-data-driven.md) — ~500 mechanical lines; would make CR-03's gap impossible. *(services)*
- [ ] [CR-23 Two generations of form dialogs](findings/CR-23-two-generations-of-form-dialogs.md) — six pre-`FormField` dialogs, three error-node spellings, footer ×13. *(config)*
- [ ] [CR-24 Manager-hook dialog-lifecycle duplication](findings/CR-24-manager-hook-dialog-lifecycle-duplication.md) — extract `useEntityDialog`, explicitly *not* a full generic manager. *(config)*
- [ ] [CR-25 `useRollManager` bypasses `scopeFor`](findings/CR-25-roll-manager-bypasses-scopefor.md) — hand-built autocomplete will drift from the validator. *(config)*

## Low — cleanups, dead code, consistency

- [x] [CR-21 `validateConfiguration` name collision](findings/CR-21-validateconfiguration-name-collision.md) — complementary validators, one name; rename the service one. *(engine/services)*
- [x] [CR-26 Constant lookup: two idioms](findings/CR-26-constant-lookup-two-idioms.md) *(engine)*
- [x] [CR-27 Level line duplicated in SheetHeader/CharacterCard](findings/CR-27-level-line-duplicated.md) *(play)*
- [x] [CR-28 Landing link hand-copies Button styles](findings/CR-28-landing-link-copies-button-styles.md) — Button can't render as a Link. *(routes/ui)*
- [x] [CR-29 FormData interfaces declared twice in eight features](findings/CR-29-formdata-interfaces-declared-twice.md) *(config)*
- [x] [CR-30 Three update actions skip `mergeClearingAbsent`](findings/CR-30-update-actions-skip-mergeclearingabsent.md) *(stores)*
- [x] [CR-31 `FormField` error prop invites `[object Object]`](findings/CR-31-formfield-error-type-too-wide.md) *(ui)*
- [x] [CR-32 ui primitive prop-API gaps](findings/CR-32-ui-primitive-prop-api-gaps.md) — no error state on Select/Textarea; `Text` swallows rest props. *(ui)*
- [x] [CR-33 `FormulaEditor` stale validation](findings/CR-33-formulaeditor-stale-validation.md) — validates only on typing, never on props. *(ui)*
- [x] [CR-34 `ValidationReport` static rows look clickable](findings/CR-34-validationreport-static-rows-look-clickable.md) *(ui)*
- [x] [CR-35 Field-array selects unlabeled and watch/setValue-driven](findings/CR-35-field-array-selects-unlabeled.md) *(config)*
- [x] [CR-36 Raw hex in Select's arrow data-URI](findings/CR-36-select-arrow-raw-hex.md) — the only raw hex in the tree. *(ui)*
- [x] [CR-37 Dead `SkillFormFields`; one-caller `BaseSkillPanel`](findings/CR-37-dead-skillformfields-and-baseskillpanel.md) *(config)*
- [x] [CR-38 Stale combat-skill copy](findings/CR-38-stale-combat-skill-copy.md) — landing page, dashboard card, validator message, doc comments. *(various)*
- [x] [CR-39 Unused exports and a storage key nothing writes](findings/CR-39-unused-exports-and-storage-key.md) *(engine/stores/services)*
- [ ] [CR-40 Dependency placement](findings/CR-40-dependency-placement.md) — one unused, one misfiled. *(package.json)*
- [ ] [CR-41 Clamp-then-round can exceed fractional bounds](findings/CR-41-clamp-then-round-exceeds-bounds.md) *(engine)*
- [ ] [CR-42 Naming drift: id vs retired code](findings/CR-42-naming-drift-id-vs-code.md) *(config/play)*
- [ ] [CR-43 Minor consistency sweep](findings/CR-43-minor-consistency-sweep.md) — five grouped one-liners. *(various)*

## Suggested pickup order

Data-integrity first: **CR-01/CR-08** (one ticket — the cycle detector), **CR-03** (+ optionally
CR-22 as its structural fix), **CR-05**. Then the user-visible bugs **CR-04, CR-06, CR-07,
CR-20, CR-16**. The engine contract fixes (CR-02, CR-09, CR-10, CR-18) form a natural "formula
engine honesty" cluster. Everything else is opportunistic.

## What the review found clean

Verified across all four reads: persistence is store-owned with zero leaks (no
`localStorage`/`save*` outside `services/storage.ts` + store actions); no second arithmetic path
(no `eval`/`new Function`; `evaluateFormulaString` has exactly four callers); no stored derived
values beyond the two sanctioned exceptions; no circular imports; no raw form elements outside
primitives' documented internals; no off-theme colors except CR-36; `useGuardedDelete` /
`ConfigPanelShell` / `FormulaPreview` at 100% adoption; error-as-value discipline (`finite()`
gate, provenance chains) is rigorous, and the golden-fixture suite exercises the real
import→store→engine chain. The problems concentrate in the older pre-sweep dialog generation and
at layer seams, not in the core.
