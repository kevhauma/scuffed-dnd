/**
 * The DM's addressed invitations (TICKET-GAM-03)
 *
 * Four claims worth a test:
 *
 * - **The five states are shown rather than filtered**, because *they declined* is the single most
 *   useful thing on the list and a pending-only view would hide it (v3 Req 38.4).
 * - **Only a pending invitation offers *Take it back***, matching the server, which deliberately
 *   leaves a declined row saying `declined` rather than restamping it.
 * - **The box clears only over an invitation that exists**, so a refusal does not also throw away
 *   what the DM typed.
 * - **An archived table says so instead of offering a form**, which is `InviteCodePanel`'s rule and
 *   the same server rule underneath it.
 *
 * **Validates: v3 Req 37.5, 38.3, 38.4**
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AddressedInvite } from '#shared/types/api';
import { INVITE_STATE } from '#shared/types/api';
import { AddressedInvitePanel } from './AddressedInvitePanel';

/** One addressed invitation, as the DM's listing carries it */
function sent(overrides: Partial<AddressedInvite> = {}): AddressedInvite {
  return {
    id: 'invite-1',
    email: 'ada@example.test',
    state: INVITE_STATE.PENDING,
    expiresAt: 1_760_000_000_000,
    ...overrides,
  };
}

/** The panel with everything defaulted to "a live table that has invited nobody" */
function renderPanel(props: Partial<React.ComponentProps<typeof AddressedInvitePanel>> = {}) {
  const onInvite = vi.fn(async () => true);
  const onRevoke = vi.fn();

  render(
    <AddressedInvitePanel
      invites={[]}
      canInvite
      isPending={false}
      isBusy={false}
      error={null}
      onInvite={onInvite}
      onRevoke={onRevoke}
      {...props}
    />
  );

  return { onInvite, onRevoke };
}

/** The address box */
function addressBox(): HTMLInputElement {
  return screen.getByLabelText('Their email address') as HTMLInputElement;
}

describe('AddressedInvitePanel', () => {
  it('says in words that no email is sent', () => {
    renderPanel();

    // The DM is choosing a delivery mechanism, so they are told which one it is (D12)
    expect(screen.getByText(/No email is sent/)).toBeTruthy();
  });

  it('sends the address that was typed, trimmed', () => {
    const { onInvite } = renderPanel();

    fireEvent.change(addressBox(), { target: { value: '  ada@example.test ' } });
    fireEvent.click(screen.getByText('Invite'));

    expect(onInvite).toHaveBeenCalledWith('ada@example.test');
  });

  it('clears the box once the invitation exists', async () => {
    renderPanel();

    fireEvent.change(addressBox(), { target: { value: 'ada@example.test' } });
    fireEvent.click(screen.getByText('Invite'));

    await waitFor(() => expect(addressBox().value).toBe(''));
  });

  it('keeps what was typed when the server refuses', async () => {
    renderPanel({ onInvite: vi.fn(async () => false) });

    fireEvent.change(addressBox(), { target: { value: 'ada@example.test' } });
    fireEvent.click(screen.getByText('Invite'));

    // …and the reason is beside it rather than instead of it
    await waitFor(() => expect(addressBox().value).toBe('ada@example.test'));
  });

  it('refuses to send an empty box', () => {
    const { onInvite } = renderPanel();

    fireEvent.click(screen.getByText('Invite'));

    expect(onInvite).not.toHaveBeenCalled();
  });

  it.each([
    [INVITE_STATE.PENDING, 'Waiting'],
    [INVITE_STATE.ACCEPTED, 'Joined'],
    [INVITE_STATE.DECLINED, 'Declined'],
    [INVITE_STATE.EXPIRED, 'Expired'],
    [INVITE_STATE.REVOKED, 'Taken back'],
  ])('says %s in words', (state, label) => {
    renderPanel({ invites: [sent({ state })] });

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText('ada@example.test')).toBeTruthy();
  });

  it('offers Take it back only while an invitation is pending', () => {
    renderPanel({
      invites: [sent(), sent({ id: 'invite-2', state: INVITE_STATE.DECLINED })],
    });

    expect(screen.getAllByText('Take it back')).toHaveLength(1);
  });

  it('takes back the invitation the button belongs to', () => {
    const { onRevoke } = renderPanel({ invites: [sent()] });

    fireEvent.click(screen.getByText('Take it back'));

    expect(onRevoke).toHaveBeenCalledWith('invite-1');
  });

  it('shows an archived table the reason rather than a form', () => {
    renderPanel({ canInvite: false });

    expect(screen.queryByLabelText('Their email address')).toBeNull();
    expect(screen.getByText(/archived/)).toBeTruthy();
  });

  it('shows the server’s refusal', () => {
    renderPanel({ error: 'ada@example.test is already at this table.' });

    expect(screen.getByRole('alert').textContent).toContain('already at this table');
  });
});
