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
 *
 * ## The sheet hook is no longer one of them, and that is an improvement
 *
 * DM-03 scanned a **slice** of `useCharacterSheet.ts` between two anchors, because the derivation
 * lived there and the file could not be scanned whole — its own header read *"Character Sheet
 * **Mana**ger Hook"*, a false positive on line 2. TICKET-DM-04 moved that derivation out to
 * `characterQuickActions.ts` so both placements could share it, which retires the anchors and their
 * fragility along with them: the module *is* the derivation now, and it is scanned end to end. This
 * check went red on the move rather than silently scanning a slice that had stopped existing, which
 * is exactly what the loud-failure anchor was for.
 *
 * ## …and the roster added four
 *
 * The second placement (v3 Req 49.7) is a second path from a pool to a button, and every module on it
 * has the same obligation. `rosterView.ts` is where the roster decides what a pool *is* — the
 * `stats.filter(s => s.name !== 'Health')` this whole check exists to catch would be written there or
 * in `characterQuickActions.ts` and nowhere else.
 */
const REGIONS: Region[] = [
  wholeModule('../shared/quickActions.ts'),
  wholeModule('../shared/characterQuickActions.ts'),
  wholeModule('./useQuickActions.ts'),
  wholeModule('./QuickActionsSidebar.tsx'),
  wholeModule('./QuickActionOutcome.tsx'),
  wholeModule('./QuickActionRow.tsx'),
  wholeModule('../../sessions/roster/rosterView.ts'),
  wholeModule('../../sessions/roster/CharacterRosterRow.tsx'),
  wholeModule('../../sessions/roster/RosterQuickActions.tsx'),
];

/**
 * The words a ruleset supplies and this codebase may not
 *
 * Req 49.2's own three, plus the two spellings of the same idea it names as "or equivalent". Bare
 * substrings — see the module note — except `hp`, which keeps both boundaries.
 */
const FORBIDDEN = [/health/i, /\bhp\b/i, /mana/i, /hit[ _-]?points?/i, /stamina/i];

describe('the quick-action path', () => {
  it('should be the nine modules this checks, so it cannot pass by scanning nothing', () => {
    const readable = REGIONS.filter((region) => {
      const source = region.read();

      return source.length > 0;
    });

    expect(readable).toHaveLength(9);
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
