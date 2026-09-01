/**
 * The quick-action path knows no resource by name (TICKET-DM-03, v1.0 Req 20, v3 Req 49.2)
 *
 * The second acceptance criterion said as code: *a grep of `src/` finds no "health", "hp", "mana" or
 * equivalent as a stat identifier or label anywhere in the quick-action path*.
 *
 * **This app has no notion of any particular pool.** A pool is whatever the User flagged `isResource`
 * (TICKET-STAT-01), and the whole of TICKET-DM-03 is the claim that the DM's cockpit is derived from
 * that flag rather than written against a system somebody had in mind. A hard-coded *Heal* button
 * would work for one ruleset and quietly misdescribe every other, which is the precise failure v1.0
 * Req 20 exists to prevent.
 *
 * ## The patterns are substrings, and the first version's were not
 *
 * The DM-03 review measured what the original `/\bhealth\b/i` shape actually caught: **`_` is a word
 * character and so is every letter around a camelCase hump**, so `const HEALTH_ID`, `stat_health`,
 * `maxHealth`, `healthPool`, `manaCost` and `MANA_STAT` all sailed past — only prose and kebab-case
 * were caught, which is why it went red on a docblock and would have missed
 * `const HEALTH_STAT_ID = …`. The docblock's claim was stronger than the code. They are bare
 * case-insensitive substrings now. **False positives cost nothing here**: the scanned surface is five
 * small regions that have already committed to talking around the words, and this is
 * `referenceArms.test.ts`'s own written-down lesson — *a test that greps source is coupled to the
 * source's punctuation*, so grep for less punctuation.
 *
 * `hp` is the one exception and keeps both boundaries: as a bare substring it fires on `graphpaper`
 * and `php`, which is a different kind of wrong.
 *
 * ## Comments count, and that is deliberate
 *
 * The scan does not exempt docblocks. A comment naming a resource is how the concept creeps back —
 * somebody reads *"take 7 off their health"* beside a derivation and writes the special case it seems
 * to invite. The user story is allowed to say it; the modules that implement it are not, and
 * `quickActions.ts`'s docblock says so where a reader would otherwise wonder why it talks around the
 * word.
 *
 * ## Why a scan and not a review
 *
 * Because the failure this guards against is a *future* one. Every region below passes today by
 * construction; the point is that the fourth pool somebody's ruleset defines cannot be special-cased
 * without this going red. The region list is asserted too, so the check cannot pass by scanning
 * nothing.
 *
 * **Validates: v3 Req 49.2; Requirements 20.1-20.5**
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MODULE_URL = fileURLToPath(import.meta.url);
const HERE = dirname(MODULE_URL);

/** The sheet hook, which holds the derivation but is far too big to scan whole — see {@link REGIONS} */
const SHEET_HOOK = '../sheet/useCharacterSheet.ts';

/**
 * Where the sheet hook's quick-action derivation starts and stops
 *
 * The DM-03 review's third finding: the original list was the four rendering and binding modules and
 * left out `toQuickActions`, **which is exactly where a future `stats.filter(s => s.name !== 'Health')`
 * would get written.** Scanning the whole hook is not the answer — its own header reads *"Character
 * Sheet **Mana**ger Hook"*, so a substring pass over it is a false positive on line 2 — so the region
 * between these two anchors is scanned instead, which is every helper that decides what a pool is.
 *
 * A missing anchor **fails loudly** rather than silently scanning nothing: if either moves, the check
 * is asking to be re-aimed, not to be skipped.
 */
const DERIVATION_START = 'function experienceStepFor(';
const DERIVATION_END = 'export function useCharacterSheet(';

/** One thing scanned, and what to call it when it fails */
interface Region {
  label: string;
  read: () => string;
}

/** One module's source, by its path relative to this file */
function sourceOf(relative: string): string {
  const path = resolve(HERE, relative);

  return readFileSync(path, 'utf8');
}

/** The slice of the sheet hook that decides what the pools are */
function derivationRegion(): string {
  const source = sourceOf(SHEET_HOOK);
  const start = source.indexOf(DERIVATION_START);
  const end = source.indexOf(DERIVATION_END);

  if (start < 0 || end < 0 || end <= start) {
    throw new Error(
      `${SHEET_HOOK} no longer holds the quick-action derivation between "${DERIVATION_START}" and "${DERIVATION_END}" — re-aim this scan at wherever it moved`
    );
  }

  return source.slice(start, end);
}

/** A whole module, scanned end to end */
function wholeModule(relative: string): Region {
  return { label: relative, read: () => sourceOf(relative) };
}

/**
 * Every region a quick action's vocabulary can come from, from the derivation to the button
 *
 * Listed rather than globbed, because what is being asserted is a property of *this path* — a glob
 * over the folder would quietly start covering `AdjustmentLog` and quietly stop covering the
 * derivation the day either moved.
 */
const REGIONS: Region[] = [
  wholeModule('../shared/quickActions.ts'),
  wholeModule('./useQuickActions.ts'),
  wholeModule('./QuickActionsSidebar.tsx'),
  wholeModule('./QuickActionRow.tsx'),
  { label: `${SHEET_HOOK} (the derivation)`, read: derivationRegion },
];

/**
 * The words a ruleset supplies and this codebase may not
 *
 * Req 49.2's own three, plus the two spellings of the same idea it names as "or equivalent". Bare
 * substrings — see the module note — except `hp`, which keeps both boundaries.
 */
const FORBIDDEN = [/health/i, /\bhp\b/i, /mana/i, /hit[ _-]?points?/i, /stamina/i];

describe('the quick-action path', () => {
  it('should be the five regions this checks, so it cannot pass by scanning nothing', () => {
    const readable = REGIONS.filter((region) => {
      const source = region.read();

      return source.length > 0;
    });

    expect(readable).toHaveLength(5);
  });

  it('should name no resource, in code or in a comment', () => {
    const offenders = REGIONS.flatMap((region) => {
      const source = region.read();
      const hits = FORBIDDEN.filter((pattern) => pattern.test(source));

      return hits.map((pattern) => `${region.label}: ${pattern.source}`);
    });

    expect(offenders).toEqual([]);
  });

  it('should catch a resource named in any of the forms a stat id is actually written in', () => {
    /*
     * The review's finding, kept as a case so the patterns cannot quietly regress to word-boundaried
     * ones again. Every string below passed the original `\b…\b` shape; each must now be caught.
     */
    const disguises = [
      "const HEALTH_ID = 'stat-health';",
      "character.currentResourceValues['stat_health']",
      'const maxHealth = pool.max;',
      'const healthPool = pools[0];',
      'const manaCost = spell.cost;',
      'const MANA_STAT = stats[1];',
      'if (stat.name === "Health") return;',
      'const hp = pool.current;',
    ];

    const missed = disguises.filter((line) => {
      const caught = FORBIDDEN.some((pattern) => pattern.test(line));

      return !caught;
    });

    expect(missed).toEqual([]);
  });

  it('should take every label it renders from the caller rather than from a list of its own', () => {
    // The positive half of the same claim: the derivation's only English is its six verbs, and a
    // resource's name reaches it as data. A `const POOLS = [...]` here would pass the scan above.
    // Regular expressions rather than string literals so the placeholder is not itself one — the
    // lint rule that would otherwise fire is right in general and beside the point here
    const derivation = sourceOf('../shared/quickActions.ts');
    const damageLabel = /`Damage \$\{pool\.name\}`/;
    const restoreLabel = /`Restore \$\{pool\.name\}`/;

    const namesTheDamage = damageLabel.test(derivation);
    const namesTheRestore = restoreLabel.test(derivation);

    expect(namesTheDamage).toBe(true);
    expect(namesTheRestore).toBe(true);
  });
});
