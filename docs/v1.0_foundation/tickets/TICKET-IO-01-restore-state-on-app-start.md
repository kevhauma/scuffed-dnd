# TICKET-IO-01 — Restore configuration and characters on app start

- **Area:** Persistence
- **Type:** Bug fix
- **Traceability:** Requirements 17.3, 17.4
- **Replaces plan items:** none — §8 and §17.1 assume this works; it doesn't

## User story

As a User and Player, I want my configuration and my characters to be there whichever page I open,
so that a bookmark or a refresh on a character sheet doesn't show me an empty app.

## Description

Requirement 17.3 and 17.4 say the Application restores the last used Configuration and all saved
Characters *on load*. Today restoration is triggered by one route component, and character
restoration is never triggered at all — so anything reached directly (a refresh on
`/play/character/$id`, a bookmarked `/config/skills`) renders against empty state even though the
data is sitting in LocalStorage.

## Current situation (as-is)

- [`src/routes/config/index.tsx:22`](../../../src/routes/config/index.tsx) is the **only**
  hydration trigger in the app: a `useEffect` calling `loadConfig()` when `isLoaded` is false.
  Land on any other route first and `config` stays `null`.
- [`useCharacterStore.loadCharacters()`](../../../src/stores/characterStore.ts) exists, works, and
  **has no caller anywhere outside its own test** — saved characters are never restored.
- [`src/routes/__root.tsx`](../../../src/routes/__root.tsx) — the one component every route renders
  inside — does not touch either store.
- The storage layer is fine: `loadConfiguration()` / `loadCharacters()` in
  [storage.ts](../../../src/services/storage.ts) read and parse correctly, and every mutation
  already auto-saves. This is purely a "nobody calls the loader" bug.
- `isStorageAvailable()` exists and is likewise never called, so a browser with LocalStorage
  disabled fails at the first write rather than being detected up front (Req 17.5).

## Desired result (to-be)

- Hydration happens once, in one place, independent of which route the Player lands on — the root
  layout (or a small `useAppHydration` hook it calls) loads the configuration and the characters
  on mount.
- Hydration is idempotent: navigating between routes does not re-read LocalStorage, and each store
  keeps its `isLoaded` guard.
- Route components stop hydrating themselves; `/config` keeps its "no configuration yet" empty
  state but no longer owns the `loadConfig()` effect.
- Storage availability is checked at start; if LocalStorage is unavailable the app says so once,
  clearly, instead of throwing on the first save.

## Acceptance criteria

- [ ] Opening `/play/character/$id` (or any non-`/config` route) directly, with data in LocalStorage, renders the saved configuration and characters — no empty state, no reload needed (Req 17.3, 17.4).
- [ ] Refreshing on any route preserves what was on screen, as far as the persisted data allows.
- [ ] Hydration runs at most once per page load; navigating between routes does not re-read LocalStorage.
- [ ] `/config/index.tsx` no longer carries its own `loadConfig()` effect, and its "No Configuration Found" state still appears when storage genuinely holds none.
- [ ] With LocalStorage unavailable or blocked, the app shows one clear message via `isStorageAvailable()` rather than throwing on first write (Req 17.5).
- [ ] Hydration is triggered from the root layout only; no other component calls `loadConfig`/`loadCharacters`.
- [ ] Unit tests cover: hydration populates both stores; a second mount does not re-read storage; unavailable storage surfaces the message instead of throwing.
- [ ] Verified via the fallow skill and the react-conventions skill.
- [ ] Verified live in the browser: create a configuration and a character, hard-refresh on `/play`, confirm both are present; then open a character sheet URL directly in a new tab and confirm it renders.

## Notes

- Small ticket, no dependencies — good to take early, since every play-mode ticket is otherwise
  developed against an app that only has state if you visited `/config` first this session.
- Keep the hydration call out of the individual stores' module scope: reading LocalStorage at
  import time breaks the tests (which mock the storage module) and makes SSR-shaped rendering
  brittle. A mount-time effect in the root layout is the intended shape.
- TICKET-NAV-01 rewrites that same root layout. Either order works; whichever lands second should
  keep the other's change rather than reverting it.
