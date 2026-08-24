# TICKET-POL-03 — Deployment shape: build, environment, data directory, backup

- **Area:** Integration and polish
- **Type:** Feature
- **Traceability:** v3 [Req 47](../requirements.md#requirement-47-deployment-and-operations)

## User story

As an operator — most likely the User, on a small box or a home server — I want to run this with one
command and a handful of environment variables, so that hosting my group's game is not a project of
its own.

## Description

**Last ticket of the milestone.** The milestone is not done when the features work on the author's
machine; it is done when someone else can run it. This ticket is the difference, and it is where the
env variables scattered across SRV-01, AUTH-01, AUTH-02 and LIVE-03 get collected, documented and
verified as a set.

## Current situation (as-is)

- SRV-01 established `src/server/env.ts` as the only reader of `process.env`, failing at start-up
  and naming every missing required key at once, with `.env.example` kept in step by a test.
- Optional configuration accumulated across the milestone: **two** OAuth credential pairs — Google
  and Discord (AUTH-02) — the idle and absolute session lifetimes (AUTH-04), replay window and idle
  timeout (LIVE-03), rate limits (AUTH-01). Those two providers are the **only** external
  integrations, each independently optional; D12 left the milestone with no mail configuration to
  document.
- DB-01 applies migrations at start-up and refuses to serve on failure. `DATABASE_URL` points at a
  file that must live somewhere durable.
- `yarn build` currently produces a client bundle only; nothing has ever needed to serve it.
- SRV-01 settled **one server, not two** (D1, v3 Req 47.6–47.8): relative API paths, a socket URL
  derived from `window.location`, no variable naming the backend. This ticket is where that stops
  being a development-time arrangement and becomes the deployed shape.

## Desired result (to-be)

- A production build producing **one** Node process serving both the client bundle and the API, run
  by a documented command, with the Nitro `node-server` target and the WebSocket server attached to
  the same listener. **The bundle is served by the server, not by a separate static host** — the
  operator runs one web server, starts one thing, and keeps one thing alive.
- A documented data directory: where the SQLite file and its WAL companions live, what to back up
  (copy the file with the database quiesced, or `VACUUM INTO`), and how to restore it.
- A README section covering every environment variable with required/optional and its default,
  first-run setup from an empty directory, and the health endpoint's meaning.

## Acceptance criteria

- [ ] A clean checkout with an empty data directory and only the required variables set builds,
      migrates and serves — sign-up through to a working session, verified by following the README
      rather than by memory.
- [ ] The build serves the client bundle and the API from one process and one port; the socket
      connects on that same port.
- [ ] **The documented run is one command starting one process**, and nothing in the README asks the
      operator to serve the client bundle separately. Verified from the network log of a full
      signed-in loop — page load, API calls, socket upgrade — every request landing on that one
      server.
- [ ] Nothing in the shipped bundle or the documented environment names an origin: the README's
      variable table contains no API or socket URL, and a grep of the built output finds no
      hard-coded host. An operator changes the port and everything still talks to itself.
- [ ] `/api/health` reports database reachability and the applied migration version, and reports
      unhealthy when the database file is unreadable.
      **Mostly done by TICKET-DB-01** — the body carries `status`, `environment` and
      `{ reachable, migration }`, because the data was already there once the migration runner
      existed. What is left for this ticket is the *unreadable file* half: prove it against a real
      deployment (permissions, a full disk, a moved data directory) rather than against an
      in-memory database, and decide whether unhealthy should also be a non-200 status for a load
      balancer to read.
- [ ] Every environment variable the code reads appears in the README and in `.env.example` with
      required/optional stated — the existing SRV-01 test extended to cover the README too.
- [ ] A documented backup produces a file that restores into a working server with the game intact,
      demonstrated end to end rather than described.
- [ ] Starting with a missing required variable fails immediately naming all of them; starting with
      a failed migration refuses to serve rather than serving a half-migrated schema.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check against the production build (ask the User first).

## Notes

- **Follow the README literally when verifying**, on a clean directory. An operator's first run is
  the one path nobody tests, because the author's machine is never clean and their memory fills
  every gap the document has.
- Back up by copying the SQLite file only when the database is quiesced, or with `VACUUM INTO` —
  copying a live WAL database with `cp` produces a file that restores *usually*, which is worse than
  one that fails loudly. Say so in the README.
- Reverse proxy and TLS are the operator's business and out of scope. What is **not** out of scope
  is that the cookie must be `Secure` outside development and the socket must work through a proxy —
  note the proxy headers required, since a socket behind a misconfigured proxy fails in a way that
  looks like an application bug.
- **A reverse proxy is the one place an operator can split this back into two**, by serving the app
  and the API from different hostnames. The README says plainly that both live behind the same
  origin, because the failure that produces — a session cookie the socket never receives — reads as
  "live updates are broken" rather than as a proxy misconfiguration.
