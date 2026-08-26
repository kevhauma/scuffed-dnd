/**
 * The one unprompted offer to upload, asked for once (TICKET-IO-04)
 *
 * v3 Req 36.6 in a hook: on an Account's first sign-in the upload is offered without being asked
 * for, and never again — while the action itself stays reachable from the ruleset list forever.
 *
 * **The server decides, not this hook.** `claimUploadPrompt` is a write whose answer is whether it
 * wrote, so two tabs restoring the same session cannot both be told yes and a browser that clears
 * its storage does not get asked a second time. What is left here is *when to ask*, and there is one
 * rule about that worth stating: **it does not ask when there is nothing to upload.** Claiming the
 * offer for a browser holding no ruleset would spend it on a dialog that has nothing to say, and the
 * Account would never be offered again.
 *
 * A refusal is swallowed rather than surfaced. This is a convenience nobody asked for; an Account
 * whose network hiccuped on page load should meet the ruleset list, not an error about a prompt.
 *
 * **Validates: v3 Req 36.6**
 */

import { useEffect, useRef } from 'react';
import { claimUploadPrompt } from '../../services/rulesetUpload';

/**
 * Offer the upload once, if this Account is still owed the offer
 *
 * @param enabled Whether there is both an Account and something in this browser to upload
 * @param onPrompt What to do when the offer is this call's to make — opening the upload dialog
 */
export function useUploadPrompt(enabled: boolean, onPrompt: () => void): void {
  // The callback is read at fire time rather than depended on, so a surface that rebuilds it every
  // render does not re-run the claim. The claim is idempotent server-side, but a request per render
  // is still a request per render.
  const fire = useRef(onPrompt);
  fire.current = onPrompt;

  /** Whether this mount has already asked — the server is the real guard, this saves the round trip */
  const asked = useRef(false);

  useEffect(() => {
    if (!enabled || asked.current) return;
    asked.current = true;

    void claimUploadPrompt()
      .then((shouldPrompt) => {
        if (shouldPrompt) fire.current();
      })
      .catch(() => {
        // Deliberately silent — see the header
      });
  }, [enabled]);
}
