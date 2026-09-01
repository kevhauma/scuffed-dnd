/**
 * Formula References
 *
 * Translation between the two forms every user-authored formula has (Concept 00 §6):
 *
 * - the **display form**, which is what the User reads and writes — `STR + DEX`, `stats.speed`,
 *   `skills.stealth.level`;
 * - the **stored form**, which is what persists — the same expression with every reference
 *   replaced by the referenced entity's stable id, `[b1f0…] + [7c22…]`.
 *
 * Storing ids is what makes a rename harmless: a code, an abbreviation and a name are display
 * data, so changing one re-renders the display form without touching what the formula points at.
 * The reverse holds too — the stored form survives a round trip through JSON and comes back
 * spelled the way the ruleset currently spells things.
 *
 * The translation works from the tokenizer rather than from the AST, so everything outside a
 * reference token — spacing, parentheses, the User's capitalisation of function names — comes
 * through byte-identical. A reference that resolves to nothing is left exactly as written: an
 * unknown code stays an unknown code and a dangling id stays a dangling id, which is what the
 * validator is there to report.
 *
 * The index is **derived from the configuration on every call and never persisted** — it is a
 * lookup table, not data.
 *
 * **Validates: Concept 00 §6; spec §3.2**
 */

import type { Configuration, Skill, Stat } from '../../types/config';
import type { FormulaToken } from './parser';
import { tokenizeFormula } from './parser';
import { mapTemplateFormulas } from './template';

/**
 * The reference spaces a token can be resolved in
 *
 * `bare` is the legacy flat code space shared by main, speciality and combat skills; the rest are
 * the namespaces whose members are configured entities. A curve is named by a **call**
 * (`curve.cr(x)`), but the token being rewritten sits in the same place a member always does, so
 * the scan needs no special case for it.
 *
 * `curveColumn` is the one space that is *not* a namespace. A curve's column sits in the property
 * segment — `curve.point_buy.main(9)` — where every other property (`skills.stealth.level`) is a
 * fixed field rather than something the User named. A column is named, so it is renamable, so it
 * has to be id-resolved like everything else (TICKET-CRV-03, closing what TICKET-CRV-01 left
 * open). Its spellings are only unique **within one curve**, so its `toId` keys are qualified by
 * the owning curve's id; `toDisplay` needs no qualifier, because a column id is unique outright.
 */
type ReferenceSpace = 'bare' | 'skills' | 'stats' | 'const' | 'curve' | 'curveColumn';

const REFERENCE_SPACES: readonly ReferenceSpace[] = [
  'bare',
  'skills',
  'stats',
  'const',
  'curve',
  'curveColumn',
];

/** How a column's display spelling is keyed in `toId.curveColumn` — unique per curve, not globally */
function columnKey(curveId: string, columnName: string): string {
  return `${curveId}.${columnName}`;
}

/**
 * Display spelling ↔ stable id, per reference space
 *
 * Derived data. Build it with `buildReferenceIndex`, never store it.
 */
export interface ReferenceIndex {
  /** Display spelling → id, for writing the stored form */
  toId: Record<ReferenceSpace, ReadonlyMap<string, string>>;
  /** Id → display spelling, for writing the display form */
  toDisplay: Record<ReferenceSpace, ReadonlyMap<string, string>>;
}

/**
 * How a stat is spelled inside a formula
 *
 * Stats carry a name and an id but no abbreviation of their own, so the display spelling is a
 * slug of the name — `Max Health` is written `stats.max_health`. It is display data like any
 * other: the stored form holds the stat's id, so renaming the stat re-slugs every formula naming
 * it. TICKET-STAT-01 gives the unified stat a real code and this derivation retires with it.
 *
 * @param stat - The stat to spell
 * @returns An identifier-shaped member name
 */
export function statMemberName(stat: Pick<Stat, 'name'>): string {
  return memberSlug(stat.name, 'stat');
}

/**
 * How a skill is spelled inside a formula
 *
 * The same derivation as a stat's, for the same reason: a `Skill` carries a name and an id but no
 * code since TICKET-SKL-02, so `Lock picking` is written `skills.lock_picking`. The stored form
 * holds the skill's id, so renaming re-slugs every formula naming it.
 *
 * @param skill - The skill to spell
 * @returns An identifier-shaped member name
 */
export function skillMemberName(skill: Pick<Skill, 'name'>): string {
  return memberSlug(skill.name, 'skill');
}

/**
 * A name as an identifier-shaped member, prefixed when it would not start with a letter
 *
 * A name of digits or punctuation alone still needs a spelling, and prefixing is preferable to
 * producing something the parser would reject.
 */
function memberSlug(name: string, prefix: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return /^[a-z]/.test(slug) ? slug : `${prefix}_${slug}`;
}

/**
 * Add a two-way entry, first spelling wins
 *
 * Two entities sharing a display spelling would make the display form ambiguous. Rather than
 * guess, only the first keeps the spelling; the other resolves to nothing and therefore stays in
 * its `[id]` form, which is unambiguous and visibly odd rather than silently wrong.
 */
function link(
  toId: Map<string, string>,
  toDisplay: Map<string, string>,
  display: string,
  id: string
): void {
  if (toId.has(display) || toDisplay.has(id)) return;
  toId.set(display, id);
  toDisplay.set(id, display);
}

/**
 * Build the reference index for a configuration
 *
 * @param config - The configuration whose current spellings the index reflects
 * @returns A derived lookup table — never persist it
 */
export function buildReferenceIndex(config: Configuration): ReferenceIndex {
  const toId = {} as Record<ReferenceSpace, Map<string, string>>;
  const toDisplay = {} as Record<ReferenceSpace, Map<string, string>>;
  for (const space of REFERENCE_SPACES) {
    toId[space] = new Map();
    toDisplay[space] = new Map();
  }

  // One flat space shared by stat abbreviations and the two skill code spaces — all three are
  // unique against each other (CLAUDE.md), which is what lets a bare spelling resolve without
  // knowing which collection it came from. Stats took over the main-skill half in TICKET-STAT-01.
  for (const stat of config.stats) {
    if (!stat.id) continue;
    link(toId.bare, toDisplay.bare, stat.abbreviation.toUpperCase(), stat.id);
  }

  // The flat space is **stat abbreviations and nothing else** as of TICKET-ROLL-06: a `Skill` left
  // it in SKL-02 (`skills.<slug>`), the combat codes went with the entity, and a roll was never in
  // it — nothing can name a roll.

  for (const skill of config.skills) {
    if (!skill.id) continue;
    link(toId.skills, toDisplay.skills, skillMemberName(skill), skill.id);
  }

  for (const stat of config.stats) {
    if (!stat.id) continue;
    link(toId.stats, toDisplay.stats, statMemberName(stat), stat.id);
  }

  for (const constant of config.constants ?? []) {
    if (!constant.id) continue;
    link(toId.const, toDisplay.const, constant.name, constant.id);
  }

  for (const curve of config.curves ?? []) {
    if (!curve.id) continue;
    link(toId.curve, toDisplay.curve, curve.name, curve.id);

    // Not `link`: the two directions use different spellings here. Writing the stored form needs
    // the curve-qualified key, because `main` alone does not say which curve's; writing the
    // display form needs the bare column name, because that is what goes back in the formula.
    for (const column of curve.columns) {
      if (!column.id) continue;

      const key = columnKey(curve.id, column.name);
      if (toId.curveColumn.has(key) || toDisplay.curveColumn.has(column.id)) continue;

      toId.curveColumn.set(key, column.id);
      toDisplay.curveColumn.set(column.id, column.name);
    }
  }

  return { toId, toDisplay };
}

/**
 * Resolve a reference *as written* to the id of the entity it names
 *
 * The other half of this module's job: `toStoredFormula` rewrites the text, this answers "which
 * entity is that?" for callers that want the entity rather than the rewrite — the dependency graph
 * is keyed by id, and a formula is written in display spellings.
 *
 * Namespace-aware on purpose (CR-01): `STR` and `stats.strength` land on the same stat, while
 * `const.strength` does not land on it at all. A member already in stored form resolves to itself,
 * so a formula that skipped the display translation still produces the same edges.
 *
 * @param index - Index built from the configuration the formula belongs to
 * @param namespace - The namespace segment as written, or undefined for a legacy bare code
 * @param member - The member segment, spelled as `validateFormula` reports it
 * @returns The referenced entity's id, or undefined when the ruleset has no such entity
 */
function resolveReferenceId(
  index: ReferenceIndex,
  namespace: string | undefined,
  member: string
): string | undefined {
  const space = namespace ?? 'bare';
  if (space !== 'bare' && !isReferenceSpace(space)) return undefined;

  // `toDisplay` is keyed by id, so a hit there means the member *is* one — the stored form
  return index.toId[space].get(member) ?? (index.toDisplay[space].has(member) ? member : undefined);
}

/**
 * Resolves a reference to the entity id it names — see {@link resolveReferenceId}
 */
export type ReferenceResolver = (
  namespace: string | undefined,
  member: string
) => string | undefined;

/**
 * A resolver bound to one configuration
 *
 * The index is built once and closed over, so resolving every reference in a ruleset does not
 * rebuild it per formula.
 *
 * @param config - The configuration whose current spellings the resolver reads
 * @returns A resolver over that configuration
 */
export function buildReferenceResolver(config: Configuration): ReferenceResolver {
  const index = buildReferenceIndex(config);
  return (namespace, member) => resolveReferenceId(index, namespace, member);
}

/** One token the scan decided is a reference, and the space it resolves in */
interface ReferenceSite {
  token: FormulaToken;
  space: ReferenceSpace;
  /**
   * The token this one is scoped to, for a space whose spellings are only locally unique.
   *
   * A curve column carries the curve token; nothing else has an owner, because nothing else
   * resolves relative to another entity.
   */
  owner?: FormulaToken;
}

/** What the scan found at one position, and where it resumes */
interface ScanStep {
  /** In source order — a dotted curve call contributes both its curve and its column */
  sites: ReferenceSite[];
  next: number;
}

/**
 * Find every token in a formula that names an entity
 *
 * @param tokens - The formula's tokens, ending with `EOF`
 * @returns The reference sites, in source order
 */
function findReferenceSites(tokens: readonly FormulaToken[]): ReferenceSite[] {
  const sites: ReferenceSite[] = [];

  let index = 0;
  while (index < tokens.length && tokens[index].type !== 'EOF') {
    const step = referenceAt(tokens, index);
    sites.push(...step.sites);
    index = step.next;
  }

  return sites;
}

/**
 * Classify the token at `index` against the parser's `ref` production
 *
 * An identifier followed by `(` is a function call, whose name belongs to the closed library
 * rather than to the ruleset; an identifier followed by `.` opens a dotted reference; anything
 * else identifier-shaped is a legacy bare code.
 */
function referenceAt(tokens: readonly FormulaToken[], index: number): ScanStep {
  const token = tokens[index];

  if (token.type !== 'IDENTIFIER' && token.type !== 'REF_ID') {
    return { sites: [], next: index + 1 };
  }

  if (token.type === 'IDENTIFIER' && tokens[index + 1]?.type === 'LPAREN') {
    return { sites: [], next: index + 1 };
  }

  if (token.type === 'IDENTIFIER' && tokens[index + 1]?.type === 'DOT') {
    return dottedReferenceAt(tokens, index);
  }

  return { sites: [{ token, space: 'bare' }], next: index + 1 };
}

/**
 * Classify a dotted reference whose namespace segment sits at `index`
 *
 * The member is always the reference — `curve.cr(x)` and `curve.point_buy.main_type(9)` both
 * name the curve there. A third segment is a property, and a property names an entity in exactly
 * one case: a curve's column, which the User named and can rename. Every other property
 * (`skills.stealth.level`) is a fixed field and stays as written.
 */
function dottedReferenceAt(tokens: readonly FormulaToken[], index: number): ScanStep {
  const namespace = tokens[index].value as string;
  const member = tokens[index + 2];
  const isMember = member?.type === 'IDENTIFIER' || member?.type === 'REF_ID';

  // Step over `namespace . member`, plus a property segment when one follows
  let next = index + (isMember ? 3 : 2);
  let property: FormulaToken | undefined;
  const propertyToken = tokens[next + 1];
  if (
    tokens[next]?.type === 'DOT' &&
    (propertyToken?.type === 'IDENTIFIER' || propertyToken?.type === 'REF_ID')
  ) {
    property = propertyToken;
    next += 2;
  }

  if (!isMember || !isReferenceSpace(namespace)) {
    return { sites: [], next };
  }

  const sites: ReferenceSite[] = [{ token: member, space: namespace }];
  if (namespace === 'curve' && property) {
    sites.push({ token: property, space: 'curveColumn', owner: member });
  }

  return { sites, next };
}

/** Whether a namespace has entities this index can resolve */
function isReferenceSpace(namespace: string): namespace is ReferenceSpace {
  return (
    namespace === 'skills' ||
    namespace === 'stats' ||
    namespace === 'const' ||
    namespace === 'curve'
  );
}

/**
 * Rewrite the reference tokens of a formula, leaving every other character untouched
 *
 * @param formula - Source text
 * @param rewrite - Called per reference site; returning null keeps the token as written
 * @returns The rewritten source, or the original when nothing resolved
 */
function rewriteReferences(
  formula: string,
  rewrite: (token: FormulaToken, space: ReferenceSpace, owner?: FormulaToken) => string | null
): string {
  let tokens: readonly FormulaToken[];
  try {
    tokens = tokenizeFormula(formula);
  } catch {
    // An unlexable formula has no references to find. It is kept verbatim so the User's text
    // survives a save and the validator can report the syntax error.
    return formula;
  }

  let result = '';
  let cursor = 0;

  for (const site of findReferenceSites(tokens)) {
    const replacement = rewrite(site.token, site.space, site.owner);
    if (replacement === null) continue;

    result += formula.slice(cursor, site.token.position) + replacement;
    cursor = site.token.end;
  }

  return result + formula.slice(cursor);
}

/**
 * Translate a formula from display form to the stored, id-resolved form
 *
 * @param formula - Display form, as the User wrote it
 * @param index - Index built from the configuration the formula belongs to
 * @returns The stored form; unresolvable references keep their display spelling
 */
export function toStoredFormula(formula: string, index: ReferenceIndex): string {
  return rewriteReferences(formula, (token, space, owner) => {
    // Already stored — a formula translated twice must not change
    if (token.type === 'REF_ID') return null;

    const spelling =
      space === 'bare'
        ? (token.value as string).toUpperCase()
        : space === 'curveColumn'
          ? curveColumnSpelling(token, owner, index)
          : String(token.value);
    if (spelling === undefined) return null;

    const id = index.toId[space].get(spelling);
    return id === undefined ? null : `[${id}]`;
  });
}

/**
 * The `toId.curveColumn` key for a column token, or nothing when its curve does not resolve
 *
 * A column is only identifiable through the curve that owns it: two curves may both have a
 * `main`. The owner token is whichever form it is in at this point in the formula — a display
 * name in text the User wrote, or an id in a formula already half-translated.
 */
function curveColumnSpelling(
  token: FormulaToken,
  owner: FormulaToken | undefined,
  index: ReferenceIndex
): string | undefined {
  if (!owner) return undefined;

  const curveId =
    owner.type === 'REF_ID' ? (owner.value as string) : index.toId.curve.get(String(owner.value));
  if (curveId === undefined) return undefined;

  return columnKey(curveId, String(token.value));
}

/**
 * Translate a formula from the stored, id-resolved form to display form
 *
 * @param formula - Stored form, as persisted
 * @param index - Index built from the configuration the formula belongs to
 * @returns The display form; ids with no entity keep their `[id]` spelling
 */
export function toDisplayFormula(formula: string, index: ReferenceIndex): string {
  return rewriteReferences(formula, (token, space) => {
    if (token.type !== 'REF_ID') return null;
    return index.toDisplay[space].get(token.value as string) ?? null;
  });
}

/**
 * Apply a formula translation across a whole configuration
 *
 * The index is built once from `config`, so both directions read the spellings that configuration
 * currently has. Reference-carrying fields are the **formula strings** and nothing else now: a
 * race's stat block (TICKET-RACE-01) and a material tier's modifiers (TICKET-MAT-01) are both
 * keyed by stat id, so their display and stored forms are the same thing and translating them
 * would only create a way for the two to disagree.
 */
function translateConfiguration(
  config: Configuration,
  translateFormula: (formula: string, index: ReferenceIndex) => string
): Configuration {
  const index = buildReferenceIndex(config);

  return {
    ...config,
    // A stat without a formula is invested rather than derived — there is nothing to translate,
    // and writing `formula: undefined` would put the key back on the way through JSON
    stats: config.stats.map((stat) =>
      stat.formula === undefined
        ? stat
        : { ...stat, formula: translateFormula(stat.formula, index) }
    ),
    // A curve column's generator is a persisted formula too (TICKET-CRV-02), so renaming a
    // constant re-spells it like every other. `key` survives untouched — it is not an entity, so
    // the index has nothing to resolve it to.
    ...(config.curves
      ? {
          curves: config.curves.map((curve) => ({
            ...curve,
            columns: curve.columns.map((column) =>
              column.generator === undefined
                ? column
                : { ...column, generator: translateFormula(column.generator, index) }
            ),
          })),
        }
      : {}),
    // A roll's input is user-authored formula text like any other (TICKET-ROLL-05), so renaming a
    // stat re-spells every roll reading it. Absent stays absent, as everywhere else.
    ...(config.rollDefinitions
      ? {
          rollDefinitions: config.rollDefinitions.map((roll) => ({
            ...roll,
            input: translateFormula(roll.input, index),
          })),
        }
      : {}),
    /*
     * A spell's effect is **prose with formulas in it** (TICKET-SPL-03), and the formulas inside it
     * are references like any other — so renaming Wisdom re-spells all 326 effects that read it,
     * exactly as it re-spells every stat formula and every roll input.
     *
     * `mapTemplateFormulas` is what keeps this line one line: it walks the placeholders and leaves
     * the prose byte-identical, so this module never learns the template grammar and `template.ts`
     * never learns about ids. Translating the whole string instead would tokenize the prose — a
     * spell effect saying *"gains STR"* would have the word rewritten into a uuid.
     */
    ...(config.spells
      ? {
          spells: config.spells.map((spell) => ({
            ...spell,
            effectTemplate: mapTemplateFormulas(spell.effectTemplate, (source) =>
              translateFormula(source, index)
            ),
          })),
        }
      : {}),
    /*
     * A passive's effect is the same prose-with-formulas at the same attachment point
     * (TICKET-PAS-01), so it translates the same way and for the same reason: renaming a skill
     * re-spells Blindsight's `perception level × 10`, and the word "feet" beside it is left exactly
     * as written because `mapTemplateFormulas` never sees the prose.
     */
    ...(config.passives
      ? {
          passives: config.passives.map((passive) => ({
            ...passive,
            effectText: mapTemplateFormulas(passive.effectText, (source) =>
              translateFormula(source, index)
            ),
          })),
        }
      : {}),
  };
}

/**
 * Resolve every reference in a configuration to ids — the form that persists
 *
 * @param config - Configuration in display form
 * @returns The same configuration with id-resolved references
 */
export function toStoredConfiguration(config: Configuration): Configuration {
  return translateConfiguration(config, toStoredFormula);
}

/**
 * Spell every reference in a configuration the way the ruleset currently spells it
 *
 * @param config - Configuration in stored form
 * @returns The same configuration in display form
 */
export function toDisplayConfiguration(config: Configuration): Configuration {
  return translateConfiguration(config, toDisplayFormula);
}

/**
 * Give every referenceable entity an id, minting one where it is missing
 *
 * **Leniency about an *authored* document, not compatibility with an old one** (reviewed at
 * TICKET-DX-09). It was written for configurations predating ids, and that job ended with
 * TICKET-IO-03: pre-v2 data is now rejected outright by the version gate, so a stored file reaching
 * here has already proved it is on the current shape. What keeps the function is the **import**
 * surface — a hand-written or tool-generated ruleset may legitimately omit `id`, which is why
 * `ENTITY_SPECS` does not require one — and completing it beats refusing a file whose only fault is
 * that a human did not invent UUIDs.
 *
 * It branches on no retired key and reads no superseded shape, which is why v4.0's clean break
 * ([D6](../../../../docs/v4.0_sheet_parity/overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29))
 * leaves it standing where it deleted the wallet adapter.
 *
 * `newId` is a parameter rather than a direct `crypto.randomUUID()` so this stays a pure function
 * like the rest of the engine; the services that call it supply the generator.
 *
 * @param config - Configuration that may be missing ids
 * @param newId - Mints an id for a skill that has none
 * @returns A configuration where every skill has one
 */
export function ensureReferenceIds(config: Configuration, newId: () => string): Configuration {
  const withId = <T extends { id?: string }>(entity: T): T =>
    entity.id ? entity : { ...entity, id: newId() };

  return {
    ...config,
    stats: config.stats.map(withId),
    skills: config.skills.map(withId),
    // Absent stays absent — a ruleset that names no shared numbers round-trips unchanged rather
    // than growing an empty array on the way through.
    ...(config.constants ? { constants: config.constants.map(withId) } : {}),
    ...(config.curves
      ? {
          curves: config.curves.map((curve) => ({
            ...withId(curve),
            columns: curve.columns.map(withId),
          })),
        }
      : {}),
  };
}
