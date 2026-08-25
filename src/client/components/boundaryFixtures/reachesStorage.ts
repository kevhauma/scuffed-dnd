/**
 * Violates `persistence-belongs-to-the-store` (TICKET-DX-08)
 *
 * A component reaching for `saveConfiguration` directly. The damage is not that it writes — it is
 * that it writes *without* patching the store, so the two disagree until the next reload decides
 * which one was right. The Zustand action does both in one call, which is why it is the only
 * caller.
 */

import { saveConfiguration } from '../../services/storage';

export const savingFromAComponent = saveConfiguration;
