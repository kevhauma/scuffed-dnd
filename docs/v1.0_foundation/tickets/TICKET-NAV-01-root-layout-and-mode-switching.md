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

## Decision (2026-08-01) — how play mode prevents configuration modification

Taken without the User, who asked for the backlog to be worked straight through. **Chosen: hide the
config navigation *and* guard the routes — a `/config/*` route entered while the app is in play
mode redirects to `/play`.** Not "viewable but read-only".

Why: read-only would mean threading a disabled state through all eight config panels, their form
dialogs and their manager hooks — a large change with many places to get it wrong, and a
half-disabled form is a worse answer to "prevent" than not showing it. The guard is one check in
one place and is unambiguous.

How mode and route stay in sync without the guard defeating itself:

- Landing on a `/play/*` route sets mode to `play`; landing on a `/config/*` route **while already
  in configuration mode** keeps it `config`. Store and route therefore never disagree.
- The guard only fires when the app is in play mode and something tries to reach `/config/*` —
  i.e. mid-session. Leaving play mode is one click on the mode switcher.
- **Known limit, stated deliberately:** `useUIStore.mode` is session state and is not persisted, so
  a hard page load at a `/config/*` URL starts a fresh session in configuration mode and is
  allowed. Requirement 19.6 guards against editing the rules *while playing*; deliberately loading
  a configuration URL from scratch is leaving play, not an accident. Persisting the mode would
  change this and is not in scope.

## Acceptance criteria

- [x] `__root.tsx` contains no stock-palette classes (`gray-*`, `blue-*`, `green-*`, `white`) — only medieval theme tokens (Req 22.1-22.4). (The scaffold nav is gone; `RootLayout` is now `<AppShell>{…}</AppShell>` and carries no classes at all. The shell uses `bg-parchment-50/100`, `border-stone-200`, `text-ink-700/900`, `shadow-parchment`, `font-heading`, `ring-amber`. Test *"should carry no stock Tailwind palette classes in the shell or the root layout"* reads both files and asserts against `(text|bg|border|ring)-(gray|slate|zinc|neutral|blue|green|red)-NNN` and `bg-white`, so a regression fails the suite.)
- [x] The shell composes `components/ui` primitives instead of raw controls, and any layout classes live on the layout's own elements, not pushed into base components (Req 21.4, 21.5). (The mode switcher is two `Button`s and the footer a `Text`; no raw `<button>`. Layout — `flex`, `flex-wrap`, `gap-*`, `max-w-7xl`, `px-*` — sits on the shell's own `header`/`nav`/`div` elements. No base component was edited.)
- [x] Switching mode updates `useUIStore.mode` and navigates; entering a `/play/*` or `/config/*` URL directly sets the matching mode, so store and route never disagree (Req 19.3). (`useAppMode` derives the route's mode via `modeForPath` and syncs the store in an effect. Tests *"should set the mode and navigate when the switcher is used"*, *"should adopt the mode of the route it was entered on, so store and route agree"*, *"should leave the mode alone on a route that belongs to neither mode"* (the landing page), and `modeForPath`'s own two tests — including *"should not mistake a path that merely begins with the same letters"* (`/playground` is neither mode).)
- [x] Configuration mode shows the configuration navigation only; play mode shows the play navigation only (Req 19.4, 19.5). (Tests *"should show the configuration navigation in configuration mode, and not the play links"* and its play counterpart assert both presence **and** absence. Browser: config mode listed Dashboard/Skills/Stats/Materials/Items/Races/Currency/Focus Stat; play mode listed Characters/New Character and none of the config links.)
- [x] While in play mode, configuration cannot be modified — including via a direct `/config/*` URL, not just via hidden links (Req 19.6). The chosen mechanism is stated on this ticket. (See the Decision section above: hidden links **plus** a redirect. Test *"should redirect a config route away while in play mode"* asserts `navigate({ to: '/play', replace: true })` and that the lock beats the route-to-mode sync rather than quietly switching to config. Browser: in play mode, pushing `/config/skills` landed back on `/play` with the character list rendered.)
- [x] Keyboard focus is visible on every interactive element in the shell, and text meets the theme's contrast bar (Req 22.6). (Every shell link carries `focus-visible:ring-2 focus-visible:ring-amber`, asserted for all of them by test *"should give every interactive element a visible focus ring"*; the `Button` primitive brings its own focus ring. Text uses `ink-700`/`ink-900` on `parchment-50`/`parchment-100` — the theme's intended pairings, unchanged from the primitives.)
- [x] The layout is usable at a narrow viewport (nav does not overflow or clip). (Both nav rows are `flex-wrap`. Browser at 375×812: `document.documentElement.scrollWidth === clientWidth === 375` — no horizontal overflow — in play mode and again in configuration mode with all 8 links wrapping.)
- [x] Unit tests cover: mode switch calls `setMode`; nav contents differ per mode; a `/config` route while in play mode is blocked by the chosen mechanism. (+11 tests in `src/components/shared/AppShell.test.tsx`. Suite: 539 passing, 0 failing, 0 skipped. `src/routes/__root.test.tsx` now mocks `AppShell`, keeping that file about hydration wiring.)
- [x] Verified via the fallow skill and the ~~react-conventions~~ **coding-conventions** skill *(renamed since the ticket was written)*. (`fallow audit --base HEAD` → `"verdict": "pass"`, 0 introduced findings of any kind. Conventions: the shell and its hook live in `components/shared/` behind the `export *` barrel, mode state stays in `useUIStore` (session-only, not persisted), and the shell holds no store logic beyond the hook.)
- [x] Verified live in the browser: on `localhost:5173` — `/config` showed the configuration nav with the Configuration button `aria-pressed="true"` and the footer reading "Configuration mode — you are editing the ruleset."; clicking Play navigated to `/play`, swapped the nav to Characters/New Character and the footer to "Play mode — the ruleset is locked while you play."; pushing `/config/skills` while in play mode redirected straight back to `/play`; and at 375px wide neither mode overflowed horizontally.

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
