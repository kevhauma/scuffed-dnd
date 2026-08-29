/**
 * No player-action route decides anything for itself (TICKET-PLY-01, v3 Req 45.1)
 *
 * **The criterion asks for this to be checked by imports rather than by reading the code**, and the
 * reason is the same one `pinnedSnapshot.test.ts` gives about the Snapshot: dependency-cruiser can
 * say a module *may* import something, and what matters here is where a rule *comes from*. A route
 * that re-derived a point budget or re-compared a slot type would import perfectly legal modules and
 * break the milestone's central promise (D5) in complete silence.
 *
 * So the scan is two claims about every module in this folder that answers a request:
 *
 * 1. **It gets its rule from [`playerActions.ts`](../../../shared/services/playerActions.ts)** — the
 *    Kernel module `characterStore` also calls, which is what makes *one rule, two callers* a fact
 *    rather than an intention.
 * 2. **It reaches nothing in `#shared/engine/` directly.** That is where a second implementation
 *    starts: `validateStatAllocation` and `calculateCharacter` are perfectly good imports for a route
 *    that wants to *re-check* something, and a route that wants to re-check something is a route
 *    with an opinion of its own.
 *
 * The count is asserted too, so the file cannot go green by finding nothing — the failure mode
 * TICKET-ROLL-03 named and this milestone has hit twice.
 *
 * **Validates: v3 Req 45.1, 51.10**
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLAYER_ACTION } from '#shared/types/api';

const PLAY_ROUTES = resolve(dirname(fileURLToPath(import.meta.url)));

/** How a module announces that it answers requests */
const HANDLER_MARKER = 'defineHandler(';

/** Where a player action's rules live, and the only place a route here may take one from */
const KERNEL_RULES = '#shared/services/playerActions';

/** Every module in this folder that answers a request */
function routeModules(): { name: string; source: string }[] {
  return readdirSync(PLAY_ROUTES)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({ name, source: readFileSync(join(PLAY_ROUTES, name), 'utf8') }))
    .filter(({ source }) => source.includes(HANDLER_MARKER));
}

describe('the player-action routes', () => {
  it('has one route module per named intent, so this is not passing by looking at nothing', () => {
    // One module per action, counted rather than written down — which is why TICKET-INV-06 retiring
    // two actions and renaming a third needed no edit here at all. An action without a route, or a
    // route without an action, is a difference this names rather than a gap somebody notices later
    expect(routeModules()).toHaveLength(Object.values(PLAYER_ACTION).length);
  });

  it('takes every rule from the Kernel rather than deciding one', () => {
    const offenders = routeModules()
      .filter(({ source }) => !source.includes(KERNEL_RULES))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it('reaches nothing in the engine directly, which is where a second implementation starts', () => {
    const offenders = routeModules()
      .filter(({ source }) => source.includes('#shared/engine/'))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it('registers each action at the path its own name spells', () => {
    // The route table, the Event's `type` and the client's call are one string (`PLAYER_ACTION`),
    // and this is what holds them to it: a route registered at a path that is not its action's name
    // would answer requests nobody makes and log events nobody asked for
    const router = readFileSync(join(PLAY_ROUTES, '..', '..', 'http', 'apiRouter.ts'), 'utf8');

    const missing = Object.values(PLAYER_ACTION).filter(
      (action) => !router.includes(`'POST /api/characters/:id/${action}'`)
    );

    expect(missing).toEqual([]);
  });
});
