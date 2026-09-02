/**
 * The roster's two rules about who may act (TICKET-DM-04, v3 Req 49.10)
 *
 * These are the predicates {@link useSessionRoster} answers *may this reader press a `dm-` action on
 * this row?* with, and until review they were tested only through surfaces that **stubbed** them —
 * `SessionRoster.test.tsx` and `rosterQuickActions.test.tsx` each hand the component an inline
 * `actsAsDm`, and one of them carried a comment claiming the opposite. Deleting the owner clause
 * failed nothing.
 *
 * They are pure and they are the server's rule restated, so they are tested directly here. The
 * clause that matters most is the second: `requireCharacterDM` is `requireCharacterWriter` minus the
 * owner, so a DM pressing a `dm-` action on their **own** character is refused a 404 — a row that
 * offered one would be offering a button that cannot work.
 *
 * **Validates: v3 Req 49.10, 42.7**
 */

import { describe, expect, it } from 'vitest';
import type { SessionMemberSummary } from '#shared/types/api';
import { MEMBER_ROLE } from '#shared/types/api';
import { actsAsDungeonMasterOver, holdsDmSeat } from './useSessionRoster';

const DM_ACCOUNT = 'account-dm';
const PLAYER_ACCOUNT = 'account-player';

/** One row of the member listing, spelled the way the wire spells it */
function aMember(accountId: string, role: SessionMemberSummary['role']): SessionMemberSummary {
  return {
    accountId,
    name: `${accountId}@example.com`,
    role,
    joinedAt: 1_788_000_000_000,
    characters: [],
  };
}

describe('actsAsDungeonMasterOver', () => {
  it('should offer the actions to the table DM on somebody else', () => {
    const offered = actsAsDungeonMasterOver(true, DM_ACCOUNT, PLAYER_ACCOUNT);

    expect(offered).toBe(true);
  });

  it('should offer the DM nothing on their own character, whom requireCharacterDM refuses', () => {
    // The clause the stubs were copying rather than exercising. `requireCharacterDM` is
    // `requireCharacterWriter` minus the owner, so this row's buttons would all 404.
    const offered = actsAsDungeonMasterOver(true, DM_ACCOUNT, DM_ACCOUNT);

    expect(offered).toBe(false);
  });

  it('should offer a player nothing, even on their own character', () => {
    const offered = actsAsDungeonMasterOver(false, PLAYER_ACCOUNT, PLAYER_ACCOUNT);

    expect(offered).toBe(false);
  });

  it('should offer a player nothing on somebody else either', () => {
    const offered = actsAsDungeonMasterOver(false, PLAYER_ACCOUNT, DM_ACCOUNT);

    expect(offered).toBe(false);
  });

  it('should say no while the cookie is unresolved, rather than flashing a DM the controls', () => {
    // `useIsDungeonMaster`'s rule and for its reason: a half-identified browser must not paint a
    // DM's buttons onto somebody's roster and then take them away.
    const offered = actsAsDungeonMasterOver(true, null, PLAYER_ACCOUNT);

    expect(offered).toBe(false);
  });
});

describe('holdsDmSeat', () => {
  const listing = [
    aMember(DM_ACCOUNT, MEMBER_ROLE.DM),
    aMember(PLAYER_ACCOUNT, MEMBER_ROLE.PLAYER),
  ];

  it('should read the seat off the listing', () => {
    const seated = holdsDmSeat(listing, DM_ACCOUNT);

    expect(seated).toBe(true);
  });

  it('should not give the seat to a player at the same table', () => {
    const seated = holdsDmSeat(listing, PLAYER_ACCOUNT);

    expect(seated).toBe(false);
  });

  it('should not give the seat to an Account the listing does not name', () => {
    const seated = holdsDmSeat(listing, 'account-stranger');

    expect(seated).toBe(false);
  });

  it('should say no while the cookie is unresolved', () => {
    const seated = holdsDmSeat(listing, null);

    expect(seated).toBe(false);
  });

  it('should say no for a table whose listing has not arrived', () => {
    const seated = holdsDmSeat([], DM_ACCOUNT);

    expect(seated).toBe(false);
  });
});
