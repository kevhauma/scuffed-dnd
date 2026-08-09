---
name: story-ticket
description: Create a new ticket (user story + description, as-is, to-be, detailed acceptance criteria) when the user asks for a bug, refactor, or feature. Use whenever someone says "add a user story", "write a ticket", "create a story for this bug/refactor/feature", describes work that should be captured as a ticket, or asks to expand a plan line into a ticket.
---

# Create a new ticket

When the user asks to capture a **bug**, **refactor**, or **feature**, produce two linked pieces
in the version they choose:

1. A detailed **ticket** in that version's `tickets/` folder — its own user story plus
   description, as-is, to-be, and detailed acceptance criteria.
2. A one-line **entry** (title + checkbox + link) in that version's `overview.md`.

**Every version gets this same treatment** — an `overview.md` plus a `tickets/` folder. **Never
assume the folder layout or which versions exist; it changes.** Discover the current structure at
runtime and mirror the ticket *formatting*, but always create both pieces.

## Step 1 — Ask which version it belongs to

**This is the first and most important question. Do not guess.** List `docs/` first to find the
version destinations that actually exist right now, then ask via `AskUserQuestion`.

- Present **exactly the versions you found in `docs/`** — read them live, don't recite a
  remembered list.
- Always include an option to create a **new version**; if they pick it, ask for its name
  (`vX.Y_<topic>`, see `docs/README.md`) and scaffold `docs/<version>/overview.md` +
  `docs/<version>/tickets/` mirroring the most recent existing version.

Then open that version's `overview.md` and one existing ticket to learn its conventions.
`overview.md` lists tickets in **recommended build order, not grouped by area** — don't
reintroduce area headings when adding the new entry.

Confirm the **type** if ambiguous: `Bug fix`, `Refactor`, or `Feature`. It affects the story
wording and the ticket's `Type` line.

## Step 2 — Resolve the area prefix (consistent, not hardcoded)

Tickets are named by an **area prefix**. Derive it, don't rely on a fixed table:

1. Determine the story's area from what it touches (the domain, not a memorised list).
2. Scan existing tickets across `docs/*/tickets/` for the prefix already used for that area.
   **If the area is already mapped, reuse that exact prefix.**
3. **If the area has never been ticketed, mint a new short prefix** (2–4 uppercase letters,
   unambiguous against existing ones) and use it consistently from then on.

Prefixes in use at time of writing — verify against the tree rather than trusting this list:
`FORM` (formula engine), `CALC` (calculators), `ROLL` (dice + combat rolls), `SKL`/`STAT`/`MAT`/
`ITEM`/`RACE`/`CUR` (the configuration domains), `CHAR` (characters, sheet, creation),
`INV` (inventory + equipment), `NAV` (routing, layout, mode switching), `IO` (import/export,
storage), `UI` (base component library), `POL` (integration + polish passes).

Take the next number for that prefix, zero-padded to match existing files. Filename:
`TICKET-<PREFIX>-<NN>-<kebab-slug>.md`.

## Step 3 — Write the ticket

Mirror the structure of existing tickets in that version. Required sections: **User story**,
**Description**, **Current situation (as-is)**, **Desired result (to-be)**, **Acceptance
criteria**, plus the metadata header and Notes.

```markdown
# TICKET-<PREFIX>-<NN> — <Title>

- **Area:** <Area>
- **Type:** <Bug fix | Refactor | Feature>
- **Traceability:** <Requirement numbers from docs/v1.0_foundation/requirements.md, e.g. 11.1–11.6, 21.1-21.5>

## User story

As a <User | Player>, I want <capability>, so <benefit>.

## Description

<1–3 sentences: what this delivers and why, in plain language.>

## Current situation (as-is)

- <How it works today. Link real files with clickable relative paths. For bugs, pinpoint the root cause.>

## Desired result (to-be)

- <The target behaviour after this ticket lands.>

## Acceptance criteria

- [ ] <Specific, testable outcome.>
- [ ] <Persistence goes through the store action, never a direct storage-service or localStorage call — if data is touched.>
- [ ] <Derived values come from the engine calculators, not recomputed inline — if numbers are shown.>
- [ ] <Feature components compose components/ui primitives; no raw HTML controls; base components gain no layout styles.>
- [ ] <Unit tests cover: … (name the cases).>
- [ ] <Every User-authored formula field renders `FormulaPreview` with its `FormulaOwner`, not a bare `FormulaEditor` — if this adds or reworks a field the User types a formula into.>
- [ ] <The feature's `docs/imports/` fragment carries the source sheet's real data for it, with `source.ranges` cited and anything the sheet lacks recorded in `notes`; `yarn run sheet:import` regenerated — if this touches a persisted shape.>
- [ ] <Verified via the fallow skill and the react-conventions skill.>
- [ ] <Verified live in the browser: … — for anything UI-visible.>

## Notes

- <Edge cases, design trade-offs, related tickets, or scope caveats.>
```

Writing rules:

- **User story** is the classic `As a … I want … so …` line, using the glossary's roles — a
  **User** configures the ruleset, a **Player** plays a character. It lives only in the ticket.
- **As-is** must reference actual code with clickable relative links and, for bugs, name the exact
  root cause (function, early return, wrong dependency). Grep the codebase — don't invent paths.
- **Traceability** cites requirement numbers from
  [requirements.md](../../../docs/v1.0_foundation/requirements.md). Ask the **spec-navigator**
  subagent if you're unsure which requirement covers the behaviour. If nothing covers it, say so
  in Notes and propose the requirement rather than silently inventing scope.
- **Acceptance criteria** are checkboxes, each independently verifiable. Fold in the repo's hard
  rules where relevant (store-owned persistence, engine-owned math, base-vs-feature component
  split, theme tokens only, `routeTree.gen.ts` untouched).
- Match the concise, traceable style of existing tickets — no filler.

## Step 4 — Add the ticket to `overview.md`

One line per ticket — title + checkbox + link, no story text:

- **Feature / refactor:** `- [ ] [TICKET-<PREFIX>-<NN>](./tickets/TICKET-<PREFIX>-<NN>-<slug>.md) — <Title> (Req <numbers>)`
- **Bug:** `- [ ] [TICKET-<PREFIX>-<NN>](./tickets/…) — <Title> (bug fix, Req <numbers> — <one-line root cause>)`

**Insert it at its real position in the build order, not at the end and not grouped by area.** If
it depends on another ticket, place it immediately after and say so inline (`— needs
TICKET-CHAR-01`); if it's independent, place it where its priority/effort fits and say so
(`— independent, can ship any time`). Match the ordering convention the version's list already uses.

## Step 5 — Report back

Tell the user which version the ticket landed in, link both the new ticket file and its line in
`overview.md`, and note where in the build order you placed it and why. Do not run
lint/test/typecheck — these are docs, not code.
