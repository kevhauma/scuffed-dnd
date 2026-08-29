/**
 * Reading a sheet's adjustment history, and the two ways it can go wrong (TICKET-DM-01)
 *
 * The hook's own docblock explains the staleness guard; this is what proves it works. Both cases are
 * ordering, and neither is reachable from a component test — they need two requests in flight at
 * once, resolved in the wrong order on purpose.
 *
 * **The out-of-order case is the one that matters.** Every adjustment triggers a re-read, so the
 * *pre*-adjustment list is always in flight when the *post*-adjustment one is asked for. Landing the
 * older answer last would leave the log one entry short of the number it sits beside — which reads
 * as the adjustment not having happened.
 *
 * **Validates: v3 Req 42.6, 42.7**
 */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchCharacterAdjustments = vi.fn();
vi.mock('../../../services/characterSync', () => ({
  fetchCharacterAdjustments: (characterId: string) => fetchCharacterAdjustments(characterId),
}));

import type { CharacterAdjustment } from '#shared/types/api';
import { DM_ACTION } from '#shared/types/api';
import type { Character } from '#shared/types/character';
import { useCharacterAdjustments } from './useCharacterAdjustments';

/**
 * A sheet whose `updatedAt` the case controls
 *
 * That field is the version the hook keys on — it moves on every accepted write from either actor,
 * which is what makes an adjustment show up under the number it moved.
 */
function aCharacter(updatedAt: string): Character {
  return {
    id: 'character-1',
    name: 'Quackers',
    configurationId: 'config-1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt,
  };
}

/** One adjustment, distinguishable by its id */
function adjustment(id: string): CharacterAdjustment {
  return {
    id,
    seq: 1,
    action: DM_ACTION.AWARD_EXPERIENCE,
    target: '',
    before: 0,
    after: 10,
    at: Date.parse('2026-08-27T12:00:00.000Z'),
    by: 'The DM',
  };
}

/** A promise this test decides when to settle */
function deferred(): { promise: Promise<unknown>; resolve: (value: unknown) => void } {
  let resolve: (value: unknown) => void = () => {};
  const promise = new Promise((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCharacterAdjustments', () => {
  it('should read nothing at all when there is no sheet to read one for', () => {
    renderHook(() => useCharacterAdjustments(null, true));

    expect(fetchCharacterAdjustments).not.toHaveBeenCalled();
  });

  it('should re-read when the character changes while its id stays the same', async () => {
    fetchCharacterAdjustments.mockResolvedValue({ adjustments: [] });

    const { rerender } = renderHook(
      ({ stamp }) => useCharacterAdjustments(aCharacter(stamp), true),
      {
        initialProps: { stamp: 'first' },
      }
    );

    await waitFor(() => expect(fetchCharacterAdjustments).toHaveBeenCalledTimes(1));

    // The id is unchanged — only the sheet moved, which is what every accepted adjustment does
    rerender({ stamp: 'second' });

    await waitFor(() => expect(fetchCharacterAdjustments).toHaveBeenCalledTimes(2));
  });

  it('should drop an answer about a version of the sheet that is no longer showing', async () => {
    const stale = deferred();
    const current = deferred();

    fetchCharacterAdjustments
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(current.promise);

    const { result, rerender } = renderHook(
      ({ stamp }) => useCharacterAdjustments(aCharacter(stamp), true),
      { initialProps: { stamp: 'before' } }
    );

    rerender({ stamp: 'after' });
    await waitFor(() => expect(fetchCharacterAdjustments).toHaveBeenCalledTimes(2));

    // The **newer** request answers first, and the older one lands after it — the ordering a
    // re-read triggered by an adjustment produces every time
    current.resolve({ adjustments: [adjustment('event-after')] });
    await waitFor(() => expect(result.current).toHaveLength(1));

    stale.resolve({ adjustments: [adjustment('event-before'), adjustment('event-older')] });
    await waitFor(() => expect(result.current[0].id).toBe('event-after'));

    expect(result.current).toHaveLength(1);
  });

  it('should show nothing rather than a banner when the read is refused', async () => {
    fetchCharacterAdjustments.mockRejectedValue(new Error('unreachable'));

    const { result } = renderHook(() => useCharacterAdjustments(aCharacter('stamp'), true));

    await waitFor(() => expect(fetchCharacterAdjustments).toHaveBeenCalled());

    // The log is context beside a sheet, not the sheet — see the hook's own note
    expect(result.current).toEqual([]);
  });
});
