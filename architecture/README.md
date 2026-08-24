# `architecture/`

The rules in [`.dependency-cruiser.mjs`](../.dependency-cruiser.mjs), proven by modules that break
them.

| File | What it is |
|---|---|
| [`boundaries.test.ts`](./boundaries.test.ts) | Cruises the fixtures with the real rule set and asserts each rule fires |

It lives outside `src/` on purpose: `src/` holds exactly three roots
([D14](../docs/v3.0_backend/overview.md#d14--three-roots-client-server-shared)), and a suite about
the boundary between them belongs to none of them.

## Why a test at all

`yarn run check` cruises `src/` and reports nothing — which is also exactly what a rule set with a
typo in a path pattern reports. The check passing tells you the tree is clean *or* that the tool is
blind, and those two look identical from the outside.

So each rule is asserted against a module that really violates it: a real module, in a real root,
with a real forbidden import. Those live in `boundaryFixtures/` directories inside the three roots,
which the enforcing config excludes for the obvious reason; this suite cruises them with the
exclusion lifted.

One fixture — [`reachesSharedByAlias.ts`](../src/client/boundaryFixtures/reachesSharedByAlias.ts) —
is *legal*, and the suite asserts it comes back clean. Without it, a rule set that refused every
crossing would pass every other test in the file.

## Adding a rule

TICKET-DX-08 adds the wider rules (store-owned persistence, repository-owned queries, UI primitives
as leaves). Each one lands with a fixture that breaks it, and the suite's last test —
*reports every rule in the config at least once* — fails if one arrives without.
