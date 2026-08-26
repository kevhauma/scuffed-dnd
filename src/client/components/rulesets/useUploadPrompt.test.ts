/**
 * The one unprompted offer, asked for once (TICKET-IO-04)
 *
 * Colocated because the IO-04 review pointed out it was the only new module without a test, and the
 * two behaviours worth pinning are exactly the two nobody would guess from the call site: the
 * `asked` ref that stops a re-render asking again, and the **swallowed** refusal. Reaching them
 * through `useRulesetTransfer` would test them by accident.
 *
 * **Validates: v3 Req 36.6**
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUploadPrompt } from './useUploadPrompt';

const claimUploadPrompt = vi.fn();

vi.mock('../../services/rulesetUpload', () => ({
  claimUploadPrompt: () => claimUploadPrompt(),
}));

beforeEach(() => {
  claimUploadPrompt.mockReset();
});

describe('useUploadPrompt', () => {
  it('asks nothing while it is disabled', () => {
    renderHook(() => useUploadPrompt(false, vi.fn()));

    expect(claimUploadPrompt).not.toHaveBeenCalled();
  });

  it('fires the offer when the claim is this call’s to make', async () => {
    claimUploadPrompt.mockResolvedValue(true);
    const onPrompt = vi.fn();

    renderHook(() => useUploadPrompt(true, onPrompt));

    await waitFor(() => expect(onPrompt).toHaveBeenCalledTimes(1));
  });

  it('stays quiet when the Account has already been asked', async () => {
    claimUploadPrompt.mockResolvedValue(false);
    const onPrompt = vi.fn();

    renderHook(() => useUploadPrompt(true, onPrompt));

    await waitFor(() => expect(claimUploadPrompt).toHaveBeenCalledTimes(1));
    expect(onPrompt).not.toHaveBeenCalled();
  });

  it('claims once per mount however often it re-renders', async () => {
    claimUploadPrompt.mockResolvedValue(false);
    // A surface that rebuilds its callback every render is the normal case, not the exception —
    // depending on it rather than reading it through a ref would be a request per render
    const { rerender } = renderHook(({ enabled }) => useUploadPrompt(enabled, vi.fn()), {
      initialProps: { enabled: true },
    });

    await waitFor(() => expect(claimUploadPrompt).toHaveBeenCalledTimes(1));

    rerender({ enabled: true });
    rerender({ enabled: true });

    expect(claimUploadPrompt).toHaveBeenCalledTimes(1);
  });

  it('swallows a refusal rather than putting it in front of somebody', async () => {
    claimUploadPrompt.mockRejectedValue(new Error('offline'));
    const onPrompt = vi.fn();

    // This is a convenience nobody asked for; an Account whose network hiccuped on page load should
    // meet the ruleset list, not an error about a prompt. An unhandled rejection would fail the run.
    await act(async () => {
      renderHook(() => useUploadPrompt(true, onPrompt));
    });

    await waitFor(() => expect(claimUploadPrompt).toHaveBeenCalledTimes(1));
    expect(onPrompt).not.toHaveBeenCalled();
  });
});
