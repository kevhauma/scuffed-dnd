/**
 * Formula Templates — prose with computed numbers in it (TICKET-SPL-03)
 *
 * The workbook's spell effects are not text and are not formulas; they are text *around* formulas.
 * 326 of its 418 effect cells are live string concatenation —
 * `"regains hit points equal to " & Calcu!F20` — and
 * [D4](../../../../docs/v4.0_sheet_parity/overview.md#d4--spell-effect-text-goes-through-the-formula-engine)
 * says the app models that as template text whose placeholders go through **the one engine**. This
 * module is the splitter that makes that possible, and it is the whole of the grammar.
 *
 * **There is no arithmetic here.** Not a `+`, not a `Number()`, not a regex over an operator. This
 * file finds where a placeholder starts and stops; what is inside one is
 * `parseFormula` → `validateFormula` → `evaluateFormula`'s business, reached through
 * {@link resolveTemplate}'s single call to `evaluateFormulaString`. A second evaluator is the one
 * thing CLAUDE.md's formula rule forbids outright, and a splitter that "just handled simple cases"
 * is how one gets written by accident.
 *
 * ## The grammar, in full
 *
 * A template is text. `{` opens a placeholder and the next `}` closes it; everything between is
 * formula source, trimmed. Everything outside is literal text, kept byte-for-byte including
 * newlines and double spaces — the sheet's own spacing is data (v4 D1), not something to tidy.
 *
 * ```
 * a {stats.wisdom}-foot-radius sphere takes {skills.fire.bonus * 2} fire damage
 * ```
 *
 * Three rules and no fourth:
 *
 * - **No nesting.** The first `}` after a `{` closes it, so a `{` inside a placeholder is part of
 *   the formula source and will fail to parse there — which is where a reader wants to hear about
 *   it.
 * - **An unclosed `{` is literal text.** `a { of soup` is a sentence, not a broken template. This
 *   is forgiving on purpose: the 92 plain-text effects and every hand-typed description pass
 *   through untouched, and a User halfway through typing a placeholder sees prose rather than an
 *   error that will go away on the next keystroke.
 * - **An empty placeholder is literal text too.** `{}` and `{   }` have no formula in them, so
 *   there is nothing to evaluate and nothing to report; they read as written.
 *
 * **There is deliberately no escape for a literal `{…}` pair.** Braces do not occur in the
 * workbook's prose, and an escape nobody needs is an abstraction before its first caller — the
 * unclosed-brace rule already covers every stray `{` that actually appears. If a ruleset ever needs
 * one, doubling (`{{`) is the obvious extension and this is the paragraph to delete.
 *
 * **Why braces and not brackets.** `[` is taken: the *stored* form of a formula spells every
 * reference as `[uuid]` (TICKET-REF-01, `references.ts`), so a `[[…]]` template delimiter would
 * collide with the one syntax that has to survive a round trip. `{` is free, and it turns the
 * sheet's `"text " & cell & " text"` into `text {cell} text` by a mechanical substitution — which
 * is what the data pass needs, because an awkward grammar is 326 awkward rows.
 *
 * ## Both forms, like every other formula
 *
 * A placeholder is a formula, so it has the same two forms everything else does — display
 * (`{stats.wisdom}`) and stored (`{[b1f0…]}`). {@link mapTemplateFormulas} is what lets
 * `references.ts` translate a template without knowing anything about the grammar, and it is why a
 * stat rename re-spells 326 spell effects along with every stat formula.
 *
 * **Validates: v4 systems/13 gap 4; v4 D4; Concept 00 §5**
 */

import type { FormulaContext, FormulaResult } from '../../types/formula';
import { evaluateFormulaString } from './evaluator';

/** What opens a placeholder */
const OPEN = '{';

/** What closes the placeholder an {@link OPEN} started */
const CLOSE = '}';

/** Literal prose, exactly as written */
export interface TemplateTextSegment {
  kind: 'text';
  text: string;
}

/** One placeholder, holding formula source and nothing else */
export interface TemplateFormulaSegment {
  kind: 'formula';
  /** The source between the braces, trimmed — what the engine is handed */
  source: string;
}

/**
 * One piece of a parsed template
 *
 * A discriminated union of object shapes rather than a const-object tag, which is the exception
 * CLAUDE.md's *no bare string-union types* rule names — the discriminant is what makes the union
 * narrow, and `kind` is never written anywhere but here and in a `switch`.
 */
export type TemplateSegment = TemplateTextSegment | TemplateFormulaSegment;

/** A placeholder with what it came out as — a number, or the error that is also a value */
export interface ResolvedFormulaSegment {
  kind: 'formula';
  source: string;
  result: FormulaResult;
}

/** One piece of a resolved template: prose, or a placeholder's answer */
export type ResolvedSegment = TemplateTextSegment | ResolvedFormulaSegment;

/**
 * Split template text into prose and placeholders
 *
 * The whole grammar, and the only place that knows what a brace means. Adjacent text is not
 * merged and empty text segments are not emitted, so a template that is one placeholder yields one
 * segment and a template with no placeholders yields exactly one text segment — which is what the
 * 92 plain-text effects are.
 *
 * @param template The template text as authored
 * @returns Its segments, in order; an empty template yields none
 */
export function parseTemplate(template: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];

  /*
   * Two cursors, not one, and the second is what the first draft got wrong.
   *
   * `textFrom` is where the current run of prose began; `search` is where to look for the next
   * opener. They move together for a real placeholder and **apart** for an empty one — `{}` is
   * prose, so the search has to step over it while the text run keeps flowing right through it. A
   * single cursor made the two the same thing, which silently deleted everything before a `{}`:
   * *"nothing {} here"* came out as *" here"*. The empty-placeholder case is why this file has a
   * test rather than an obvious implementation.
   */
  let textFrom = 0;
  let search = 0;

  while (search < template.length) {
    const open = template.indexOf(OPEN, search);

    if (open === -1) break;

    const close = template.indexOf(CLOSE, open + 1);
    // An unclosed brace is prose — see the module header. Nothing after it can be a placeholder
    // either, because a placeholder needs an opener that is not this one.
    if (close === -1) break;

    const source = template.slice(open + 1, close).trim();

    if (source === '') {
      // Step the search past it and leave the text run alone: the braces stay in the sentence,
      // which is what *an empty placeholder is literal text too* means
      search = close + 1;
      continue;
    }

    if (open > textFrom) segments.push({ kind: 'text', text: template.slice(textFrom, open) });

    segments.push({ kind: 'formula', source });
    textFrom = close + 1;
    search = close + 1;
  }

  if (textFrom < template.length) segments.push({ kind: 'text', text: template.slice(textFrom) });

  return segments;
}

/**
 * Every placeholder's source, in the order they appear
 *
 * What a validator, a dependency walker and a preview each want: the formulas a template contains,
 * without the prose between them. Duplicates are kept — the same reference twice is two
 * placeholders, and a caller counting holders dedupes for its own reasons rather than being handed
 * a set that lost the order.
 *
 * @param template The template text
 * @returns The formula sources
 */
export function templateFormulas(template: string): string[] {
  const segments = parseTemplate(template);

  return segments
    .filter((segment): segment is TemplateFormulaSegment => segment.kind === 'formula')
    .map((segment) => segment.source);
}

/**
 * Rewrite every placeholder, leaving the prose exactly as it was
 *
 * `references.ts`' way in: it knows how to turn one formula from display form into stored form and
 * back, and this is what applies that to a template without teaching it the grammar. The prose
 * round-trips byte-identical, which is the same promise `toStoredFormula` makes about the spacing
 * inside a formula.
 *
 * **A transform that returns something containing a brace would corrupt the template**, and nothing
 * does: the two callers are the id/display translation, whose output is a formula.
 *
 * @param template The template text
 * @param transform What to do to each placeholder's source
 * @returns The template with every placeholder rewritten
 */
export function mapTemplateFormulas(
  template: string,
  transform: (source: string) => string
): string {
  const segments = parseTemplate(template);

  return segments
    .map((segment) => {
      if (segment.kind === 'text') return segment.text;

      const rewritten = transform(segment.source);
      return `${OPEN}${rewritten}${CLOSE}`;
    })
    .join('');
}

/**
 * Evaluate every placeholder against one context
 *
 * **The single call into the engine**, which is what makes *no second evaluator* checkable rather
 * than merely intended: `evaluateFormulaString` parses and evaluates, and a placeholder that cannot
 * be parsed comes back as a `syntax` error **value** rather than throwing — so one broken
 * placeholder costs the reader that number and not the sentence around it (Concept 00 §7).
 *
 * The prose is carried through untouched, so a caller can render text and errors in one pass.
 *
 * @param template The template text, in display form
 * @param context The variables and namespace resolvers every placeholder is evaluated against
 * @returns The segments, each placeholder carrying what it came out as
 */
export function resolveTemplate(template: string, context: FormulaContext): ResolvedSegment[] {
  const segments = parseTemplate(template);

  return segments.map((segment) => {
    if (segment.kind === 'text') return segment;

    const result = evaluateFormulaString(segment.source, context);

    return { kind: 'formula', source: segment.source, result };
  });
}
