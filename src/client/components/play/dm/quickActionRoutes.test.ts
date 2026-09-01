/**
 * Every quick action is a shortcut to a route that already exists (TICKET-DM-03, v3 Req 49.3)
 *
 * The third acceptance criterion said as code rather than as prose: *a test enumerates the requests a
 * sidebar can produce and asserts each maps to an existing route*. The enumeration is
 * `useQuickActions`' own `requests`, taken off the same table its sends come from, so a kind cannot
 * be rebound to a different intent without this reading the new one.
 *
 * ## Why `apiRouter.ts` is read as text
 *
 * Because importing it would put a `#server/…` module in a `client/` test's graph, and the three-root
 * boundary (TICKET-DX-07) is exactly the rule that forbids it. `dmRules.test.ts` and
 * `routeGuards.test.ts` scan source for the same reason one folder over: what is being asserted is a
 * fact about a **call site**, and dependency-cruiser can only see imports.
 *
 * ## What "and no other" means here
 *
 * Two claims, not one. Every request the sidebar can produce is a member of `DM_ACTION` — so a quick
 * action cannot reach a *player* route, which the server would refuse for a DM anyway (v3 Req 49.10's
 * second half) — and every one of them is a path `apiRouter` already answers. **The route
 * `dm-adjust-resource` is the one TICKET-DM-03 added**, and it is here on the same footing as the
 * other five: see
 * [`dmAdjustResource.ts`](../../../../server/routes/dm/dmAdjustResource.ts) for why a second caller of
 * `adjustResourceValue` is not the private mechanism Req 49.3 forbids.
 *
 * **Validates: v3 Req 49.3, 49.10**
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import type { DmAction } from '#shared/types/api';
import { DM_ACTION } from '#shared/types/api';
import { useCharacterStore } from '../../../stores/characterStore';
import { useAuth } from '../../auth/useAuth';
import type { QuickActionKind } from '../shared/quickActions';
import { QUICK_ACTION_KIND } from '../shared/quickActions';
import type { AdjustmentVocabulary } from './adjustmentVocabulary';
import { useQuickActions } from './useQuickActions';

const MODULE_URL = fileURLToPath(import.meta.url);
const HERE = dirname(MODULE_URL);

/** The router's own table, read rather than imported — see the module note */
const ROUTER_PATH = resolve(HERE, '../../../../server/http/apiRouter.ts');
const ROUTER = readFileSync(ROUTER_PATH, 'utf8');

const WORDS: AdjustmentVocabulary = { names: {}, money: (amount: number) => `${amount}` };

/** The requests the sidebar can produce, read off the hook the sidebar uses */
function requestsFromSidebar(): Record<QuickActionKind, DmAction> {
  vi.mocked(useAuth).mockReturnValue({
    accountId: 'account-dm',
    isPending: false,
  } as unknown as ReturnType<typeof useAuth>);

  useCharacterStore.setState({
    tableCharacter: { id: 'char1', name: 'Aria' } as never,
    tableCharacterOwnerId: 'account-player',
  });

  const { result } = renderHook(() => useQuickActions('char1', [], WORDS, 0));

  if (!result.current) throw new Error('the DM was not given the quick actions');

  return result.current.requests;
}

describe('the quick actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCharacterStore.setState({
      characters: [],
      tableCharacter: null,
      tableCharacterOwnerId: null,
      isActing: false,
      actionError: null,
    });
  });

  it('should name a request for every kind of action, so this is not passing by finding nothing', () => {
    const requests = requestsFromSidebar();
    const kinds = Object.values(QUICK_ACTION_KIND);
    const named = Object.keys(requests);

    expect(named.sort()).toEqual(kinds.sort());
  });

  it('should reach only the DM’s own named intents, never a player route', () => {
    // A quick action reaching `adjust-resource` rather than `dm-adjust-resource` would meet the 404
    // `requireCharacterPlayer` gives a DM — a control that looks like it works and never does
    const requests = requestsFromSidebar();
    const dmActions = Object.values(DM_ACTION);
    const sent = Object.values(requests);
    const strangers = sent.filter((request) => !dmActions.includes(request));

    expect(strangers).toEqual([]);
  });

  it('should map every request to a route the server already answers', () => {
    // v3 Req 49.3 said as code. A request with no route is a button that 404s, and the whole value of
    // a quick action is that the control behind it already refuses properly
    const requests = requestsFromSidebar();
    const sent = Object.values(requests);
    const unrouted = sent.filter((request) => {
      const path = `'POST /api/characters/:id/${request}':`;

      return !ROUTER.includes(path);
    });

    expect(unrouted).toEqual([]);
  });

  it('should reach the DM’s resource delta rather than the DM’s resource total', () => {
    // The pair the DM was missing until this ticket, and the reason it was added: *take 7 off them*
    // applied to what is stored, not to what a surface was showing (v3 Req 49.4)
    const requests = requestsFromSidebar();

    expect(requests[QUICK_ACTION_KIND.DAMAGE]).toBe(DM_ACTION.ADJUST_RESOURCE);
    expect(requests[QUICK_ACTION_KIND.RESTORE]).toBe(DM_ACTION.ADJUST_RESOURCE);
  });
});
