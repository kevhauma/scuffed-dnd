# TICKET-NAV-01 — Root layout: medieval shell, real mode switching, play-mode config lock

- **Area:** Navigation and layout
- **Type:** Bug fix
- **Traceability:** Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 21.4, 21.5, 22.1-22.6
- **Replaces plan items:** tasks.md §13.1

## User story

As a User and Player, I want the app shell to look like the rest of the app and to actually switch
between configuration and play mode, so that the interface matches what I'm doing and doesn't
break the medieval theme the moment I look at the header.

## Description

The root layout is still the untouched project scaffold: stock Tailwind greys and blues, two hard
links, and no connection to the app's mode state. It is the one component every route renders
inside, so it currently violates the theme requirement on every screen and leaves Requirement 19's
mode behaviour entirely unimplemented — including 19.6, which is a data-safety rule, not cosmetics.

## Current situation (as-is)

- [`src/routes/__root.tsx`](../../../src/routes/__root.tsx) `RootLayout` uses `bg-gray-50`,
  `bg-white`, `text-gray-900`, `bg-blue-600`, and `bg-green-600` — stock palette, no medieval
  theme tokens, no base components, raw `<nav>`/`<div>` markup (Req 22.1-22.4, 21.4).
- Mode is expressed only as two `<Link>`s to `/config` and `/play`.
  [`useUIStore`](../../../src/stores/uiStore.ts) already holds `mode: 'config' | 'play'` with
  `setMode()` — **the root layout never reads or writes it**, so the store's mode is permanently
  `'config'` regardless of where the user is (Req 19.3).
- Navigation is identical in both modes: there is no per-mode nav listing the configuration
  sections or the play-mode screens (Req 19.4, 19.5).
- Nothing prevents configuration edits while in play mode (Req 19.6) — the config routes are
  reachable and fully editable at any time.
- [`src/components/Header.tsx`](../../../src/components/Header.tsx) exists outside the three
  component folders; check whether it is used before adding a second header.
- The Kiro-era [SETUP_SUMMARY.md](../SETUP_SUMMARY.md) claims "Root layout includes mode switcher
  between Configuration and Play modes" — that was aspirational and is not true of the code.

## Desired result (to-be)

- The shell is rebuilt from `components/ui` primitives and theme tokens: parchment background, ink
  text, `font-heading` for the title, `shadow-parchment` where the scaffold used `shadow-sm`. No
  stock palette classes survive in `__root.tsx`.
- A real mode switcher reads and writes `useUIStore.mode`, and the mode stays in sync with the
  route (landing on `/play/...` puts the app in play mode, and vice versa) so the two can never
  disagree.
- Navigation is per-mode: configuration mode lists the config sections (skills, stats, materials,
  items, races, currency); play mode lists the play screens. The other mode's links are not shown.
- Play mode prevents configuration modification (Req 19.6). Choose the mechanism and record it on
  the ticket: the honest options are hiding the config routes from navigation *plus* redirecting
  direct `/config/*` navigation while in play mode, or keeping them viewable but read-only. Hiding
  the links alone does not satisfy "prevent" when the URLs still work.
- The layout is responsive and keeps the theme's accessibility bar (focus rings, contrast).

## Acceptance criteria

- [ ] `__root.tsx` contains no stock-palette classes (`gray-*`, `blue-*`, `green-*`, `white`) — only medieval theme tokens (Req 22.1-22.4).
- [ ] The shell composes `components/ui` primitives instead of raw controls, and any layout classes live on the layout's own elements, not pushed into base components (Req 21.4, 21.5).
- [ ] Switching mode updates `useUIStore.mode` and navigates; entering a `/play/*` or `/config/*` URL directly sets the matching mode, so store and route never disagree (Req 19.3).
- [ ] Configuration mode shows the configuration navigation only; play mode shows the play navigation only (Req 19.4, 19.5).
- [ ] While in play mode, configuration cannot be modified — including via a direct `/config/*` URL, not just via hidden links (Req 19.6). The chosen mechanism is stated on this ticket.
- [ ] Keyboard focus is visible on every interactive element in the shell, and text meets the theme's contrast bar (Req 22.6).
- [ ] The layout is usable at a narrow viewport (nav does not overflow or clip).
- [ ] Unit tests cover: mode switch calls `setMode`; nav contents differ per mode; a `/config` route while in play mode is blocked by the chosen mechanism.
- [ ] Verified via the fallow skill and the react-conventions skill.
- [ ] Verified live in the browser: switch modes both ways, deep-link into each mode, attempt a config URL while in play mode, and check the shell at a narrow width.

## Notes

- Prefer landing this **after** the first play-mode screens exist (TICKET-CHAR-01/02), so the play
  navigation has real destinations — but before any polish pass, since §17.5's theme-consistency
  check would otherwise just rediscover this.
- TICKET-IO-01 also edits `__root.tsx` (hydration on mount). Whichever lands second keeps the
  other's change.
- The dashboard at [`/config/index.tsx`](../../../src/routes/config/index.tsx) carries the same
  stock-palette problem in its heading block, and also renders the three skills panels that
  `/config/skills` owns. Both are out of scope here — note them for the §17.5 polish pass rather
  than widening this ticket.
