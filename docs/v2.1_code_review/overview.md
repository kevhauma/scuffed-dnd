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

- [x] [CR-01 Circular-formula detection never fires in production](findings/CR-01-circular-formula-detection-dead-in-production.md) — graph keyed by ids, edges by spellings; every cycle saves cleanly with UUID ids. *(engine, repro-confirmed)*
- [x] [CR-02 Stat formulas accept `skills.*` they can never evaluate](findings/CR-02-stat-formulas-accept-skills-they-cannot-evaluate.md) — validates and previews, always errors on the sheet. *(engine, repro-confirmed)*
- [x] [CR-03 Malformed import persisted before validation](findings/CR-03-malformed-import-persisted-before-validation.md) — four entity kinds shape-unchecked; `replaceConfig` runs before the engine validator crashes. *(services)*
- [x] [CR-04 Editing the lowest currency tier moves it to the end](findings/CR-04-currency-tier-order-zero-falsy.md) — `order: 0` falls through `||`. *(config)*
- [x] [CR-05 Characters silently deleted on load](findings/CR-05-characters-silently-deleted-on-load.md) — load-time filter + next autoSave permanently drops unrecognized characters, no backup. *(services)*
- [x] [CR-06 "Clear History" wipes every character's roll history](findings/CR-06-clear-history-wipes-all-characters.md) — display is scoped, the action isn't. *(play)*
- [x] [CR-07 Selected archetype card is illegible](findings/CR-07-selected-archetype-card-illegible.md) — nested `Text` ink colors beat the pressed Button's parchment text. *(play)*
- [x] [CR-20 Equipment-slot CRUD duplicated and double-mounted](findings/CR-20-equipment-slot-crud-duplicated.md) — two full implementations live on the same page. *(config)*

**All eight High findings are done** (2026-08-22), one commit each, plus CR-08 with CR-01 as the
finding asks. Verified together at the end: `npx vitest run` 1674 passing / 0 failing / 0 skipped,
`npx tsc --noEmit` at its 2 known errors, `yarn run check` clean, `fallow audit --base 62a827a`
reporting `dead_code_introduced: 0` and `duplication_introduced: 0`, and a live pass on the dev
server.

What the browser confirmed: editing the lowest currency tier keeps it at `Order: 0` and at the
bottom of the ladder (CR-04); `/config/items` now shows one Add-Equipment-Slot button, one slot
list and one dialog, under a panel titled "Items" (CR-20); the selected archetype card computes
royal `rgb(46,64,87)` with its name at **10.22:1** and its description and affinity lines at
**7.68:1**, against near-black-on-dark-blue before (CR-07); clearing Bree's roll history removed her
two rolls and left Aria's three standing (CR-06); editing Strength to `stats.strength + 1` is
refused with **"Circular dependency detected: Strength → Strength"** — the stat's name, not its
UUID — and nothing reaches LocalStorage (CR-01); and `skills.stealth + 1` on a stat is refused
**and the preview says so too** rather than vouching for it (CR-02). No new console errors.

Two things the fallow audit surfaced and this pass deliberately did not widen into:
`validateConfigurationShape`'s complexity is the pre-existing finding
[CR-22](findings/CR-22-shape-validation-should-be-data-driven.md) owns, and the one new complexity
finding — `itemShapeErrors` at cyclomatic 11 — is a flat list of field checks in exactly the shape
its siblings `rollDefinitionShapeErrors` (11) and `diceLadderShapeErrors` (12) already have. Making
that family data-driven is CR-22's whole point.

One limitation worth recording: `validateFormulaChange` resolves an edited formula's references
against the configuration **as it is now**, not as it would be after the save. An edit that renames
a stat *and* has it name itself by the new spelling is refused as an unknown member rather than as a
cycle — still a refusal, different message. A brand-new stat that names itself is the same case.

## Medium — correctness edges, missing guards, structural debt

- [x] [CR-08 Phantom cycles from missing DFS backtracking](findings/CR-08-phantom-cycles-from-dfs-backtracking.md) — reports cycles along nonexistent edges; fix with CR-01. *(engine, repro-confirmed)*
- [x] [CR-09 Tokenizer silently truncates malformed numbers](findings/CR-09-tokenizer-truncates-malformed-numbers.md) — `1.2.3` validates and evaluates as `1.2`. *(engine, repro-confirmed)*
- [x] [CR-10 `skills.<name>.level` documented but rejected](findings/CR-10-skills-level-documented-but-rejected.md) — four doc sites vs one resolver. *(engine)*
- [x] [CR-11 Storage quota/write errors never caught](findings/CR-11-storage-errors-thrown-but-never-caught.md) — edits silently fail to persist when LocalStorage is full. *(stores)*
- [x] [CR-12 `updateCharacter` accepts an unguarded `Partial<Character>`](findings/CR-12-updatecharacter-unguarded-partial.md) — bypasses the XP and allocation invariants; zero callers today. *(stores)*
- [x] [CR-13 `Dialog` lacks focus management](findings/CR-13-dialog-lacks-focus-management.md) — no trap, no initial focus, no restore; inherited by ~15 dialogs. *(ui)*
- [x] [CR-14 Creation wizard recomputes the engine every keystroke](findings/CR-14-wizard-recomputes-engine-every-keystroke.md) — unmasked `watch()` + unmemoized `calculateCharacter`. *(play)*
- [x] [CR-15 In-render `.sort()` mutates store state](findings/CR-15-in-render-sort-mutates-store-state.md) — `MaterialLevelFormDialog` sorts `config.currencyTiers` in place. *(config)*
- [x] [CR-16 `DiceLaddersConfigPanel` missing the no-config guard](findings/CR-16-dice-ladders-panel-missing-config-guard.md) — interactive panel whose Add silently no-ops. *(config)*
- [x] [CR-17 Stores enforce no uniqueness](findings/CR-17-stores-enforce-no-uniqueness.md) — bypassed UI checks can produce exports that refuse to re-import. *(stores/engine)*
- [x] [CR-18 Slug collisions get no warning](findings/CR-18-slug-collisions-unwarned.md) — near-duplicate check compares the wrong normalization; stats have none at all. *(engine)*
- [x] [CR-19 `engine/validator.ts` needs decomposition](findings/CR-19-engine-validator-needs-decomposition.md) — 392 lines, cyclomatic 62; half already shows the target shape. *(engine)*
- [x] [CR-22 Shape validation should be data-driven](findings/CR-22-shape-validation-should-be-data-driven.md) — ~500 mechanical lines; would make CR-03's gap impossible. *(services)*
- [x] [CR-23 Two generations of form dialogs](findings/CR-23-two-generations-of-form-dialogs.md) — six pre-`FormField` dialogs, three error-node spellings, footer ×13. *(config)*
- [x] [CR-24 Manager-hook dialog-lifecycle duplication](findings/CR-24-manager-hook-dialog-lifecycle-duplication.md) — extract `useEntityDialog`, explicitly *not* a full generic manager. *(config)*
- [x] [CR-25 `useRollManager` bypasses `scopeFor`](findings/CR-25-roll-manager-bypasses-scopefor.md) — hand-built autocomplete will drift from the validator. *(config)*

**All sixteen Medium findings are done** (2026-08-22), one commit each, plus a follow-up commit for
what the audit surfaced. Verified together at the end: `npx vitest run` 1722 passing / 0 failing /
0 skipped (from 1674), `npx tsc --noEmit` at its 2 known errors, `yarn run check` clean, and
`fallow audit --base 827216e` reporting `dead_code_introduced: 0` and `duplication_introduced: 0`.

What the browser confirmed on the dev server: `/config/rolls` with no ruleset shows two notices and
**no** Add-Ladder button, where the second panel used to be fully interactive (CR-16). Opening the
currency dialog puts focus on **Name**, not the close button; Tab from the last control wraps to the
first, Shift+Tab wraps backwards, focus parked on the nav link behind the overlay is pulled back in,
and closing returns focus to **Add Currency Tier** (CR-13). Making `setItem` throw a
`QuotaExceededError` raises the banner — *"Browser Storage Is Full … could not be saved and was not
applied"* — with the tier neither on screen nor on disk, which is the claim the wording makes, and
no exception escaping; the next write after recovery saves normally at `order 0` (CR-11, CR-04
still holding). Adding a stat abbreviated `str` against an existing `STR` is refused by the store
with *`STR is already used by "Strength"`* on the field, dialog open, nothing persisted (CR-17).
`Max-Health` and `Max Health` — different lowercased, identical slug — raise *"are all written
stats.max_health in a formula, so "Max-Health" is the one any formula naming it answers with"*
(CR-18). A stat formula of `STR * 1.2.3` is refused as *"Malformed number '1.2.' … at most one
decimal point"* rather than saving and evaluating as `1.2` (CR-09). A roll input of
`skills.stealth.level + STR` saves, round-trips to its display spelling, and its `FormulaPreview`
computes the ladder (1→1.2 … 50→60) — the spelling the resolver used to refuse (CR-10). Typing `M`
in that input offers exactly `MXH` and `MHP` (CR-25), and the field is now reachable by its **Input**
label at all (CR-13's `FormulaEditor` half). The migrated item and equipment-slot dialogs focus
their first field, carry `FormField` labels and helper text, report refusals in the one shared
crimson error node, and end in a `FormDialogActions` footer (CR-23); the skill dialog's weight rows
keep their `Stat for weight row 1` / `Weight for row 1` labels through the shared
`StatValueRowsField`. No application console errors on any screen.

One rough edge the browser exposed and this pass did **not** smooth: on a storage failure the dialog
still closes, because a refused *write* is reported through `uiStore` rather than back to the caller,
so the User has to retype. CR-11 asked for surfacing at the `autoSave` choke point and got it;
threading a second failure channel through every action is a larger change and wants its own finding.

CR-12, CR-14, CR-15, CR-19, CR-22 and CR-24 have no separate browser surface — they are covered by
unit tests, with CR-14's memoisation asserted by counting real `calculateCharacter` calls and CR-15's
by checking the store's array order after a render.

Three of the structural findings were the bulk of it. **CR-19** took `validateConfiguration` from
392 lines and cyclomatic 62 — the worst hotspot in the repo — to eleven lines that concatenate a
table of `(config) => ValidationIssue[]` helpers. **CR-22** replaced the import shape layer's
thirteen hand-written checkers with one walker over `ENTITY_SPECS`, whose key type is derived from
`Configuration`, so a new collection without a spec is now a *type error* rather than the silence
that let CR-03 in. **CR-23/CR-24** finished the dialog consolidation: `useEntityDialog` in nine
managers, `FormDialogActions` in all thirteen dialogs, the six older dialogs onto `FormField`, and
`StatValueRowsField` for the duplicated field-array rows the Low pass deferred here.

One introduced complexity finding stands deliberately: `itemIssues` at cyclomatic 10 is a flat list
of three independent reference checks — the shape the Low pass already recorded for its siblings —
and splitting it would move the number without improving the code.

Two behaviour changes worth knowing about, both widening a refusal rather than narrowing one.
`1.2.3` and `1.` are now syntax errors where they used to evaluate as `1.2` and `1` (CR-09), so a
ruleset carrying a typo'd literal that used to import will now be refused — correctly, but loudly.
And the store refuses a duplicate stat abbreviation case-insensitively (CR-17), which is stricter
than the import check; that is the safe direction, since the store can never persist something
import would reject.

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
- [x] [CR-40 Dependency placement](findings/CR-40-dependency-placement.md) — one unused, one misfiled. *(package.json)*
- [x] [CR-41 Clamp-then-round can exceed fractional bounds](findings/CR-41-clamp-then-round-exceeds-bounds.md) *(engine)*
- [x] [CR-42 Naming drift: id vs retired code](findings/CR-42-naming-drift-id-vs-code.md) *(config/play)*
- [x] [CR-43 Minor consistency sweep](findings/CR-43-minor-consistency-sweep.md) — five grouped one-liners. *(various)*

**All nineteen Low findings are done** (2026-08-21), one commit each, verified together at the end:
`npx vitest run` 1640 passing / 0 failing / 0 skipped, `npx tsc --noEmit` at its 2 known errors,
`yarn run check` clean, `fallow audit --base 63ad919` reporting `dead_code_introduced: 0`, and a
live browser pass on the dev server. What the browser confirmed: the landing-page CTA now carries
`Button`'s secondary classes verbatim at the same full-card width (CR-28) with the rewritten copy
(CR-38); the dashboard card reads "Competences weighted over stats" (CR-38); rename drafts commit
and release from the hook (CR-43); LocalStorage holds only the two keys (CR-39); both field-array
row sets register their selects with a per-row `aria-label` and save the right stat id (CR-35); the
items empty state is the shared card (CR-43); the sheet reads "Level 1 · 0 XP · No races" and the
list card "Level 1" from one component (CR-27); and a duplicate abbreviation reports
`Duplicate stat abbreviation "STR" used by: …` in a row with `cursor: auto`, no `role` and no tab
stop (CR-38 + CR-34). No console errors on any screen.

Two things the audit surfaced and this pass deliberately did **not** widen into: the
`validateConfigurationShape` complexity finding is the pre-existing one CR-22 owns (fallow reads
the CR-21 rename as a new function), and the two new duplication groups between
`SkillFormDialog` and `MaterialLevelFormDialog` are the field-array rows becoming *identical* now
that both follow the same correct pattern — consolidating them belongs with
[CR-23](findings/CR-23-two-generations-of-form-dialogs.md) /
[CR-24](findings/CR-24-manager-hook-dialog-lifecycle-duplication.md).

## Status

**All 43 findings are closed** — the nineteen Low on 2026-08-21, the eight High and the sixteen
Medium on 2026-08-22. Nothing from this review is outstanding.

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
