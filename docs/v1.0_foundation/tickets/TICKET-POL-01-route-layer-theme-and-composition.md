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

Stock Tailwind palette classes (`text-gray-600`, `bg-blue-600`, `bg-green-600`, `bg-gray-50`,
`bg-white`, `text-gray-900`) by file:

| File | Hits |
|---|---|
| [`routes/index.tsx`](../../../src/routes/index.tsx) | 15 |
| [`routes/__root.tsx`](../../../src/routes/__root.tsx) | 6 |
| [`components/Header.tsx`](../../../src/components/Header.tsx) | 6 |
| [`routes/config/index.tsx`](../../../src/routes/config/index.tsx) | 2 |
| `routes/config/{skills,stats,materials,items,races,currency}.tsx` | 1 each |
| `routes/play/{index,create,character.$id}.tsx` | 1 each |

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

- [ ] A grep for `(bg|text|border|ring)-(gray|slate|zinc|neutral|blue|green|red|indigo|purple|yellow|pink)-[0-9]` over `src/routes/` returns nothing.
- [ ] No `bg-white` / `text-white` remains in `src/routes/`.
- [ ] Route-level headings and paragraphs render through the `Text` primitive rather than raw `<h1>`/`<p>` with utility classes (Req 21.4).
- [ ] Layout and positioning still live on the route wrappers, not pushed into base components (Req 21.5).
- [ ] `src/components/Header.tsx` is deleted, or its adoption by the shell is recorded here with a link.
- [ ] The landing page uses theme tokens and primitives throughout.
- [ ] Contrast and focus visibility hold after the swap — no text below the theme's readability bar (Req 22.5, 22.6).
- [ ] No behaviour change: routes render the same components with the same props; tests fail no more than the [TEST_STATUS.md](../../../TEST_STATUS.md) baseline.
- [ ] Verified via the fallow skill and the react-conventions skill.
- [ ] Verified live in the browser: walk `/`, `/config`, every `/config/*`, and every `/play/*` and confirm one consistent look.

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
