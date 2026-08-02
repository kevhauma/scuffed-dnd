# TICKET-POL-01 — Route layer: medieval theme, base components, dead file removal

- **Area:** Polish
- **Type:** Refactor
- **Traceability:** Requirements 22.1, 22.2, 22.3, 22.4, 21.4, 21.5
- **Replaces plan items:** tasks.md §17.5 (theme consistency), part of §17.6

## User story

As a User and Player, I want every page to look like the same application, so that the medieval
theme doesn't stop at the edge of the panels.

## Description

The component library is themed and the config panels use it, but the layer above them — the route
files and the landing page — is still project scaffold: stock greys and blues, raw `<h1>`/`<p>`
markup instead of the `Text` primitive, and a `Header.tsx` that nothing imports. 38 stock-palette
classes across 13 files, and they are on every screen the User actually opens.

## Current situation (as-is)

> **Rescoped 2026-08-01, when the ticket was picked up.** The table below was written before
> TICKET-NAV-01/NAV-02, the CHAR/INV/ROLL tickets and TICKET-VAL-01 landed, and every one of those
> replaced route bodies as it went. Re-grepping at implementation time, **only
> `routes/index.tsx` still offends** — 15 stock-palette hits plus 5 `text-white`. Every other route
> file listed below is already clean, and the play routes grew tests asserting they stay that way.
> `Header.tsx` is still dead. The original table is kept for the record:

| File | Hits (as written) | Actual, 2026-08-01 |
|---|---|---|
| [`routes/index.tsx`](../../../src/routes/index.tsx) | 15 | **15 — still the whole ticket** |
| [`routes/__root.tsx`](../../../src/routes/__root.tsx) | 6 | 0 — rewritten by TICKET-NAV-01 |
| [`components/Header.tsx`](../../../src/components/Header.tsx) | 6 | 6, still imported by nothing |
| [`routes/config/index.tsx`](../../../src/routes/config/index.tsx) | 2 | 0 — reduced to a mount by TICKET-VAL-01 |
| `routes/config/{skills,stats,materials,items,races,currency}.tsx` | 1 each | 0 — TICKET-NAV-02 |
| `routes/play/{index,create,character.$id}.tsx` | 1 each | 0 — TICKET-CHAR-01/02/03 |

- The route files also use raw `<h1 className="text-3xl font-bold">` / `<p>` markup rather than the
  `Text` primitive, contrary to Requirement 21.4 — the same primitive the panels use one level down,
  which is why headings look different depending on where you are.
- [`src/components/Header.tsx`](../../../src/components/Header.tsx) is **imported by nothing** —
  dead since the scaffold, and one of the theme offenders.
- The landing page at [`routes/index.tsx`](../../../src/routes/index.tsx) is the worst single file
  and is the first thing anyone sees.

## Desired result (to-be)

- No stock-palette class remains anywhere in `src/routes/` — only medieval theme tokens
  (`parchment-*`, `ink-*`, `stone-*`, `crimson`, `forest`, `royal`, `amber`, `font-heading`,
  `font-body`, `shadow-parchment*`).
- Route-level headings and body copy use the `Text` primitive; page chrome uses `Card` where it is
  a panel-like surface. Layout classes (padding, max-width, grid) stay on the route's own wrapper —
  that part is correct and stays.
- `Header.tsx` is deleted (it is dead), unless the shell work adopts it — check
  [TICKET-NAV-01](./TICKET-NAV-01-root-layout-and-mode-switching.md) first and delete only if it
  stays unused.
- The landing page reads as part of the same app: themed, using primitives, and honest about what
  the two modes do.

## Acceptance criteria

- [x] A grep for `(bg|text|border|ring)-(gray|slate|zinc|neutral|blue|green|red|indigo|purple|yellow|pink)-[0-9]` over `src/routes/` returns nothing. (Verified by grep, and pinned by test *"should carry no stock Tailwind palette classes"* in [`index.test.tsx`](../../../src/routes/index.test.tsx) — which also covers `cyan` and the gradient prefixes `from-`/`via-`/`to-`, since the old landing page used `from-slate-900` and `via-blue-500/10`. The play and config routes already had equivalent tests.)
- [x] No `bg-white` / `text-white` remains in `src/routes/`. (Test *"should carry no white surfaces or text"*.)
- [x] Route-level headings and paragraphs render through the `Text` primitive rather than raw `<h1>`/`<p>` with utility classes (Req 21.4). (Test *"should render its headings and copy through the Text primitive"* asserts no `<h1-6 className=` and no `<p className=` remain, and that `<Text` is present. The page now composes `Card` + `Text` throughout.)
- [x] Layout and positioning still live on the route wrappers, not pushed into base components (Req 21.5). (`mx-auto max-w-5xl p-6`, `grid gap-6 md:grid-cols-2`, `flex h-full flex-col p-8` are all passed via `className` from the route; no file under `components/ui/` was touched by this ticket.)
- [x] `src/components/Header.tsx` is deleted, or its adoption by the shell is recorded here with a link. (**Deleted.** It was the TanStack scaffold header — hamburger menu, TanStack word logo, a single "Home" link — imported by nothing. `AppShell` ([TICKET-NAV-01](./TICKET-NAV-01-root-layout-and-mode-switching.md)) is the real shell and did not adopt it. `grep -rn "components/Header"` over `src/` found no importers before removal.)
- [x] The landing page uses theme tokens and primitives throughout. (`Card`, `Text`, and theme tokens only. The copy was also corrected while rewriting: it now describes what the app actually does — including that a ruleset travels as a JSON file, which is true as of [TICKET-IO-02](./TICKET-IO-02-export-import-and-rename-configuration.md) — rather than the scaffold's claims. The two mode blocks are data-driven from one `MODES` constant instead of duplicated markup.)
- [x] Contrast and focus visibility hold after the swap — no text below the theme's readability bar (Req 22.5, 22.6). (All text is `Text` variants (`ink-900`/`ink-700`) on `parchment`, the combinations used across every existing panel. The two mode links carry `focus-visible:ring-2 focus-visible:ring-amber`, matching the dashboard's section links. **Not** independently contrast-measured — that needs the browser check below.)
- [x] No behaviour change: routes render the same components with the same props; tests fail no more than the [TEST_STATUS.md](../../../TEST_STATUS.md) baseline. (Both links still point at `/config` and `/play`, asserted in test *"should offer a way into both modes"*. Suite: **646 passing, 0 failing, 0 skipped** (was 641). `npx tsc --noEmit` at the documented 9.)
- [x] Verified via the fallow skill and the ~~react-conventions~~ **coding-conventions** skill *(renamed since the ticket was written)*. (`fallow audit --base HEAD` → `"verdict": "pass"`, 0 introduced findings. One was fixed rather than deferred: deleting `Header.tsx` orphaned **`lucide-react`**, which existed solely for that file's icons — removed with `yarn remove`, since a dependency kept alive only by a file this ticket deletes is the tail of the same deletion, not a separate refactor. `grep -rn "lucide-react" src/` confirms nothing else imported it. **`yarn run lint` is now 33 errors, down from the documented 35** — the two that went with `Header.tsx`; TEST_STATUS.md updated to match, since the new number is the permanent one.)
- [ ] Verified live in the browser: walk `/`, `/config`, every `/config/*`, and every `/play/*` and confirm one consistent look. — **left open at the User's request** (2026-08-01: "don't browser check"). This is the criterion this ticket most wants: it is a **visual** refactor, and grep can prove the offending classes are gone but not that the result looks right. The contrast criterion above leans on the same gap.

## Notes

- **Sequence matters.** [TICKET-NAV-02](./TICKET-NAV-02-wire-config-routes-to-panels.md) replaces
  most placeholder route bodies with real panels, and
  [TICKET-NAV-01](./TICKET-NAV-01-root-layout-and-mode-switching.md) rewrites `__root.tsx`. Do this
  ticket **after both**, or it will re-theme markup that is about to be deleted. `__root.tsx` is
  NAV-01's, not this ticket's — the table above lists it for completeness only.
- Base-component-internal violations (`bg-white`, hex literals, `w-full` on roots) are
  [TICKET-UI-01](./TICKET-UI-01-base-component-convention-cleanup.md). This ticket stops at the
  route layer.
- Pure refactor: no new screens, no new behaviour. If a route needs real content rather than a
  re-theme (the landing page arguably does), keep that scoped to the landing page and say so.
