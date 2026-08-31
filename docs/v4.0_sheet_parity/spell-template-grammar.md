# The effect-template grammar

**One page, for whoever transcribes the workbook's 326 formula effects.** You should not have to
read the parser. If something here is ambiguous, that is a bug in this page — the implementation is
[`src/shared/engine/formula/template.ts`](../../src/shared/engine/formula/template.ts) and its tests
are [`template.test.ts`](../../src/shared/engine/formula/template.test.ts) beside it.

Defined by [TICKET-SPL-03](./tickets/TICKET-SPL-03-spell-effect-templating.md) under
[D4](./overview.md#d4--spell-effect-text-goes-through-the-formula-engine): spell effects are prose
with computed numbers in them, and the numbers go through the **one** formula engine.

## The grammar in three sentences

A template is text. **`{` opens a placeholder and the next `}` closes it**; what is between them is
a formula, and it is trimmed. Everything else is literal text and is kept byte-for-byte — spacing,
double spaces, newlines, the sheet's own typos.

```
a {stats.wisdom}-foot-radius sphere takes {skills.fire.bonus * 2} fire damage
```

## Converting a sheet cell

The workbook writes an effect as string concatenation:

```excel
="lowers the endurance of creatures hit by " & Calcu!R7
```

Which becomes, mechanically:

```
lowers the endurance of creatures hit by {stats.wisdom}
```

Each `& <cell> &` becomes `{<what that cell is>}`, and each `"…"` fragment stays as it is. That is
the whole conversion. **Cite the cells** in the fragment's notes the way every other import does —
this page defines the syntax, not where a number came from.

The three cell kinds the xlsx's effect formulas actually reach, from
[systems/13](./systems/13-spells.md):

| The sheet reads | Write |
|---|---|
| A final stat value (`Calcu!R7`) | `{stats.wisdom}` or `{WIS}` |
| A skill's level (`Calcu!F20`) | `{skills.healing.level}` |
| A skill's bonus (`Calcu!M30`) | `{skills.fire.bonus}` |

## What a placeholder may contain

Anything the formula engine accepts at the **`spell-effect`** attachment point, which is the same
set a roll's input sees:

- **`stats.<name>`** — a final stat value, after race, invested points and equipment.
- **`<ABBREVIATION>`** — the same stat, spelled the way the sheet spells a cell. `{WIS}` and
  `{stats.wisdom}` are the same number.
- **`skills.<name>.level`** and **`skills.<name>.bonus`** — a skill's level, and its bonus.
  Bare `skills.<name>` is the level.
- **`const.<name>`** — a ruleset constant.
- **`curve.<name>(x)`** and **`curve.<name>.<column>(x)`** — a curve lookup.
- **Arithmetic**: `+ - * / ^`, parentheses, and the engine's functions. `{skills.fire.bonus + 1}`
  is the sheet's `Calcu!M30+1`.

**Function names are lower-case.** `{round(WIS / 2)}` works; `{ROUND(WIS / 2)}` comes back
*Unknown function*. The sheet shouts them and the engine does not — this is the single most likely
mechanical mistake in a 326-row transcription, so check for it first if a batch comes back broken.

The names are the ruleset's **current spellings**. A stat renamed later re-spells every effect that
reads it automatically, because what is stored is the id (`references.ts`) — you never hand-edit a
template to follow a rename.

## The three things that are text, not syntax

These are the forgiving cases, and they exist so that plain effects and half-typed ones both behave:

1. **A template with no braces is entirely text.** The 92 plain-text effects need no conversion at
   all — paste them as they are.
2. **An unclosed `{` is text.** `a bowl { of soup` is a sentence. Nothing after an unclosed brace
   is scanned either.
3. **An empty `{}` is text**, braces included. `nothing {} here` reads back exactly as written.

## The four rules to keep in mind

- **No nesting.** The first `}` closes the placeholder. A `{` inside one is part of the formula
  source and will fail to parse there.
- **No escape for a literal `{…}` pair.** Braces do not occur in the workbook's prose, so none was
  built ([the house rule](../../CLAUDE.md) against abstractions before their first caller). If a
  ruleset ever needs one, doubling is the obvious extension.
- **A broken placeholder costs one number, not the sentence.** It renders as an error chip in place
  and the prose around it reads normally — so a batch with a typo in row 200 is still readable, and
  the ruleset's validation report names the spell and quotes the placeholder.
- **Braces rather than brackets**, because `[` is taken: the stored form of a formula spells every
  reference as `[uuid]`.

## Where a template is written and read

- **Written**: Configuration → Spells → a spell's *Effect* box, which shows a live preview with
  editable sample values.
- **Read**: a Player's **Spellbook** on their character sheet, resolved against *their* stats and
  skills — the same evaluation, a different character.
- **Checked**: `Validate Configuration` reports every placeholder that cannot resolve, one line per
  placeholder, quoting it.

Passive abilities reuse this grammar unchanged ([TICKET-PAS-01](./tickets/TICKET-PAS-01-passives-catalog.md)).
