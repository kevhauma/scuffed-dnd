# Test Status

_Last verified: 2026-08-26 (`npx vitest run`), after **TICKET-GAM-02 — invite codes and joining a
table**.
The checkpoints before it were **TICKET-GAM-01 — game sessions and pinned Snapshots** at 2526,
**TICKET-IO-04 — import creates a ruleset** at 2474,
**TICKET-RUL-03 — copy a ruleset** at 2370,
**TICKET-RUL-02 — server-backed ruleset editing** at 2353,
**TICKET-RUL-01 — ruleset records** at 2313,
**TICKET-AUTH-04 — persistent sessions** at 2260,
**TICKET-AUTH-03 — authorization guards** at 2203,
**TICKET-AUTH-02 — social sign-in** at 2115,
**TICKET-AUTH-01 — email/password accounts** at 2040,
**TICKET-DX-06 — the server test harness** at 1970,
**TICKET-DX-08 — the architecture rules as checks** at 1937,
**TICKET-DB-01 — SQLite, Drizzle and migrations** at 1925, **TICKET-SRV-01 — the server layer** at
1883,
**TICKET-DX-07 — three roots** at 1847, the **equipment split and display builder** at 1834, the
**character sheet rebuild** at 1777, the **tavern redesign** at 1732, and the
[v2.1 code review](docs/v2.1_code_review/overview.md)'s **high-priority findings** (CR-01 to CR-07,
CR-08, CR-20) at 1674._

## Summary

- **Total tests**: 2625
- **Passing**: 2625 (100%)
- **Skipped**: 0
- **Failing**: 0

Split across **162 files**: `server` in node, everything else in happy-dom.

## The suite now runs in two environments

`vitest.config.ts` splits the run on D14's root boundary: **`src/server/` in node**, everything else
in **happy-dom**. That is not tidiness, and the reason is the most useful thing TICKET-AUTH-01
found.

**happy-dom's `Headers` silently discards `Set-Cookie`.** `get('set-cookie')` returns `null`,
`getSetCookie()` returns `[]`, iteration yields nothing, and nothing throws anywhere. Every
assertion about the Auth_Session cookie was therefore comparing an empty string with itself and
agreeing — including one that asserted the cookie is *not* `Secure` in development, which passed
for the worst possible reason. A test that cannot fail is worse than no test, so the split is a
rule with a check behind it: `src/server/environment.test.ts` fails if a server test file ever runs
somewhere with a `window` in it.

The split costs nothing and is right on its own terms besides — the server has no DOM, and a test
environment that gives it one is an environment where a mistake reads as working code.

## TICKET-GAM-02 — a credential is the one thing a happy-path test cannot cover

The **+99 over GAM-01** is TICKET-GAM-02: 33 in `server/routes/invites/invites.test.ts`, 15 in
`server/routes/invites/inviteCode.test.ts`, 12 in `client/components/sessions/SessionList.test.tsx`,
10 in `InviteCodePanel.test.tsx`, 9 in `JoinSessionPanel.test.tsx`, 8 in `StartSessionForm.test.tsx`,
7 in `useJoinSession.test.ts`, and 5 across the two auth files a redirect-carrying sign-in touched.

**An invite code is a bearer credential, so most of its tests are about the ways it can be abused
rather than the way it is used.** The happy path — issue, paste, join — is four assertions. The rest
are the refusals: a code that never existed, one taken back, one that ran out, and a table that has
been archived, which v3 Req 38.4 asks to be four distinguishable sentences rather than one polite
shrug. Each is a different thing for the person holding the code to *do*, and a shared "invalid
code" would leave all four of them guessing.

**The `conventions-reviewer` pass found the hole that made the security argument false.** The
feature's whole defence is *fifty bits makes brute force expensive, and the limiter makes it
impossible to pay for* — but the limiter was consulted by `redeemInvite` alone, leaving
`GET /api/invites/:code` as an unmetered oracle over the same code space. Sign-up is open, so any
Account could walk it at whatever rate the process serves and read three distinguishable answers —
404, a 409 naming *revoked* or *expired*, or a 200 carrying the session's name — never touching
either bucket, and spend a single `POST` on the hit. Both routes now enter through
`resolveInviteFor`, sharing the buckets deliberately: two limiters would be defeated by alternating
between them. `resolveInvite` beneath it is **not exported**, so reaching past the limiter is not
something a later route can do by accident — and fallow reported the export as dead the moment the
second caller went away, which is the check noticing the same thing the review did.

**Every refusal spends an attempt, not only the unknown-code one.** An attacker learns as much from
*expired* as from *no such code* — both say a code existed — so a limiter counting misses alone would
have had a hole in exactly the shape of a hit.

**One 500 was reachable by anybody signed in, and removing the decode was the wrong fix.**
`decodeURIComponent` throws `URIError` on a lone `%`, which is not an `AppError`, so the pipeline
logged it as a bug and answered 500 — an unbounded stream of them for the price of `/api/invites/%`.
The first attempt dropped the decode entirely and **broke a passing test**: a code typed with a space
arrives as `%20`, and normalisation would have kept the `20` as digits. The decode is now guarded and
falls back to the raw segment, so a malformed path gets the 404 it deserves and a well-formed
encoding still decodes. The test that failed was right; the fix that made it pass would have been
wrong.

**`InviteCodePanel` earns a test file of its own** as the only surface in the app that renders a
credential. The server deliberately still sends an expired code — a DM shown nothing would read that
as *I never issued one* — so this is the one place the difference becomes visible, and the review
found it rendering a dead code as the live invitation with a *Copy link* beside it. The wire shape
changed with the fix: `inviteCode: string` became `invite: { code, expiresAt }`, because a bare
string cannot say *this ran out a week ago*.

**The code and the link are asserted as text, not only as buttons.** `navigator.clipboard` needs a
secure context and a permission, and somebody without one still has to be able to read and select
both.

**The browser check found a defect no unit test was positioned to see.** The *Create one* link under
the sign-in form dropped the `?redirect=` it was standing on, so following an invite link while
signed out, then signing up rather than in, landed on the home page with the invitation lost.
`destinationSearch` and `AuthForm`'s `switchSearch` carry it across the switch, and `/signup` now
honours it the way `/signin` already did.

**`protectedRoutes.test.ts` gained the case that makes the allow-list falsifiable.** It already
proved every declared prefix composes `RequireAccount`; it now also fails on a prefix that protects
**nothing** — a typo'd entry used to read as a route being guarded when no such route existed.

**Everything `fallow` reported was fixed rather than suppressed.** Four of them were component
complexity, and the split each one wanted was the same split a test wanted: `SessionRow`, `Body`,
`LiveCode` and `Form` came out of their parents, and two of the four parents got a test file at the
same time.

## TICKET-GAM-01 — proving a pinned Snapshot by calculating, not by comparing

The **+52 over IO-04** is TICKET-GAM-01: 30 in `server/routes/sessions/sessions.test.ts`, 13 in
`server/repositories/gameSessionRepository.test.ts`, 7 in
`server/routes/sessions/pinnedSnapshot.test.ts`, and 2 in `apiRouter.test.ts`.

**The `conventions-reviewer` pass found the defect this ticket most needed catching**, and no test
in the suite could have: the refresh minted a **new `Configuration.id`** each time, so a refresh
`snapshotConflicts` had *cleared* would still orphan every character at the table —
`useCharacterSheet` renders *configuration-mismatch* when a character's `configurationId` disagrees
with the loaded document. The conflict check is structurally blind to it, because
`validateStatAllocation` is about allocations and a document's own id is not one. Six more findings
came with it, from an unguarded `JSON.parse` that answered a DM with a 500 to the Snapshot write and
its Event being two transactions.

**`pinnedSnapshot.test.ts` closes a gap in the ticket's own to-be**, which asked for D7 *"enforced by
… nothing in `src/server/` loading a Ruleset by the session's `ruleset_id` for gameplay"*. That half
had only prose behind it: dependency-cruiser sees imports, and `refreshSnapshot` imports
`findRuleset` legitimately — the obligation is about *why*. It is a source scan with a two-entry
allow-list, and **writing it found a second defect at once**: the first marker list named only the
guards and `sessionIdFrom`, so `createSession` — the one route that unarguably reads a Ruleset —
escaped the scan entirely. A detector whose blind spot is the module that does the thing is worse
than none.

**The test that carries D7 does not compare documents.** *"Leaves a character's calculated values
identical after the ruleset is edited"* doubles every `point_buy` row on the source ruleset and then
calls `calculateCharacter` against the session's Snapshot before and after, asserting the same
number. A document comparison would have been the obvious assertion and the weaker one: it can pass
while the code that actually plays the game reads somewhere else. What the milestone promises is
that *a DM's Thursday tinkering does not re-price Friday's table*, and that is a claim about a
number.

**Its companion is the structural one.** *"Shares no object with the source, anywhere in the
document"* is `copyConfiguration.test.ts`'s `sharedPaths` walk, run through this path — because a
shallow Snapshot passes every spot-check anybody would write and lets a later ruleset edit reach into
a running game through a shared array.

**The deep-equal criterion is asserted in display form, and the reason is worth recording.** Every
document the server writes goes through `serializeConfiguration`, so a formula the corpus file
happens to spell `stats.dex` comes back as `stats.[stat-dex]` — a difference in how a reference is
written down, not in what it points at. The first version of the test compared stored bytes, failed,
and was *right to fail*: it was pinning the corpus's spelling rather than the rule. Comparing the
display forms is the claim that matters, and it is the form the game is played in.

**`insertGameSession` has a test that makes the second insert throw**, by reusing a membership id.
A session whose `session_member` row failed would be a table its own DM is locked out of —
`requireDM` reads that table and not `dm_account_id` — so the transaction is not tidiness, and
proving it needs a failure that happens *after* the first row is written.

**One ordering bug was found by the router test rather than the route's own.** `POST /api/sessions`
read its body before any guard, so an anonymous caller with no body met a 400 about their JSON
instead of a 401. `requireAccount` now runs first; `requireOwner` still does the real work once the
`rulesetId` is known.

**Everything `fallow` reported was fixed rather than suppressed**, and two of the four were the kind
that only shows up when a second aggregate arrives: `GameSessionRow` and `SessionMemberRow` were
declared *both* in `testing/seeds.ts` and in the new repository, and `toSummary` / `nameFrom` now
existed twice one barrel apart. The fixture's types became re-exports, the session's summary became
`toSessionSummary`, and the 25-line name-validator clone became
[`routes/entityName.ts`](src/server/routes/entityName.ts) — extracted at the **second** caller
against the usual rule, because the rule is aimed at speculative generality and this was measured
duplication with two live callers.

## TICKET-IO-04 — two assertions that had to compare bytes

The **+104 over RUL-03** is TICKET-IO-04: 23 in `server/routes/rulesets/importRuleset.test.ts`, 21 in
`shared/services/characterShape.test.ts`, 12 each in `useRulesetTransfer.test.ts` and
`UploadToAccountDialog.test.tsx`, 10 in `client/services/rulesetUpload.test.ts`, 7 more in
`db/migrate.test.ts` for the fourth migration, 5 each in `server/routes/uploadPrompt.test.ts`,
`useUploadPrompt.test.ts` and `RulesetTransferResult.test.tsx`, 3 in `RulesetsPanel.test.tsx`, 2 in
`apiRouter.test.ts` and 1 in `ConfigTransferPanel.test.tsx`.

**Twenty-six of those came out of the `conventions-reviewer` pass**, and the shape of what it caught
is worth naming: **none was found by a test failing**, and the two worst were invisible *by
construction*. A refused upload rendered its reason on the page **behind** the confirmation dialog —
under a `fixed inset-0` blurred overlay with the page scroll locked — so *Copying…* flipped back to
*Copy to my account* and nothing else happened; the hook test asserted hook state and passed
happily. And `uploadedCharacterErrors` was the *browser's* predicate guarding a **request body**:
`investedStatPoints !== undefined` accepts `null` and accepts a number, so the server would store a
`Character` that is a `TypeError` for whichever surface reads it. The browser check found the first
one only because the fix was already in; the ticket has all eight.

**The load-bearing one is *"leaves both stored keys byte-identical"*.** v3 Req 36.5 says an upload
**copies**, and the failure that rule exists against is silent: a "move" that cleared LocalStorage,
or a well-meant normalising rewrite on the way past, would both leave the User's browser subtly
different and neither would fail a test that counted requests or checked a name. Capturing the two
raw strings and comparing them afterwards is the only assertion a path that writes something
*equivalent* cannot satisfy. It is the same discipline `downloadStoredBackup` has used since
TICKET-IO-03, applied to the other direction.

**Its counterpart on the server is the migration test.** Making `character.session_id` nullable in
SQLite is a table recreate, and the schema file has warned since DB-01 that drizzle-kit's generated
`PRAGMA foreign_keys=OFF` is a **no-op inside a transaction** — which is where the migrator runs it.
So `0003_uploaded_characters` is applied to a real 0002 database holding a seated character behind a
live foreign key, and four cases check what a recreate is capable of losing quietly: the row, the
`ON DELETE cascade`, both indexes, and the ability to insert a character at no table at all. The
analysis said it was safe because nothing references `character`; the test is what makes that a fact.

**`uploadPrompt.test.ts` is five cases about one `INSERT`**, and the one worth reading fires three
claims with `Promise.all`. A read-then-write passes every sequential case and fails that one — and
being asked twice is precisely the failure v3 Req 36.6 is about, on the one occasion it is about.

**Three refusal cases assert the table, not the status.** v3 Req 35.2 says *persists nothing when any
of them fails*, and a 400 that had already inserted would satisfy a status assertion perfectly. Each
of the four refusals therefore ends with `allRulesets(database)` being empty, and the mixed
ruleset-plus-characters refusal checks both tables — the ruleset is the half that would have been
written first.

**Two existing counts moved rather than grew.** `migrate.test.ts`'s table list went from ten names to
eleven (enumerated, so a table appearing is a named difference), and `apiRouter.test.ts` gained the
case the hotspot table predicted it would: `POST /api/rulesets/import` is a literal path one segment
under a collection whose other verbs are parameterised, so it is in the **exact** table and the
assertion is that exact beats pattern. That file's *"a ticket adding a route should open this file
first"* note has now held four times running.

**The `fallow` pass removed two things this ticket had introduced rather than suppressing them**: an
exported `insertCharacter` whose only caller was `insertUnseatedCharacter` beside it — now
module-private until TICKET-CHAR-04 has a real `sessionId` to pass — and two of the three type
re-exports on `engine/validator.ts` that nothing outside reads.

## TICKET-RUL-03 — one test doing the work of thirty

The **+17 over RUL-02** is TICKET-RUL-03: 7 in `shared/services/copyConfiguration.test.ts`, 8 in
`server/routes/rulesets/copyRuleset.test.ts`, and 2 in `useRulesetManager.test.ts`.

**The one worth reading is *"shares no object with the source, anywhere in the document"*.** A
shallow copy of a `Configuration` passes every spot-check anybody would think to write — the name
differs, the id differs, the stats look right — and shares `curve.rows[].values`, `statWeights`,
`statValues` and `dieSizes` by reference, so retuning the copy retunes the original and nobody finds
out until a table plays it. So the test does not check three fields: `sharedPaths` walks both
documents in step and reports **every path at which they hold the same object**, and the expectation
is that the list is empty. That is one assertion that cannot be outgrown by the shape of the data,
against the real Ducklets corpus rather than a fixture with none of the nesting.

The formula case is deliberately `toBe(2)` rather than `toEqual(source's answer)`: two identical
*errors* would satisfy the second and not the first.

**The review's one real finding was a state type, not a test.** `{ mode, ruleset?: RulesetSummary }`
made *rename with no ruleset* representable, and the only answer the code had for that combination
was to **create** a ruleset the User never asked for. A discriminated union deleted the branch
instead of deciding what it should do — which is why no test was added for it: there is nothing left
to test.

## TICKET-RUL-02 — a second destination, and the branch that is not in the store

The **+40 over RUL-01** is TICKET-RUL-02: 12 in `server/routes/rulesets/rulesetEditing.test.ts`,
10 in `client/services/rulesetSync.test.ts`, 14 in `client/stores/configStore.homes.test.ts`, and 4
in `SaveConflictBanner.test.tsx`.

**Eight of those came from the review rather than from the plan**, and they are the interesting
ones: `conventions-reviewer` found four defects the original tests had not, two of them races the
suite could not have caught by accident. The worst was a **data-loss path** — with an account
ruleset open, *Import Configuration* sent the imported document out as a `PUT` over the Account's
ruleset — and the second worst was `rulesetSync` **manufacturing its own conflicts** by capturing
the base revision when an edit was scheduled rather than when it was sent. Each fix landed with the
test that reproduces it; the ticket lists all four.

**`configStore.test.ts` was not touched, and that is the result rather than an omission.** The
milestone's fifth Definition-of-Done rule says a ticket that has to edit local mode's tests to make
server mode fit has probably put the branch in the wrong place. The branch went into
`services/rulesetSync.ts`, the store gained one field, and every one of the existing store tests
passed unchanged.

**Two tests are about a request that must not happen.** `fetch` is stubbed to **throw**, not
counted, in both the service and the store suites — a path that fetched and ignored the answer
satisfies a call-count assertion and has still broken D6. The auth half of the same promise (v3 Req
36.2, *signing in shall not alter the LocalStorage keys*) is a claim about code that does not exist,
so it is checked by a source scan over every `components/auth/` module plus `/signin` and `/signup`,
with a floor assertion so the scan cannot pass by looking at nothing.

**One test was written wrong first and is worth recording.** The round-trip case initially asserted
that the *server* would re-spell a formula in a document whose stat had been renamed but whose
formula still named the old abbreviation. It does not, and should not: resolving-to-ids, renaming,
and spelling back out is the client's translation (`applyRenameSafely`), and the server's obligation
is only to round-trip losslessly. The test now saves, reads back, renames through the same Kernel
pair, saves again, and asserts `max(1, round(ZIP / const.apt_value))` — which is the property that
would actually break if the server stored display form.

**A hazard the ticket did not name got a test anyway**: two overlapping `PUT`s for one ruleset would
race the revision guard against *each other*, and the loser's conflict would be the client's own
doing rather than a second Owner's — a conflict the User cannot act on, because nobody else did
anything. `rulesetSync` keeps one write in flight per ruleset and *"never has two writes in flight
for one ruleset at once"* holds it there.

## TICKET-RUL-01 — the first owned resource

The **+53 over AUTH-04** is TICKET-RUL-01: 19 in `server/routes/rulesets/rulesets.test.ts` (the four
routes, each proving its three refusals), 7 in `shared/services/freshConfiguration.test.ts`, 6 in
`repositories/rulesetRepository.test.ts` for the lifecycle a route drives, 15 across the three new
`client/components/rulesets/` files, and the rest in `apiRouter.test.ts`, `pipeline.test.ts`,
`AppShell.test.tsx` and `protectedRoutes.test.ts`.

**The two tests worth reading are the ones that assert against a *function* rather than a literal.**
`createFreshConfiguration` moved out of `configStore` into the Kernel so the server and the browser
seed a new ruleset with one implementation (v3 Req 33.3) — and the test for that pins
`crypto.randomUUID` and the clock, calls the route, then compares the stored document with a second
call of the function under the same pinning. Stripping the ids out of both sides instead would have
compared a redacted ruleset against a redacted ruleset and would not have noticed a roll that lost
its `ladderId`. The other is the delete: after the Owner confirms, the test reads the *game session*
back and asserts its snapshot still deep-equals the whole Ducklets corpus while `ruleset_id` is now
null. That is D7 stated as an assertion rather than as a paragraph.

**One existing guard was loosened deliberately, and it is the kind worth flagging.**
`pipeline.test.ts`'s *"named by exactly two modules under src/server"* was a raw text search for
`RequestScope`, so two RUL-01 modules **explaining in a comment why they do not widen it** failed
it. The scan now strips comments first. That is a real weakening of a literal check and the right
call anyway: the modules do not name the type in code, they cannot inject an account, and a guard
that punishes a module for documenting the rule teaches people to stop documenting it. A new case
asserts the stripping is narrow — prose out, an actual `const s: RequestScope` still found.

**Local mode is proven by a request that never happens.** `useRulesetManager.test.ts` stubs `fetch`
to **throw** rather than counting calls, because a hook that fetched and ignored the answer would
satisfy a call-count assertion. That is Definition-of-Done rule 5 in one line, and no existing
`configStore`, `characterStore` or component test had to change for it.

## TICKET-AUTH-04 — rolling renewal, and two defects a review found

The **+57 over AUTH-03** is TICKET-AUTH-04: 17 in `auth/sessionLifetime.test.ts` (the arithmetic),
19 in `auth/session.test.ts` (the same rules driven end to end), 7 in
`client/components/auth/ActiveSessions.test.tsx`, 4 in `db/migrate.test.ts` for the third migration,
and the rest spread across `env.test.ts`, `AuthForm.test.tsx`, `AccountBadge.test.tsx`,
`RequireAccount.test.tsx` and `authRoutes.test.tsx`.

**`session.test.ts` drives a clock rather than waiting three months.**
`vi.useFakeTimers({ toFake: ['Date'] })` — only `Date`, because faking timers too would suspend the
promises the file awaits — moves time and the real Better Auth handler runs at whatever moment it is
told, against a real migrated database. Criterion 3's *"asserted by driving the clock, so 'renew
forever' cannot pass"* is only checkable in that shape.

### The design in one line, and what it cost

Renewal writes **`expiresAt = min(now + idle, createdAt + absolute)`**. That turns the absolute
ceiling into an ordinary expiry, so the library's own *is this expired?* check enforces it on
`/get-session`, on LIVE-01's socket upgrade, and on every route that resolves a cookie — no second
check to remember, no path that can forget one. `createdAt` is never rewritten, which is what makes
it the start of the *chain* rather than of the current window.

What it cost is that **capping `expiresAt` breaks the library's own once-per-`updateAge` test**,
which assumes `expiresAt = lastRenewal + idle`. Once the ceiling binds — the last month of a
ninety-day chain — that test is permanently true, so every request would have renewed *and rotated*.
`isDueForRenewal` measures from `updatedAt` instead.

### Two defects `conventions-reviewer` found, both now with the test that reproduces them

Neither was visible from the tests as written, and both were about a seam rather than a rule:

- **Sign-out did nothing during the grace window.** Better Auth deletes by the token the *cookie*
  carried, not the one it resolved the session to — and inside grace those differ. The row survived,
  the browser's cookie was cleared, and the person believed they had signed out. Fixing it needed a
  fourth adapter override nobody would guess at: `deleteWithHooks` looks the row up with
  **`findMany({ limit: 1 })`** first and skips the delete when that finds nothing, so wrapping
  `delete` alone changed nothing at all.
- **Every request renewed and rotated once the ceiling bound** — the `updateAge` problem above.

The review also caught the ceiling not being applied at session *creation* (so a configuration
`.env.example` documents as supported did not work for a whole update window), an unindexed
`previous_token` that made every bad cookie a full table scan, and a dead export this ticket had
introduced.

### The grace window is an amended criterion, taken to the User

Criterion 4 asked that a rotated-away identifier stop working **immediately**; the ticket's own notes
asked, three paragraphs later, that two tabs renewing at once must not invalidate each other. The
notes are right and the hazard is real — Better Auth *deletes the cookie* when it meets a token it
does not recognise, so the losing side of a two-tab race signs every tab out. The User chose the
grace window; the criterion is struck through and amended in place rather than quietly outgrown.

## TICKET-AUTH-03 — the authorization guards, and what only a browser could find

The **+88 over AUTH-02** is TICKET-AUTH-03: 23 in `auth/guards.test.ts`, 9 in
`routes/routeGuards.test.ts`, and the rest across four new client files
(`protectedRoutes.test.ts` 9, `signInDestination.test.ts` 33, `RequireAccount.test.tsx` 7,
`routes/authRoutes.test.tsx` 10) plus small additions elsewhere. Nothing was deleted except
AUTH-02's `SignedOutNotice` and its two cases, which this ticket replaced with a real redirect —
its own docblock had said it would.

**Three of the guards' tests exist because of a distinction this ticket had to settle.** An
anonymous caller gets **401**, everybody else gets **404**. That looks like it contradicts v3 Req
32.5 and does not: `unauthenticated` is thrown *before any lookup*, so it says something about the
caller and nothing about the resource — the same answer for a ruleset that exists, one that does
not, and one belonging to somebody else. Every *post-lookup* refusal is the identical 404, asserted
on the serialised response rather than on the thrown error. DX-06's `callRoute.ts` had anticipated
404-for-anonymous in prose; that header is corrected rather than left to be read as a decision.

### The browser check earned its place twice, and neither bug was visible from a unit test

Both were found by driving the real flow, and both are the kind a test written against the same
wrong assumption would have confirmed rather than caught:

- **A redirect loop that compounded its own query string.** `RequireAccount` read the destination
  *live* from the location — but the location stops being the guard's the moment the redirect
  starts, so `/signin?redirect=/account` became the next destination, and the next, until the
  address bar held two thousand characters of `%252525…Fsignin%25253Fredirect`. The fix is a `useRef`
  captured at mount and a dependency list without the location; `safeDestination` refusing
  `/signin` outright is the second lock.
- **A sign-in that silently never navigated.** Against `@tanstack/react-router` 1.163.2, three
  different APIs each did nothing on a built URL: `navigate({ to })` wants a route *template*, so a
  destination carrying a query string matches nothing; `navigate({ href })` without a `to` builds
  the *current* location, sees no change and returns; `router.history.replace` moved nothing either.
  Signed in, still looking at the sign-in form, no error anywhere. `window.location.replace` is the
  browser API for a built URL and is right on its own terms here — the shell has to re-read who is
  signed in — and it is why `safeDestination` is load-bearing rather than defensive.

### One security defect, found in review rather than by a test

`safeDestination` judged the string the browser is **given** rather than the one it will **read**.
The WHATWG URL parser strips every tab, LF and CR *before* parsing, so `/⇥/evil.example` starts with
exactly one `/`, is not `//`, is not `/\` — and arrives as `https://evil.example`. Verified against
the real parser. It now normalises before judging *and* returns the normalised form, and the test
asserts agreement with `new URL()` rather than restating the rule.

### Two things this ticket fixed that it also caused

- **A flake.** `auth/auth.test.ts`'s slowest cases are password-KDF-bound — one performs a sign-up
  and ten sign-ins in sequence — and ran at ~2.4s against Vitest's 5s default. AUTH-03's added
  parallel load tipped them over intermittently, which also surfaced as a misleading
  *withTestDatabase calls overlapped* cascade from the abandoned test body. Three cases now carry an
  explicit 30s timeout; the rest of the file keeps the default, so a genuine hang still surfaces in
  five seconds. The harness's error message names the third cause now.
- **A second repository convention.** The new repositories take their connection as a defaulted
  *last* parameter, because `queries-belong-to-repositories` forbids a handler from importing
  `db/client` — which means DB-01's connection-first `findRuleset(database, id)` was, as written,
  uncallable from any route. Rather than leave two conventions in one directory, `rulesetRepository`
  and `eventRepository` were converted in the same change. `db/client.ts` had documented the
  intended shape all along.

## TICKET-AUTH-02 — social sign-in, and the two library defaults it had to overrule

The **+75 over AUTH-01** is TICKET-AUTH-02, purely additive: 30 in two new server files
(`auth/identityRules.test.ts` 16, `auth/socialSignIn.test.ts` 14), 25 across five new client files
(`SocialSignInButtons.test.tsx` 8, `useSocialProviders.test.ts` 7, `LinkedIdentities.test.tsx` 6,
`AuthAlert.test.tsx` 2, `SignedOutNotice.test.tsx` 2), and 20 grown onto existing files — 12 in
`env.test.ts` for the five new variables, 4 in `AuthForm.test.tsx`, 3 in `apiRouter.test.ts`, 1 in
`AccountBadge.test.tsx`. Several are `it.each(SOCIAL_PROVIDERS)`, so they scale with the provider
table rather than naming Google and Discord twice.

**Five of those came out of the `conventions-reviewer` pass**, and the shape of what it caught is
worth naming: none was a bug, and all five were *the third instance* of something. `AuthAlert`
extracted a crimson `role="alert"` box that `AuthForm`, `SocialSignInButtons` and `LinkedIdentities`
had each written by hand — the count the conventions name as the moment to share. `AuthForm.style.ts`
became `authSurfaces.style.ts` because three other modules were importing a fourth's stylesheet.
`SignedOutNotice` came out of `routes/account.tsx`, which had grown a branch with wording in it, and
now has the test that will say out loud when AUTH-03 replaces it with a redirect. The review also
found that `AccountBadge`'s new link to `/account` — the app's only navigation to that route — would
have shipped green with the wrong `to`, since the existing case asserts text.

**`socialSignIn.test.ts` drives the real authorization-code flow** — `sign-in/social`, then the
callback, through `handleApiRequest` against a real migrated database — with only each provider's
two HTTP endpoints stubbed. Three things that fixture had to learn, recorded so the next person does
not rediscover them:

- **The callback needs the state *cookie*, not just the state parameter.** Better Auth sets a signed
  `state` cookie beside the value it puts in the authorization URL and refuses the callback if the
  two disagree — `State not persisted correctly`. It is a CSRF binding, so a test that skipped it
  would have been testing a flow no browser performs. The helper carries a cookie jar instead.
- **Google's callback path only `decodeJwt`s the id_token**, so an unsigned but structurally valid
  JWT is enough; signature verification lives on the separate id-token sign-in route, which this
  application does not use. A fixture minting a real RS256 token would be asserting `jose` works.
- **Discord's provider calls `BigInt(profile.id)`** when a profile has no avatar, to derive a default
  one. The fixture gives every profile an avatar, which keeps `discord-subject-1` legible in a
  failure message instead of forcing every id in the suite to be a numeric snowflake.

**Two library defaults were wrong for this application and both are load-bearing**:

- **`accountLinking.requireLocalEmailVerified` defaults to `true`**, and under D12 no password
  Account is ever email-verified — there is no verification email to send. Left alone, v3 Req 31.3
  (a verified provider email links onto an existing password Account) could never have happened,
  and the test for it would have been red rather than the feature being quietly absent.
- **Better Auth refuses an unverified provider email only when *linking* onto an existing user.** A
  first sign-in with an unverified address would have created a fresh Account. That gap is closed by
  our own `user.validateUserInfo` gate, which is also the single provider-agnostic path v3 Req 31.7
  asks for — the library calls it before `create-user`, before `link-account` and on every provider
  `sign-in`, for every provider, so there is no per-provider branch left to diverge.

**The unconfigured deployment is the default every other server test runs under**, deliberately:
the OAuth variables are set at the top of `socialSignIn.test.ts` rather than in `vitest.setup.ts`,
and `serverEnv()` resolves lazily so a top-level assignment lands before the first request. So
`auth.test.ts`'s 25 email/password cases are **unchanged**, which is the cheapest possible proof of
v3 Req 31.6.

**What keeps those five variables out of the other files is process isolation, not the module
registry** — the registry only resets `serverEnv()`'s cache, while `process.env` is process-scoped.
The guarantee is `vitest.config.ts` leaving `pool` and `isolate` at their defaults, a forked worker
per file. Worth writing down because turning either off would make `apiRouter.test.ts`'s
unconfigured-deployment case pass alone and fail in a full run.

One existing assertion was made *less* strict and it was wrong before: `apiRouter.test.ts` compared
route paths against `AUTH_PREFIX` with a bare string prefix, which made `/api/auth-providers` look
like a collision with the delegated `/api/auth` subtree. The router matches the path itself or the
path plus a separator; the test now asserts the router's own rule, with a companion case driving
`/api/auth-providers` through it.

`env.test.ts`'s **"only reader of `process.env`"** check split into two. A test file that *arranges*
an environment before the lazy first read is exercising `env.ts`'s contract, not working around it —
but a test that *consumes* a variable is exactly what the rule exists against. So non-test files
must still be `env.ts` alone, and test files may assign to `process.env` and nothing else.

## TICKET-AUTH-01 — email/password accounts

The **+70 over DX-06** is TICKET-AUTH-01: 32 in `src/server/auth/` (the real Better Auth handler
over a real migrated database), 17 in `src/client/components/auth/`, 9 more in `db/migrate.test.ts`
for the second migration, 5 in `db/authSchema.test.ts`, 3 more in `pipeline.test.ts` and
`apiRouter.test.ts`, 2 in the new `environment.test.ts`, and 5 in `env.test.ts` for the four new
variables.

**Nine of those came out of the `conventions-reviewer` pass and every one pins a defect that was
reachable**, which is worth naming because all three of the serious ones passed their own tests
before the review:

- **The per-address limiter was check-then-act across an `await`** — nothing was counted until the
  handler resolved, so a burst of parallel sign-ins all read a count of zero and all got a password
  check. It constrained a *sequential* attacker only. A test now fires twelve concurrent attempts
  and asserts at most five were tried.
- **Better Auth's own limiter had been switched off wholesale**, which in production removed flood
  protection from sign-up, password reset and every future OAuth route. It is on, with the one path
  the custom limiter owns carved out; two tests hold both halves.
- **The 429 body was shaped wrong**, so the client read `undefined` and told a locked-out person to
  check their typing. Asserted server-side and confirmed in the browser.

Enabling the library's limiter is also why every auth test request now carries its own
`x-forwarded-for`: in a test environment Better Auth resolves every IP to localhost, so the file was
one client and its fourth sign-up was refused. Giving each request an address is what production
looks like — and it makes the per-address cases stronger, since every attempt now comes from a
different client and only the *email* limit can be what refuses them.

**Nothing in the auth suite is mocked**, and that is the point of it: whether a stored credential is
really a hash, whether a wrong password and an unknown email are really byte-identical, and whether
a captured cookie really stops working after sign-out are all claims about the *library's* behaviour
under our configuration. A mock would assert our own assumptions back at us. The sign-out case in
particular replays the same cookie afterwards rather than checking the client cleared it, which
proves nothing about a stolen copy.

`db/authSchema.test.ts` is the one worth copying elsewhere: it compares our Drizzle tables against
Better Auth's own `getAuthTables()`, so an upgrade that adds a column is a failing test rather than
somebody failing to sign in.

**Six existing tests changed rather than were added**, each because the thing it asserted moved:
`migrate.test.ts` counted six tables and one applied migration (now ten and two), `env.test.ts`'s
`readEnv` cases needed the new required variable, and `AppShell.test.tsx` gained mocks for the
account badge it now carries. None was deleted or loosened.

The **+33 over DX-08** is TICKET-DX-06, and it is purely additive — 30 in a new
`src/server/testing/harness.test.ts`, one in `architecture/boundaries.test.ts` for the new
`test-harness-stays-in-tests` rule, one in `apiRouter.test.ts` and three in `pipeline.test.ts`.
**The four outside the harness file are the load-bearing ones.** `defineHandler` now takes an
optional `RequestScope`, which is how `callRoute` says *as this account* — and the entire safety
argument for a pipeline that accepts an injected identity is that almost nothing passes one. Two
tests hold that: `apiRouter.test.ts` swaps a spy into `ROUTES` and drives a request carrying both an
`x-account-id` and an `Authorization` header, asserting the route was handed `undefined`; and
`pipeline.test.ts` scans `src/server/` and asserts that exactly two modules so much as **name**
`RequestScope`. The second exists because the first is about the router, and the router is one
instance of the rule rather than the rule.

**Four of the thirty came out of the `conventions-reviewer` pass, and one of them mattered a lot.**
`setProcessDatabase` — the seam the whole `queries-belong-to-repositories` widening was bought for —
had *no coverage*: deleting both of its calls left the suite green, while every future route test
would silently have read an unmigrated, file-scoped database. It is now asserted through
`/api/health`, which reports an applied migration inside `withTestDatabase` and none outside.

The review also found that two **overlapping** `withTestDatabase` calls did not merely fail, they
left a *closed* connection installed as the process database for the rest of the file — and because
`getDatabase()` is `opened ??=`, a non-null closed handle is never replaced. The restore is now a
compare-and-swap that throws, with a test that overlaps two calls deliberately and then checks the
process database still works.

Three server test files were **migrated, not rewritten**: `rulesetRepository.test.ts`,
`eventRepository.test.ts` and `schema.test.ts` each had their own four-line `migratedDatabase()`
and `afterEach` bookkeeping, which is exactly the triplication the harness exists to remove. Not one
assertion changed and the count is unmoved. `eventRepository.test.ts` also lost a hand-written
`INSERT INTO game_session`, which mattered more than tidiness: it was a second definition of what a
session row looks like, and the next migration would have had to remember it.

`schema.test.ts` deliberately **keeps** its own raw-SQL `seedSession`. The harness's seats a DM in
`session_member`, and the *refuses a second DM* case needs a session with nobody in it — the file's
whole premise is that the database enforces these rules rather than a repository being careful.

**Measured cost of a per-test database: ~2–3 ms**, and no suite regression at all. `schema.test.ts`
reports 2–3 ms per case for open + migrate + close plus its own raw SQL (15 ms for the first, which
carries module init). Whole-suite, three runs each: **before 29.03 / 28.02 / 27.55 s**, **after
27.26 / 27.35 / 24.59 s** — unchanged, inside the noise, with 33 more tests and roughly 70 more
databases opened.

The **+12 over DB-01** is TICKET-DX-08, and all twelve are in
[`architecture/boundaries.test.ts`](architecture/boundaries.test.ts), which goes 9 → 21: one per
new rule (`kernel-is-framework-free`, `types-are-the-bottom-layer`,
`persistence-belongs-to-the-store`, `queries-belong-to-repositories`, `ui-primitives-are-leaves`,
`no-circular`, `no-dev-dep-in-production`, `no-undeclared-dependency`, `no-orphans`) and three
about the rule set as a whole. Those three are the ones worth naming:

- **`no-orphans` reports at `warn`**, asserted on the severity of a real finding rather than on the
  config literal — a warning that never reaches the report is the same as no rule. It stays a
  warning because the class it catches is *tiny*: dependency-cruiser's orphan predicate is "no
  dependencies **and** no dependents", so a dead file that imports anything at all is not an
  orphan. `fallow dead-code` is what judges reachability; this is the cheap first look.
- **A failure message names the decision**, asserted against the `err-long` reporter's actual text
  for the persistence and Kernel-purity rules. `yarn run arch` gained `--output-type err-long` in
  the same change: `err`, the CLI default, prints the edge and drops the `comment`, so every rule's
  explanation was being written and then thrown away.
- **No module that is not a fixture breaks any rule** — the second half of the same cruise. The
  suite now cruises the whole of `src/` with *only* the `boundaryFixtures/` exemption lifted, which
  is what makes a green `yarn run arch` mean "the tree is clean" rather than "the tool is blind".

`libraryConventions.test.ts` was edited and stayed at 5 cases: nothing it checks was import-shaped,
so `ui-primitives-are-leaves` had nothing to take from it (DX-08 criterion 8).

The **+42 over SRV-01** is TICKET-DB-01: the connection (4), migrations (8), schema constraints
(9), the ruleset repository (11) and the event repository (10). Each group answers a criterion
rather than a function: that a failing migration leaves *nothing* behind and does not mark itself
applied; that each cascade rule is the one the schema's prose claims; that a **real**
`Configuration` — the whole 306 KB Ducklets corpus — round-trips a `TEXT` column byte-for-byte,
formulas and curve flags included; and that a stale base revision updates zero rows rather than
overwriting a save it never saw.

Six of those came out of the `conventions-reviewer` pass. The one worth naming pinned a bug that
would have hit **every fresh clone**: `data/` is gitignored and `new Database()` does not create a
missing directory, so the first `yarn dev` on a clean machine died at start-up with a raw
`SqliteError`. `client.test.ts` opens a database in a directory that does not exist yet.

**The suite now opens real databases.** Every one is `:memory:`, opened and closed per test, so
there is no fixture file and no cleanup to forget; `vitest.setup.ts` sets `DATABASE_URL=:memory:`
so a test that merely *imports* a route module does not need one of its own. TICKET-DX-06 folded
the opening and closing into `withTestDatabase` — but **left the `vitest.setup.ts` line where it
is**, which is the opposite of what this paragraph originally predicted: `env.ts` can be asked for
a value at *import* time, before any test body has run, so no harness function could be early
enough.

The **+36 over DX-07** is TICKET-SRV-01: the environment loader (14, including the three contracts
that keep `.env.example` and `env.ts` naming the same set, keep `process.env` to one reader, and
keep any origin out of the environment entirely), the request pipeline (14, most of them about the
one decision that matters — a refusal explains itself, a bug says nothing), and the API router (8,
of which the load-bearing one is that non-API traffic comes back as `null` rather than a 404, which
is what lets one process serve the app and the API from one origin).

Six of those thirty-six came from the `conventions-reviewer` pass and are worth naming, because
each pins a bug that was reachable: a handler returning nothing produced a 200 whose body was the
four characters `undefined`; `AppError` took its status from the caller, so a malformed one would
have thrown inside the pipeline's own catch; the 404/405 bodies echoed the request path back; and
`HEAD` on a known route was answered with a 405.

The **+13 over the equipment checkpoint** is TICKET-DX-07, and **none of it is the move**: the tree
moved at exactly 1834, which is the whole point of a refactor ticket that changes no behaviour.
The thirteen are the checks the ticket adds — 9 in `architecture/boundaries.test.ts`, one per
dependency-cruiser rule plus the legal crossing and a guard that fails when a rule arrives without
a fixture, and 4 in `src/server/sharedKernel.test.ts`, which is the first thing the server root
does and proves the pure half of `services/` is reusable from it. One test file was split in two —
`importExport.test.ts`'s `Blob`/`File` cases became `client/services/configFiles.test.ts` — and one
moved root, `golden.test.ts` to `client/integration/`, because it drives both stores and the Kernel
may not import its callers. Neither changed a count.

The **+57 over the sheet-rebuild checkpoint** is the equipment work. `slotLayout.test.ts` (7) was
replaced by `engine/equipmentLayout.test.ts` (19) when the recognition table stopped being the rule
and became the seed; `Glyph` gained 3 catalogue cases holding the drawings, the labels and the
picker groups to one list; the store gained 7 for the layout actions, the import shape layer 7 for
the grid and its placements, and `engine/validator.ts` 5 for the arrangements it now reports. The
two new panels bring 16, and the inventory suite 3 for a doll that reads the configuration instead
of guessing. Four existing cases changed rather than were added, each because the thing they
asserted moved: `/config/items` now asserts the *absence* of the equipment panel it used to mount,
the dashboard and nav lists gained an Equipment entry, and the items panel's prerequisite note
points at a page rather than down its own.

The **+45 over the tavern-redesign checkpoint** is the sheet rebuild: `Glyph` (4) and `slotLayout`
(7) for the equipment figure, `WalletSection` (8) and `setWalletAmount` (5) for the purse,
`setInvestedSkillPoints` (5), and the rest spread over the sheet's own suite. Six existing cases
changed rather than were added, each because the thing they asserted moved: the invested-points
text field became a stepper, so the commit-on-blur cases became "there is no field to type a
partial number into"; a skill's level is rounded up at the display edge, so `level 1.4` reads
`level 2`; and an equipment slot is a tile rather than a bordered row, so the shared `rowFor`
helper accepts either. None was deleted or loosened.

The **+10 over the high-findings checkpoint** is the redesign, and it is additive: `Ornament` (4)
and `Divider` (5) are the two new SVG primitives, and `Button` gained one case for the `plaque`
variant. Eleven existing cases changed rather than were added — the base-component suites assert
the classes a primitive wears, so retuning the palette necessarily retunes them; each was rewritten
to the new intended value, none was deleted or loosened. Two of those rewrites pin a fix rather
than a colour: `Checkbox` now asserts `appearance-none`, because a native checkbox ignores every
background and border utility in Chrome and the old styling was painting nothing, and
`libraryConventions` now scans `styles.css` alongside the library, because the checkbox's tick had
to move there.

The **+34 over the low-findings checkpoint** is the high-priority pass, all additive except where a
finding's fix made an old expectation wrong: the cycle-detection suites gained the ids-are-UUIDs
cases CR-01 asks for and the phantom-cycle graph CR-08 asks for; `importExport.test.ts` gained the
four collections CR-03 left array-checked and nothing more; `storage.test.ts`'s three
silent-drop cases became refusals (CR-05); a new `useCurrencyManager.test.ts` pins order-0 through
an edit (CR-04); and the `stat` scope losing `skills` (CR-02) flipped four cases from accept to
refuse and retargeted two more at the `roll-input` owner, which is where a skill reference is
actually honoured.

Was 660 at the v1.0 foundation checkpoint (2026-08-01); v2.0's tickets added
+43 (FORM-02), +30 (FORM-03), +29 (FORM-04), +28 (FORM-05), +11 (FORM-06), +7 (CALC-02),
+11 (REF-01), +9 (REF-02), +18 (CST-01), +18 (CST-02), +64 (CRV-01),
+32 (CRV-02), +27 (FORM-07), +3 (STAT-01), +51 (CRV-03), +47 (IO-03), +27 (STAT-02), +15 (FORM-08), +8 (FORM-09), +14 (SKL-02), +36 (SKL-03), +36 (RES-01), +14 (RES-02), +48 (RES-03), +40 (ARC-01), +50 (ARC-02), **−15 (ARC-03)**, +34 (ROLL-03), +9 (ROLL-04), +36 (ROLL-05), **−18 (ROLL-06)** and +64 (DX-04).
**DX-04's +64** is one new file, `src/client/integration/golden.test.ts`, and it is purely additive —
nothing existing was touched, because the milestone's parity gate went green on its first run.
Sixty-two of the sixty-four are fixture rows driven by `it.each` over
`src/shared/engine/golden/fixtures.ts`; the other two are the suite's own guards, one asserting every row
carries a citation and one pinning **which** rows are 🔍-inferred, so a confirmed derivation cannot
be re-tagged as inferred to make a failure go away.
**RES-02's +14 is a net figure**: `StatPointBudget.test.tsx` (6) went with the flat pool it
covered, `configStore.test.ts`'s budget block shrank from 4 cases to 2, and the
`mainSkillPointBudget` round-trip block became a 4-case retired-field refusal — against which
`skillAllocation.test.ts` grew the derived-budget and unavailable-budget groups, `characterStore`
gained 8 for `setInvestedStatPoints`, and the sheet gained 6 for the pool and its spend surface.
**RES-03's +48** is purely additive: two new colocated files (`useNumericDraft.test.ts` at 17,
`pointBudgetView.test.ts` at 5 — both raised by the `conventions-reviewer` on RES-02), 13 more in
`characterStore.test.ts` for the two new pool actions and creation's affordability refusal, and 13
on the sheet for quick entry, refill and kept-and-flagged. Three existing sheet cases were rewritten
rather than added to: commit is on blur now, and `-5` is a delta rather than an absolute.
**ARC-01's +40** is a new entity's full spread: 8 in a new `ArchetypesConfigPanel.test.tsx`, 5 in a
new `StatRowsField.test.tsx`, 10 in `validator.test.ts` for the two new rules, 6 in
`importExport.test.ts` for the shape, 5 in `configStore.test.ts` for CRUD and the export round-trip,
4 in `dependencies.test.ts` for the guarded-delete reference in both directions, and 2 route cases.
Nine of those came from the `conventions-reviewer` pass, which found `deleteStat` blind to archetype
affinities — see the ticket.
**ARC-02's +50** is a new `pointBuy.test.ts` (28, including Concept 03's confirmed 12/7/5 spread
and three `fast-check` properties), 7 in `calculator.test.ts` for the composition, 12 in
`skillAllocation.test.ts` for the reported gains and the new `unpriceable-gain` refusal, and 3 on
the sheet. **The 1:1 fallback is why the suite could not see the sheet's broken breakdown** — no
fixture carried a `point_buy` curve, while `createFreshConfiguration` seeds one, so every real
ruleset hit the bug and no test did. The three sheet cases added for the fix carry a curve
deliberately, and one existing assertion changed with the row's new wording.
**ARC-03 is the first negative delta of the milestone, and that is the point**: retiring the focus
stat deleted `FocusStatConfig.test.tsx` and `useFocusStatManager.test.ts` outright (24 cases) along
with the focus-specific cases in `calculator.test.ts`, `statCalculator.test.ts`, `CharacterSheet.test.tsx`,
`configStore.test.ts` and `importExport.test.ts`. Against that, five new archetype-step cases, two
flat-bonus regressions and five in a new `affinityGroups.test.ts` (the `conventions-reviewer`'s
de-duplication). A ticket whose job is removal should shrink the suite; what matters is that nothing
was skipped and the remaining cases assert the *absence* rather than falling silent.
**ROLL-03's +34** is purely additive: a new `diceLadder.test.ts` (19, including Concept 07's six
confirmed decompositions and two `fast-check` properties — one that the decomposition conserves its
input, one that the flat remainder stays below the smallest die), 8 in `validator.test.ts` for the
ladder rules, 5 in `configStore.test.ts` for CRUD and the export round-trip, and 2 in
`sheetImport.test.ts` — the derivation the new fragment pins, plus one more `it.each(fragments)`
instance, since the provenance check is parameterised over the corpus.
**ROLL-04's +9** all land in the same `diceLadder.test.ts` (19 → 28): four for `rollDecomposition`
— including a property over *generated ladders* rather than a fixed one, which is the gap ROLL-03's
`NaN`-size defect slipped through — and five for `formatLadderNotation`. No existing dice test was
touched.
**ROLL-05's +36** is a new entity's full spread across two new panels: 11 in a new
`RollsConfigPanel.test.tsx` (which covers `DiceLaddersConfigPanel` too — they share a fixture and
are mounted together), 9 in `configStore.test.ts` for roll CRUD, the seeds and the ladder
guard, 6 in `importExport.test.ts` for the shape, 3 in `validator.test.ts`, 2 in
`sheetImport.test.ts` for the new fragment, plus a `scoping.test.ts` case and two route cases.
**Three existing assertions changed, and each was a guard firing correctly**: `scoping.test.ts`
enumerates every attachment point, `sheetImport.test.ts` enumerates every corpus fragment, and
`configStore.test.ts`'s "a fresh ruleset has no diceLadders" was ROLL-03 recording that ROLL-05
would seed one — so it now asserts the seed instead.
**ROLL-06 is the milestone's second negative delta, and the biggest test-layer migration since
SKL-02.** Four files went outright with the entities they covered (36 cases): `CombatRoller.test.tsx`
(12), `combatSkillCalculator.test.ts` (8), `combatRoll.test.ts` (8) and `skillIdentity.test.ts` (4, its
last consumer having been the combat manager) — plus the combat-skill cases
in eight edited files. Against that, **four new files replace what was deleted rather than leaving
the behaviour uncovered**: `rollCalculator.test.ts` (7), `rollDefinition.test.ts` (6),
`useRoller.test.tsx` (8) and `RollsSection.test.tsx` (10) test the same contracts over the modules
that replaced them. The first three were written
**because the `verifier` noticed they were missing**, and the fourth because the
`conventions-reviewer` then noticed nothing rendered a `RollOutcome` at all — the first pass deleted the old tests and
relied on the sheet's integration coverage, which is precisely the "weakened rather than migrated"
failure SKL-02 warned about. Roughly 25 assertions across the suite were rewritten rather than
deleted: `combatSkillBonuses` → `rollInputs`, `Melee (MEL)` → `Melee`, a bonus chip → a pool label,
and every cycle fixture moved onto **derived stats**, which are the only formula nodes left.
**SKL-02's +14 is a net figure across a very large rewrite**: the source-side reshape landed a
session ahead of its tests, so 171 tests were failing when the ticket was picked up. 20 tests were
added in a new `skillCalculator.test.ts` (Concept 02's verified table), a handful more elsewhere,
and roughly as many were deleted or rewritten with the entity they covered — the speciality
attachment point, its formula field, its preview placement, the two speciality-cycle cases and the
`renameSkillCode` / `useSkillCodeRename` suites. See the ticket's implementation notes.
**STAT-02 restored `StatsConfigPanel.test.tsx`**, one of the five panel test files TICKET-DX-01
deleted — it is back, rewritten against the real store, and passing. FORM-02/03/04 only
appended. **STAT-01's +3 is a net figure**: the breaking schema change deleted
`mainSkillCalculator.test.ts` (18) and `MainSkillPointBudget.test.tsx` (6) with the entities they
covered, added `statCalculator.test.ts`, `stats.test.ts` and `StatPointBudget.test.tsx`, and
rewrote assertions across ~30 fixture files. FORM-05 also **rewrote** ~14 assertions that asserted the throwing contract it replaced,
and FORM-06 replaced one sheet test that asserted the whole-sheet error page it removed — see
those tickets' implementation notes.

**The v2.1 review's low-priority findings added +22**, all in existing files except a new
`Text.test.tsx` (4) — the primitive had none: +5 (CR-26 `namedConstant`), +1 (CR-30 clearing an
optional field on skills, +1 more on items), +1 (CR-32 Select error, +1 Textarea error, +4 Text),
+2 (CR-33 prop-driven formula validation, one of them the case TICKET-DX-01 removed over the bug),
+1 (CR-34 static rows), +1 (CR-35 named row controls), +1 (CR-36 the arrow colour pinned to its
token), +1 (CR-38 the duplicate-abbreviation message), +1 (CR-39 `clearAllData` touching only the
app's keys), +1 (CR-41 fractional bounds) and +1 (CR-43 clearing a refused generator).

**The suite is green. The bar is "the suite passes", not "no new failures beyond a documented
list".** Any failing test is a regression.

`npx tsc --noEmit` is **not** clean — see [Typecheck](#typecheck-2-known-errors) below.

## The React 19 hooks-dispatcher failure — resolved

For most of the project's life, 48 tests failed and 11 were skipped with
`TypeError: Cannot read properties of null (reading 'useState')` — React's internal hooks
dispatcher (`ReactSharedInternals.H`) was null, so every component calling `useState`/`useEffect`
threw on render. It was misfiled as a React 19 / Vitest / Testing-Library version incompatibility.
It was not.

### Root cause

**`tanstackStart()` was in the Vitest plugin pipeline.** That plugin wires up TanStack Start's
client/ssr Vite environments for SSR dev and build. Under Vitest, that wiring causes `react` to be
instantiated **twice**: the copy the component tree imports is not the copy `react-dom` binds its
hooks dispatcher to, so `H` is never set on the instance the components actually see.

### Evidence

- `node_modules` contains exactly **one** physical copy of `react` (19.2.4) and `react-dom` — so
  this was never npm-level duplication, which is why `resolve.dedupe` had no effect.
- A probe rendering a hook component through `@testing-library/react` showed the test file's
  `React.__CLIENT_INTERNALS…H === null` *during* the react-dom render, while react-dom itself
  rendered happily — i.e. two `ReactSharedInternals` objects.
- With a byte-identical plugin list otherwise, **removing only `tanstackStart()` made hook
  components render**. Everything else held constant.
- Four other candidate fixes were tried and each still failed, which is what rules out the usual
  suspects: `resolve.dedupe: ['react','react-dom']`; inlining `@testing-library/react` via
  `server.deps.inline`; forcing `react`/`react-dom` external via `server.deps.external`; and
  `tanstackStart({ customViteReactPlugin: true })` to avoid a doubled React plugin.

### Fix

A dedicated [vitest.config.ts](vitest.config.ts) that omits `tanstackStart()`. Vitest prefers
`vitest.config.ts` over `vite.config.ts`, so [vite.config.ts](vite.config.ts) is unchanged and
`yarn dev` / `yarn build` keep the full Start pipeline.

Routing still works under test because `src/client/routeTree.gen.ts` is committed — nothing in the suite
needs the route generator to run. `src/client/routes/config/configRoutes.test.tsx` passes unchanged.

The fix alone took the suite from 48 failing / 369 passing to 14 failing / 403 passing.

**This stays true now that there is a server (TICKET-SRV-01).** The server layer is deliberately
shaped so that it can be: a handler is a function from `Request` to data, `defineHandler` wraps it
into a function from `Request` to `Response`, and `handleApiRequest` is called with a plain
`new Request(...)`. Nothing in `src/server/` needs Nitro, a listener, or a port to be exercised, so
`vitest.config.ts` keeps omitting `tanstackStart()` and server tests keep running in the same pass
as everything else. The one module that *does* touch the framework — `src/server/entry.ts` — holds
two lines of dispatch and nothing worth asserting in isolation; what it does is proven in the
browser instead.

## What else changed in TICKET-DX-01

Once the tests actually executed, they exposed real test-quality bugs the crash had been hiding.

**Five config-panel test files were deleted** (27 tests: 14 failing, 13 passing) rather than
repaired — a deliberate scope decision by the User, recorded in the ticket:

- `src/client/components/config/currency/CurrencyConfigPanel.test.tsx`
- `src/client/components/config/items/EquipmentSlotsConfigPanel.test.tsx`
- `src/client/components/config/materials/MaterialsConfigPanel.test.tsx`
- `src/client/components/config/races/RacesConfigPanel.test.tsx`
- `src/client/components/config/stats/StatsConfigPanel.test.tsx` — **back as of TICKET-STAT-02**,
  rewritten against the real store with storage mocked, which is what avoids the selector-ignoring
  mock that killed the original

Their failures were: store mocks using `mockReturnValue(state)` that ignore the selector passed to
`useConfigStore(s => s.config)`; `getByText(/add race/i)`-style queries matching both a button and
the empty-state prose that names it; and `toBeInTheDocument` in a repo where
`@testing-library/jest-dom` is not a dependency.

**The remaining config-panel tests were untouched and pass**: `FocusStatConfig.test.tsx` (15) and
`ItemsConfigPanel.test.tsx` (6) — both went from fully failing to fully green on the config change
alone. So the config panels still have coverage; `components/ui/*` primitives keep all of theirs.

**`Dialog` and `FormulaEditor` are un-skipped.** Of their 11 tests, 10 now run and pass. One
Dialog test was repaired (it walked two `parentElement` hops from the `<h2>`, landing on the dialog
box — which calls `stopPropagation` — instead of the overlay; it now uses `container.firstChild`).

One FormulaEditor test was **removed, not fixed**: it drove `value` by rerender and expected
`onValidate` to fire, but FormulaEditor only validates inside `handleInputChange`, so prop-driven
value changes leave its `error` stale. That is a genuine component bug, tracked separately — the
fix touches a base primitive used by three form dialogs and needs its own browser check.

## Typecheck: 2 known errors

`npx tsc --noEmit` exits non-zero with 2 errors. **Neither is new.** They predate the ticket
workflow and are documented here so a future regression is distinguishable from this noise:

| File | Error |
| --- | --- |
| `src/client/components/ui/Button/Button.test.tsx:68` | TS2339 — `.disabled` read off `HTMLElement` |
| `src/client/services/configFiles.test.ts:238` | TS2352 — `Blob`-shaped literal cast to `File` |

Both are test-typing noise. The two `evaluator.ts` errors that stood beside them for five tickets
are **gone as of TICKET-FORM-07**: `operator` does not exist on type `never` was the switch
narrowing `ast` itself to nothing in its `default` arm, and adding the `^` operator meant
rewriting that switch anyway. Taking the operator as a *parameter* (`applyBinary`, `applyUnary`)
narrows the parameter instead, so `const _exhaustive: never = operator` compiles — the same
exhaustiveness idiom `dependencies.ts` and `curves.ts` already use. The check got stronger, not
weaker: an unhandled operator is now a compile error rather than a runtime throw.

**Was 9 until TICKET-DX-02**, which cleared five as a side effect of fixing the matching lint
errors: the two dead `BaseSkillPanel` props, the unused `React` and `FormulaAST` imports, and the
type-only import in `ValidationReport.test.tsx`. Fixing dead code once satisfied both tools.

## Hotspots: accelerating files

`fallow health --hotspots --since 6m` scores every file by churn × complexity and tags its
velocity `Accelerating`, `Stable`, or `Cooling`. **Accelerating** is the one worth tracking: the
file is being edited more often *and* getting harder to edit, and that pair is what precedes a
file nobody wants to open.

The rule (see the **coding-conventions** skill's Verification section): a ticket that touches a
file which comes back Accelerating adds a row here, naming the ticket that moved it. A file that
cools off keeps its row with the ticket that cooled it, so the direction of travel stays legible.

| File | Hotspot score | First flagged by | Latest | Status |
| --- | --- | --- | --- | --- |
| `architecture/boundaries.test.ts` | 24.6 | TICKET-AUTH-01's run | 3 commits, 310 churn, 0.18 density | ▲ **Accelerating** |
| `vitest.setup.ts` | 8.2 | TICKET-AUTH-01's run | 3 commits, 35 churn, 0.08 density | ▲ **Accelerating** |
| `src/server/http/apiRouter.test.ts` | 23.9 | TICKET-AUTH-01's run | 4 commits, 134 churn, 0.16 density | ─ Stable |
| `src/server/http/apiRouter.ts` | 35.7 | TICKET-AUTH-02's run | 8 commits, 0.14 density | ─ Stable — **cooled by TICKET-GAM-01** |
| `src/server/repositories/rulesetRepository.test.ts` | 32.9 | TICKET-AUTH-03's run | 4 commits, 550 churn, 0.24 density | ▲ **Accelerating** |
| `src/server/repositories/eventRepository.test.ts` | 20.7 | TICKET-AUTH-03's run | 3 commits, 387 churn, 0.21 density | ▲ **Accelerating** |
| `src/server/http/pipeline.test.ts` | 28.8 | TICKET-RUL-01's run | 4 commits, 272 churn, 0.21 density | ▲ **Accelerating** |
| `src/server/http/apiRouter.test.ts` | 49.4 | TICKET-RUL-02's run | 9 commits, 0.16 density | ─ Stable — **cooled by TICKET-GAM-01** |
| `src/server/db/migrate.test.ts` | 13.7 | TICKET-IO-04's run | 4 commits, 0.10 density | ▼ Cooling — **cooled by TICKET-GAM-01** |
| `src/server/routes/rulesets/rulesetPayloads.ts` | 9.6 | TICKET-IO-04's run | 4 commits, 0.09 density | ▼ Cooling — **cooled by TICKET-GAM-01** |
| `src/server/testing/seeds.ts` | 12.4 | TICKET-IO-04's run | 4 commits, 0.09 density | ▼ Cooling — **cooled by TICKET-GAM-01** |
| `src/client/components/rulesets/useRulesetManager.ts` | 12.4 | TICKET-IO-04's run | 4 commits, 0.09 density | ▼ Cooling — **cooled by TICKET-GAM-01** |
| `src/client/components/rulesets/RulesetsPanel.tsx` | 5.5 | TICKET-IO-04's run | 4 commits, 0.04 density | ▼ Cooling — **cooled by TICKET-GAM-01** |
| `src/client/components/rulesets/RulesetsPanel.test.tsx` | 15.1 | TICKET-IO-04's run | 4 commits, 0.08 density | ▼ Cooling — **cooled by TICKET-GAM-01** |
| `src/client/components/rulesets/AccountRulesetHome.tsx` | — | TICKET-IO-04's run | 3 commits, 0.10 density | ▼ Cooling — **cooled by TICKET-GAM-01** |
| `src/server/http/appError.ts` | 8.2 | TICKET-GAM-02's run | 4 commits, 0.09 density | ▲ **Accelerating** |
| `src/client/components/shared/AppShell.tsx` | 5.1 | TICKET-GAM-02's run | 3 commits, 0.05 density | ▲ **Accelerating** |
| `src/client/components/auth/AuthForm.tsx` | 6.2 | TICKET-GAM-02's run | 3 commits, 0.07 density | ▲ **Accelerating** |
| `src/client/routes/signin.tsx` | 7.2 | TICKET-GAM-02's run | 3 commits, 0.07 density | ▲ **Accelerating** |
| `src/client/routeTree.gen.ts` | 5.5 | TICKET-GAM-02's run | 4 commits, 0.03 density | ▲ **Accelerating** — generated |

**Both Accelerating rows were moved by DX-08 and DX-06 rather than by AUTH-01**, which is when they
crossed the three-commit floor and became measurable at all. Recorded under the run that first saw
them, with the tickets that moved them named here rather than lost:

- **`boundaries.test.ts`** — DX-08 rewrote it (9 → 21 cases) and DX-06 added one. 310 churn over
  three commits is a file being *reshaped*, not extended, and that is what the tag is for. It is
  not yet a problem: the growth is one `it` per rule, which is the design. What would make it one is
  the next rewrite of how it cruises — if a fourth ticket changes the harness rather than adding a
  case, that is the signal to split the rule fixtures from the cruise machinery.
- **`vitest.setup.ts`** — three consecutive tickets have each added a line to it (DB-01's
  `DATABASE_URL`, DX-06's note, AUTH-01's `BETTER_AUTH_SECRET`). A five-line file with a comment
  per line is not a maintenance risk; it is on the list because *every* server ticket touches it,
  which is worth knowing before a fourth one does. **AUTH-02 deliberately did not add a fourth
  line**: its OAuth variables are set at the top of `socialSignIn.test.ts` instead, so the
  unconfigured deployment stays the *default* every other server test runs under.
- **The two repository test files** — moved by AUTH-03, which converted every call site when it
  turned `findRuleset(database, id)` into `findRuleset(id, database?)`. That is churn from a
  *mechanical* rewrite rather than from growth, which is the reading the tag cannot make on its own:
  474 churn over three commits looks alarming and is one sweep. What would make it real is a fourth
  ticket reshaping them again — at which point the argument-order question has been reopened, and
  reopening it is the thing to notice.
- **`src/server/http/apiRouter.ts`** — a new row, moved by AUTH-02's second route. Three tickets
  have now edited it (SRV-01 wrote it, AUTH-01 added the auth delegation, AUTH-02 added
  `/api/auth-providers`), which is exactly the shape the tag is for: a file every server ticket
  passes through. It is not a problem yet — the route table is still a literal object anyone can
  read in one screen — and the thing to watch is `ROUTES` growing path *parameters*. TICKET-RUL-01
  brings `/api/rulesets/:id` and with it a matcher, and that is the edit that turns a readable table
  into machinery worth splitting out.

  **RUL-01 made that edit, and the prediction half came true.** The score is 20.5 and the file is
  still Accelerating: four tickets, `PATTERN_ROUTES` beside `ROUTES`, and three helpers
  (`segments`, `matchesPattern`, `findRoute`) that are machinery rather than table. It was kept
  here deliberately — the matcher is fifteen lines, has no regular expressions and no wildcards,
  and splitting it into its own module while it has two entries would be a file per function. **The
  signal to split is the fifth route table or a matcher that grows a feature** (optional segments,
  a wildcard, a parameter that has to be handed to the handler). RUL-03's
  `/api/rulesets/:id/copy` and GAM-01's session routes are the next edits; if either needs more
  than a literal `:id`, the matcher leaves.

  **RUL-02 and RUL-03 added three more routes between them and changed no machinery**, which is the
  reassuring version of this row: `PATTERN_ROUTES` went from two entries to five, and the matcher —
  the thing the paragraph above worried about — was untouched by either. Six commits and 28.8 now,
  on churn alone. **RUL-03 was the first real test of the prediction**, because
  `/api/rulesets/:id/copy` is the first path with an *action* segment after the id, and it needed
  one line in the table and one widened `rulesetIdFrom`. The signal to split is still the fifth
  route table or a matcher that grows a feature; it has not arrived.
- **`src/server/http/apiRouter.test.ts`** — Stable at 23.9 in AUTH-01's run, Accelerating at 30.8
  now, moved by RUL-01 and RUL-02 in consecutive tickets. Both edits had the same shape and are
  worth noticing together: each new route made a *previously unanswerable* request answerable, and
  each broke a test that had picked that very request as its example of "nothing is here". RUL-01
  retired `/api/rulesets` as the 404 example; RUL-02 retired `PUT` as the 405 example. **A test that
  names a path or a verb nothing answers has a shelf life**, and the next ticket adding a route
  should expect to rename one. That is a property of what the file asserts rather than a defect in
  how it is written.

  **RUL-03 was the next ticket, and it did exactly that** — a third time, with the third kind of
  example: its `/api/rulesets/:id/copy` turned *"a deeper path is not swallowed"* from a 404 into a
  405, because that path now exists. Seven commits, 36.0, still Accelerating. The prediction has now
  held three times running, so treat it as the file's normal behaviour rather than as news: **a
  ticket adding a route should open this file first**, and the case to look for is any assertion
  whose subject is the *absence* of a route.

  **GAM-01 added five routes and cooled both `apiRouter` rows to Stable**, which is worth reading as
  the tag working rather than as the problem going away. The score went *up* (35.7 / 49.4) and the
  velocity turned, because five routes cost the router **eight table lines and no machinery**: the
  matcher `apiRouter.ts` has worried about since RUL-01 handled a second collection, a second
  parameterised path and — for the first time — **two different action segments under one id** with
  nothing added to it. That was the fifth route table's worth of growth without the fifth route
  table, and the prediction *"the signal to split is a matcher that grows a feature"* is now three
  tickets old and still unmet. The test file's prediction held for a fourth time in a different key:
  GAM-01 did not retire an absence assertion, it added two (`/api/sessions/abc/nonsense` is a 404,
  `GET` on `/archive` is a 405) — so the file's pattern is *each new collection brings its own
  absence cases*, and the shelf-life warning applies to those in turn.
- **IO-04's seven rows are one event, and reading them separately would overstate them.** Every one
  crossed the **three-commit floor** in this ticket — which is the first moment `fallow health` can
  score a file at all — and the complexity densities are 0.04 to 0.10, the low end of the table.
  What they have in common is that DX-07 reset the churn history and the RUL/IO tickets are the
  first three or four commits any of these paths have had since. `rulesetPayloads.ts` is the only
  one where the tag points at something real: it has now been extended by RUL-01, RUL-02 and IO-04,
  and IO-04 split its two refusal messages into `wrongVersionSent` / `wrongShapeSent` so a save and
  an import could share them. **The signal to watch is a fifth ticket adding a third gate function
  to it** — at which point "the wire ↔ row boundary" has become a validation layer and wants its own
  module. The six client and harness rows are growth (`seeds.ts` gained one function,
  `RulesetsPanel.tsx` two elements), and a ticket that only *reads* them should not expect to find
  anything hard.

  **GAM-01 cooled two of the seven** — `rulesetPayloads.ts` (9.6) and `seeds.ts` (12.4) are both
  ▼ Cooling — and the reason is the useful half. Each got *smaller*: `nameFrom` left the payload
  module for `routes/entityName.ts`, and `seeds.ts` swapped its raw `game_session` insert and its
  three re-inferred row types for a repository call and three re-exports. That is what the
  prediction above asked for in reverse — the fifth ticket to touch `rulesetPayloads.ts` took a gate
  function *out* rather than adding a third.

  **GAM-02's run says all seven cooled, not two**, and the correction is worth keeping rather than
  quietly overwriting. The paragraph above named the two whose cooling had a *reason* — a function
  moved out, a raw insert replaced — and read the rest as still climbing. They were not: the other
  five cooled for the duller reason, which is that GAM-01 and GAM-02 added a whole feature without
  touching the ruleset surfaces at all. **That is the tag behaving correctly and the note above
  reading it too eagerly**: churn velocity falls when a ticket goes elsewhere, and that is not the
  same as a file getting easier. Their rows keep the ticket that cooled them; nothing about the code
  changed.
- **`src/server/http/pipeline.test.ts`** — a new row, and RUL-01 is the first ticket in this
  milestone to touch it, which is what earns it one at last (AUTH-02's run flagged it while no
  ticket had). The edit was small and worth recording anyway: the *"named by exactly two modules"*
  scan was a raw text search, so RUL-01's two modules **explaining in a comment why they do not
  widen `RequestScope`** tripped it. The scan now strips comments before looking — the discipline
  `routes/routeGuards.test.ts` already used — and a new case proves the stripping is narrow rather
  than greedy. A guard that punishes a module for documenting the rule teaches people to stop
  documenting it. 240 churn over three commits is the file being *reshaped* by DX-06 and AUTH-01
  rather than by growth; what would make the tag real is a fourth ticket changing how it scans
  rather than what it scans for.
- **GAM-02's five rows are two different stories, and only one of them is about this ticket.**
  `appError.ts` is the real one: four tickets have now added an error to it (`conflict`,
  `unprocessable`, `tooManyRequests`), and every one arrived the same way — a route needed a status
  the module did not have. It is still a status table and a constructor per row, which is the
  cheapest shape this could be, so the tag is not yet pointing at a defect. **The signal is a
  constructor that takes anything but a message** — a retry-after header, a field list, a machine
  code beyond `ERROR_CODE` — because that is the edit that turns a table into a protocol and wants
  its own module.
- **The three `auth/` rows and `routeTree.gen.ts` earn rows for the first time**, and the reason
  they were skipped in RUL-01's run is exactly the reason they cannot be skipped now: the rule is
  about files a ticket *touched by hand*, and GAM-02 touched three of them. `signin.tsx`,
  `AuthForm.tsx` and `AppShell.tsx` were all edited to carry a `?redirect=` across the sign-in ↔
  sign-up switch. The densities are 0.05–0.07 — the bottom of the table — and the churn is one
  concern threading through three files, which is what a redirect *is*. **The signal to watch is a
  fourth destination**: two (`/account`, and now any protected route) are carried by
  `signInDestination.ts` as data; a third kind of destination that needs its own rule is the edit
  that makes this a router concern rather than a form one.
- **`routeTree.gen.ts` keeps its row and will never earn an action.** It is generated and may not be
  edited, so its Accelerating tag is a fact about how many tickets added routes rather than about
  the file. It is listed because the rule says a touched file gets a row, and silently exempting
  the one file that always qualifies would make the table's completeness a judgement call.

`scripts/build-sheet-import.mjs` (62.5) and `vite.config.ts` (3.3) are above the threshold and
**stable**, and no ticket in this milestone has touched either. `src/server/testing/database.ts` and the
`auth/` test files came back Accelerating in RUL-01's run and are **not** given rows: the rule is
about files a ticket *touched*, and RUL-01 touched none of them by hand. **GAM-02 is where that
exemption ran out** for four of them — see its rows above. `src/server/env.ts` and
`env.test.ts` are both ─ Stable despite AUTH-02 adding five variables to them, which is the table
working — the additions are table entries, not new machinery.

**Read the table as partial rather than complete, and for one specific reason.**
**TICKET-DX-07 reset every file's churn history**, so scoring is blind for roughly six months:
`fallow health --hotspots --since 6m` counts commits per *path*, and every path under `src/` changed
in one commit. Nothing was Accelerating at the move, so nothing is owed a backdated row — but a
short table between now and ~2027-02 means "the history restarted", not "the churn stopped".
`--follow`-style rename tracking is not something fallow does today. 337 files are excluded for
having fewer than three commits, which is that reset still doing its work.

Snapshot with `fallow health --save-snapshot` and compare with `fallow health --trend` so the
per-metric deltas (`hotspot_count`, `avg_cyclomatic`, `duplication_pct`, …) are measured rather
than recalled.

## Architecture rules: clean, and they cost nothing

`yarn run arch` reports **zero error-level findings** and zero warnings, over 578 modules and 2650
dependencies (549 / 2495 before TICKET-GAM-02, 537 / 2396 before TICKET-GAM-01, 516 / 2281 before
TICKET-IO-04, 437 / 1917 before TICKET-RUL-01). That is the baseline: an error-level finding is
yours. `no-orphans` reports at *warning* severity by design and does not fail the build.

**Measured cost of DX-08's nine extra rules: none.** `depcruise src`, three runs each, same tree:

| Rule set | Runs |
|---|---|
| DX-07's 6 rules | 3.65s / 3.60s / 3.95s |
| DX-08's 15 rules | 3.74s / 3.71s / 3.66s |

The difference is inside the run-to-run noise, and the reason is structural rather than lucky: the
graph is built once and every rule is a pass over a graph that already exists. Building it is the
cost; the rules are not. (Those figures include `npx` start-up; through `yarn run arch` the whole
step is ~2.0s.) It runs in `yarn run check`, which the pre-commit hook runs, and the `verifier`
subagent reports it as its fourth numbered step.

**Five exemptions exist and each is recorded in `.dependency-cruiser.mjs` with its reason**, which
is the honest half of "the existing tree produces no error-level finding":

| Exempted | From | Why |
|---|---|---|
| `boundaryFixtures/` | every rule, as a *source* only | They are the modules that prove the rules fire. Exempted as sources rather than excluded, so an import *pointing at* one is still reported |
| `*.test.ts(x)`, `*.fixtures.ts` | `persistence-belongs-to-the-store`, `no-dev-dep-in-production` | Nothing ships a test; a test mocking the storage service or importing `fast-check` is doing the rule's work rather than breaking it |
| `client/components/shared/useAppHydration.ts` | `persistence-belongs-to-the-store` | Imports `isStorageAvailable` (a capability probe run before anything is read) and `StorageSchemaError` (an `instanceof` discriminant). It loads and saves nothing — each of those is a store action it calls |
| `routeTree.gen.ts` ↔ `router.tsx` | `no-circular` | Generated, type-only, erased before anything runs. Visible only because `tsPreCompilationDeps` is on, which the root boundary needs. The file may not be hand-edited |
| `server/testing/` | `queries-belong-to-repositories` | A harness that seeds rows is doing repository work by definition (DX-06). Widened only because `test-harness-stays-in-tests` locks the door from the other side: nothing that answers a real request may import it |

`.fallowrc.jsonc` drops `src/**/boundaryFixtures/**` from fallow's analysis entirely for the
matching reason: every fixture is a deliberate cycle, orphan, undeclared import or devDependency in
shipped code, so fallow is *right* about all of them and every finding is noise. DX-07's
`dynamicallyLoaded` only answered "is it reachable" and left the dependency findings standing.

## Lint and formatting: clean

`yarn run check` reports **no findings at all** as of
[TICKET-DX-02](docs/v1.0_foundation/tickets/TICKET-DX-02-reconcile-biome-with-the-codebase.md).
There is no baseline to subtract any more — anything it reports is yours.

How it got there: `biome.json` was reconciled with the code (space/2, single quotes, `lineWidth`
100, es5 trailing commas), the tree was formatted to match in one mechanical commit, and the 33
real lint errors were fixed rather than suppressed. `.githooks/pre-commit` runs `yarn run check`
on every commit — enable it in a fresh clone with `git config core.hooksPath .githooks`.

Three suppressions exist, each with a stated reason: two in `Dialog.tsx` and `Label.tsx` where a
base primitive cannot see the association the caller owns. No lint rule is disabled in
`biome.json`.

**One limit of the gate, found by the `verifier` on TICKET-IO-04 and worth knowing.** `yarn run
check` exits **0** on **info**-severity findings, so the pre-commit hook cannot catch that class —
IO-04 landed four `lint/complexity/useLiteralKeys` diagnostics that both `yarn run check` and
`biome lint` reported and neither failed on. They were fixed rather than left (a `as never` plus
bracket indexing became the cast-to-a-named-shape the sibling route suites use), and the lesson is
the general one: *"clean as of TICKET-DX-02"* means **no diagnostics**, not *"the hook exits 0"*.
Read the output, not the exit code — `yarn run lint --max-diagnostics=1000` prints them all.
