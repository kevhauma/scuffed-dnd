/**
 * Violates `kernel-is-framework-free` (TICKET-DX-08)
 *
 * The exact import TICKET-DX-08's third acceptance criterion names. The Kernel's purity was true
 * by habit for two milestones — nothing stopped a calculator reaching for a store the day someone
 * wanted one — and a habit is not a rule until something fails when it is broken.
 */

import { create } from 'zustand';

export const aStoreInTheKernel = create;
