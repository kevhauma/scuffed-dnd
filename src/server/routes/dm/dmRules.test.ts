/**
 * No DM-control route decides anything for itself (TICKET-DM-01, v3 Req 45.1)
 *
 * [`playerRules.test.ts`](../play/playerRules.test.ts) one folder over, and for the same reason it
 * gives: dependency-cruiser can say a module *may* import something, and what matters here is where
 * a rule *comes from*. A route that re-derived an XP threshold or re-priced a point budget would
 * import perfectly legal modules and break D5 in complete silence — and this ticket is the one where
 * that temptation is real, because *"level 7 costs 450"* looks like arithmetic.
 *
 * Three claims about every module in this folder that answers a request:
 *
 * 1. **It takes its rule from the Kernel** — `dmActions.ts` for the four adjustments DM-01 invents,
 *    and `playerActions.ts` for the ones it deliberately does not: a DM setting a pool obeys the
 *    Player's own rule, unchanged (v3 Req 42.5). **TICKET-DM-02's six all fall on that second side**,
 *    which is this check earning its keep rather than a coincidence: the purse and the four
 *    inventory acts each run a `playerActions.ts` function, so a future route that quietly re-derived
 *    *what fits in a boot slot* would be caught here even though every import it made was legal.
 * 2. **It reaches nothing in `#shared/engine/` directly.** That is where a second implementation
 *    starts. `listAdjustments` is exempt because it writes nothing and runs no rule — it projects
 *    the Event log — and it imports no engine module either, which the scan checks rather than
 *    assumes.
 * 3. **Every write is behind `requireCharacterDM`.** `routeGuards.test.ts` proves a guard is
 *    *called*; this proves it is the right one, which that scan cannot — `requireCharacterWriter`
 *    would satisfy it and would hand the DM's controls to every Player at the table.
 *
 * The count is asserted too, so the file cannot go green by finding nothing.
 *
 * **Validates: v3 Req 42.5, 42.7, 45.1, 51.10**
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DM_ACTION } from '#shared/types/api';

const DM_ROUTES = resolve(dirname(fileURLToPath(import.meta.url)));

/** How a module announces that it answers requests */
const HANDLER_MARKER = 'defineHandler(';

/** How a module announces that it performs an adjustment rather than reading one */
const WRITE_MARKER = 'applyPlayerAction(';

/** Where a DM adjustment's rules live, and the only two places a route here may take one from */
const KERNEL_RULES = ['#shared/services/dmActions', '#shared/services/playerActions'];

/** Every module in this folder that answers a request */
function routeModules(): { name: string; source: string }[] {
  return readdirSync(DM_ROUTES)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({ name, source: readFileSync(join(DM_ROUTES, name), 'utf8') }))
    .filter(({ source }) => source.includes(HANDLER_MARKER));
}

/** The subset of those that change a character */
function writeModules(): { name: string; source: string }[] {
  return routeModules().filter(({ source }) => source.includes(WRITE_MARKER));
}

describe('the DM-control routes', () => {
  it('has one write module per named adjustment, so this is not passing by looking at nothing', () => {
    // One writer per named action — an action without a route, or a route without an action, is a
    // difference this names rather than a gap somebody notices later. Fifteen since TICKET-DM-03
    // added `dm-adjust-resource`, the delta counterpart a quick action needed.
    expect(writeModules()).toHaveLength(Object.values(DM_ACTION).length);
  });

  it('takes every rule from the Kernel rather than deciding one', () => {
    const offenders = writeModules()
      .filter(({ source }) => !KERNEL_RULES.some((module) => source.includes(module)))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it('reaches no engine module directly, where a second implementation would start', () => {
    const offenders = routeModules()
      .filter(({ source }) => source.includes("from '#shared/engine/"))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it('puts every write behind the DM guard rather than the writer guard a Player also passes', () => {
    const offenders = writeModules()
      .filter(({ source }) => !source.includes('requireCharacterDM('))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });
});
