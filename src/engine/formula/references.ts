/**
 * Formula References
 *
 * Translation between the two forms every user-authored formula has (Concept 00 §6):
 *
 * - the **display form**, which is what the User reads and writes — `STR + DEX`, `stats.speed`,
 *   `skills.STL.level`;
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

import type { Configuration, MainSkill, Stat } from '../../types/config';
import type { FormulaToken } from './parser';
import { tokenizeFormula } from './parser';

/**
 * The reference spaces a token can be resolved in
 *
 * `bare` is the legacy flat code space shared by main, speciality and combat skills; the other
 * two are the namespaces whose members are configured entities. `const` and `curve` have no
 * entities yet (TICKET-CST-01, TICKET-CRV-01), so a reference into them stays verbatim.
 */
type ReferenceSpace = 'bare' | 'skills' | 'stats';

const REFERENCE_SPACES: readonly ReferenceSpace[] = ['bare', 'skills', 'stats'];

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
  const slug = stat.name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  // Identifiers must start with a letter; a name of digits or punctuation alone still needs a
  // spelling, and prefixing is preferable to producing something the parser would reject.
  return /^[a-z]/.test(slug) ? slug : `stat_${slug}`;
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

  // One flat space for every skill kind — codes are unique across all three (CLAUDE.md), which
  // is what lets a bare code resolve without knowing which collection it came from.
  for (const skill of [...config.mainSkills, ...config.specialitySkills, ...config.combatSkills]) {
    if (!skill.id) continue;
    link(toId.bare, toDisplay.bare, skill.code.toUpperCase(), skill.id);
  }

  for (const skill of config.specialitySkills) {
    if (!skill.id) continue;
    link(toId.skills, toDisplay.skills, skill.code.toUpperCase(), skill.id);
  }

  for (const stat of config.stats) {
    if (!stat.id) continue;
    link(toId.stats, toDisplay.stats, statMemberName(stat), stat.id);
  }

  return { toId, toDisplay };
}

/** One token the scan decided is a reference, and the space it resolves in */
interface ReferenceSite {
  token: FormulaToken;
  space: ReferenceSpace;
}

/** What the scan found at one position, and where it resumes */
interface ScanStep {
  site?: ReferenceSite;
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
    if (step.site) sites.push(step.site);
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
    return { next: index + 1 };
  }

  if (token.type === 'IDENTIFIER' && tokens[index + 1]?.type === 'LPAREN') {
    return { next: index + 1 };
  }

  if (token.type === 'IDENTIFIER' && tokens[index + 1]?.type === 'DOT') {
    return dottedReferenceAt(tokens, index);
  }

  return { site: { token, space: 'bare' }, next: index + 1 };
}

/**
 * Classify a dotted reference whose namespace segment sits at `index`
 *
 * The member is the reference; a third segment is a property and never one. A namespaced call
 * (`curve.cr(x)`) names a curve rather than an entity this index knows, so it yields no site
 * while still stepping past its member.
 */
function dottedReferenceAt(tokens: readonly FormulaToken[], index: number): ScanStep {
  const namespace = tokens[index].value as string;
  const member = tokens[index + 2];
  const isMember = member?.type === 'IDENTIFIER' || member?.type === 'REF_ID';
  const isCall = tokens[index + 3]?.type === 'LPAREN';

  // Step over `namespace . member`, plus a property segment when one follows
  let next = index + (isMember ? 3 : 2);
  if (tokens[next]?.type === 'DOT' && tokens[next + 1]?.type === 'IDENTIFIER') {
    next += 2;
  }

  if (!isMember || isCall || !isReferenceSpace(namespace)) {
    return { next };
  }

  return { site: { token: member, space: namespace }, next };
}

/** Whether a namespace has entities this index can resolve */
function isReferenceSpace(namespace: string): namespace is ReferenceSpace {
  return namespace === 'skills' || namespace === 'stats';
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
  rewrite: (token: FormulaToken, space: ReferenceSpace) => string | null
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
    const replacement = rewrite(site.token, site.space);
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
  return rewriteReferences(formula, (token, space) => {
    // Already stored — a formula translated twice must not change
    if (token.type === 'REF_ID') return null;

    const spelling = space === 'bare' ? (token.value as string).toUpperCase() : String(token.value);
    const id = index.toId[space].get(spelling);
    return id === undefined ? null : `[${id}]`;
  });
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
 * currently has. Reference-carrying fields are the three formula strings plus the `skillCode` of
 * every race and material modifier, which point at a skill by the same flat code a formula uses.
 */
function translateConfiguration(
  config: Configuration,
  translateFormula: (formula: string, index: ReferenceIndex) => string,
  translateCode: (code: string, index: ReferenceIndex) => string
): Configuration {
  const index = buildReferenceIndex(config);

  return {
    ...config,
    stats: config.stats.map((stat) => ({
      ...stat,
      formula: translateFormula(stat.formula, index),
    })),
    specialitySkills: config.specialitySkills.map((skill) => ({
      ...skill,
      bonusFormula: translateFormula(skill.bonusFormula, index),
    })),
    combatSkills: config.combatSkills.map((skill) => ({
      ...skill,
      bonusFormula: translateFormula(skill.bonusFormula, index),
    })),
    races: config.races.map((race) => ({
      ...race,
      skillModifiers: race.skillModifiers.map((modifier) => ({
        ...modifier,
        skillCode: translateCode(modifier.skillCode, index),
      })),
    })),
    materials: config.materials.map((material) => ({
      ...material,
      levels: material.levels.map((level) => ({
        ...level,
        bonuses: level.bonuses.map((bonus) => ({
          ...bonus,
          skillCode: translateCode(bonus.skillCode, index),
        })),
      })),
    })),
  };
}

/** A `skillCode` field written as an id, so a rename cannot orphan a racial or material bonus */
function codeToStored(code: string, index: ReferenceIndex): string {
  if (code.startsWith('[')) return code;
  const id = index.toId.bare.get(code.toUpperCase());
  return id === undefined ? code : `[${id}]`;
}

/** The display spelling of a `skillCode` field written as an id */
function codeToDisplay(code: string, index: ReferenceIndex): string {
  if (!code.startsWith('[') || !code.endsWith(']')) return code;
  return index.toDisplay.bare.get(code.slice(1, -1)) ?? code;
}

/**
 * Resolve every reference in a configuration to ids — the form that persists
 *
 * @param config - Configuration in display form
 * @returns The same configuration with id-resolved references
 */
export function toStoredConfiguration(config: Configuration): Configuration {
  return translateConfiguration(config, toStoredFormula, codeToStored);
}

/**
 * Spell every reference in a configuration the way the ruleset currently spells it
 *
 * @param config - Configuration in stored form
 * @returns The same configuration in display form
 */
export function toDisplayConfiguration(config: Configuration): Configuration {
  return translateConfiguration(config, toDisplayFormula, codeToDisplay);
}

/**
 * Give every referenceable entity an id, minting one where it is missing
 *
 * Configurations written before ids existed identify skills by code alone. Rather than refuse
 * them, they are completed on the way in — the codes they store still resolve, because a stored
 * form only contains ids for entities that had one when it was written. TICKET-IO-03 replaces
 * this with an outright rejection of pre-v2 data.
 *
 * `newId` is a parameter rather than a direct `crypto.randomUUID()` so this stays a pure function
 * like the rest of the engine; the services that call it supply the generator.
 *
 * @param config - Configuration that may be missing ids
 * @param newId - Mints an id for a skill that has none
 * @returns A configuration where every skill has one
 */
export function ensureReferenceIds(config: Configuration, newId: () => string): Configuration {
  const withId = <T extends Pick<MainSkill, 'id'>>(entity: T): T =>
    entity.id ? entity : { ...entity, id: newId() };

  return {
    ...config,
    mainSkills: config.mainSkills.map(withId),
    specialitySkills: config.specialitySkills.map(withId),
    combatSkills: config.combatSkills.map(withId),
  };
}
