# `architecture/`

The rules in [`.dependency-cruiser.mjs`](../.dependency-cruiser.mjs), proven by modules that break
them.

| File | What it is |
|---|---|
| [`boundaries.test.ts`](./boundaries.test.ts) | Cruises `src/` with the fixture exemption lifted and asserts each rule fires — and that nothing but a fixture breaks one |

It lives outside `src/` on purpose: `src/` holds exactly three roots
([D14](../docs/v3.0_backend/overview.md#d14--three-roots-client-server-shared)), and a suite about
the boundary between them belongs to none of them.

## Why a test at all

`yarn run check` cruises `src/` and reports nothing — which is also exactly what a rule set with a
typo in a path pattern reports. The check passing tells you the tree is clean *or* that the tool is
blind, and those two look identical from the outside.

So each rule is asserted against a module that really violates it: a real module, in a real place,
with a real forbidden import. Those live in `boundaryFixtures/` directories, which the enforcing
config excludes **as sources**; this suite cruises the whole tree with that one exemption lifted and
every other exemption kept.

Lifting only that one is what lets the same run prove the second half: *no module that is not a
fixture breaks any rule*. Every other `pathNot` in the config is a recorded decision, and treating
those as failures here would report the project's own choices as violations.

One fixture — [`reachesSharedByAlias.ts`](../src/client/boundaryFixtures/reachesSharedByAlias.ts) —
is *legal*, and the suite asserts it comes back clean. Without it, a rule set that refused every
crossing would pass every other test in the file.

## Adding a rule

Each rule lands with a fixture that breaks it, and the suite's *reports every rule in the config at
least once* test fails if one arrives without. Put the fixture in a `boundaryFixtures/` directory
that the rule's `from` actually matches — `types-are-the-bottom-layer` needs one under
`shared/types/`, `ui-primitives-are-leaves` one under `components/ui/`.

`yarn run arch` reports with `--output-type err-long`, which is the form that prints a rule's
`comment`. Write the comment as the sentence you would want to read at 6pm on a Friday: what was
crossed, and which decision says not to.

## What dependency-cruiser cannot express

**It sees imports. It cannot see a call.** These obligations are real, are stated in
[CLAUDE.md](../CLAUDE.md), and are covered by purpose-written tests instead — the boundary between
the two mechanisms, written down rather than rediscovered.

| Obligation | Why the tool is blind to it | What covers it |
|---|---|---|
| Every route naming an owned resource **calls** a guard (v3 Req 51.10) | A handler that imports `requireAccount` and never calls it satisfies every import rule there is | AUTH-03's per-route tests: each route refuses a non-owner, a non-member and an anonymous caller — the milestone's Definition of Done rule 2 |
| No `localStorage` **call** outside the storage service | A direct `window.localStorage` touch is a global, not an import | `persistence-belongs-to-the-store` covers the module edge; the global is caught by review and by `fallow` |
| No derived value crosses the wire as input | About request bodies, not modules | Per-route tests; Definition of Done rule 3 |
| The server opens no outbound connection at all | `fetch` is a global; only an *import* of a mail client or a socket is an edge | `the-server-sends-no-mail` (TICKET-GAM-03) covers the imports a mail feature would actually need — `node:net`/`tls`/`dgram` and the usual providers. A hand-rolled `fetch` to an API is not caught here and is review's, which is why the rule is named for the decision (D12) rather than for the mechanism |
| All user-authored math goes through the formula engine | `eval` and `new Function` are globals | Review, plus the engine being the only thing that knows the grammar |
| Base components carry intrinsic styling only | Class strings, not edges | [`libraryConventions.test.ts`](../src/client/components/ui/libraryConventions.test.ts), which owns the styling half while `ui-primitives-are-leaves` owns the import half |
| Derived values are computed, never stored | A shape question, not a graph one | The `data-model` skill's rules, `importExport.ts`'s retired-field refusals, and the golden fixtures |

**Dead code and duplication are `fallow`'s**, not this file's. `no-orphans` here is a cheap first
look and reports as a *warning* because of how little it actually covers: dependency-cruiser's
orphan predicate is **no dependencies *and* no dependents**, so it returns false the moment a
module has a single import. A dead file that imports anything — which is nearly every dead file —
is not an orphan. What it catches is a self-contained leftover, and nothing more.
