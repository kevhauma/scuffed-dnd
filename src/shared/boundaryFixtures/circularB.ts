/**
 * Violates `no-circular`, with [`circularA`](./circularA.ts) (TICKET-DX-08)
 */

import { fromA } from './circularA';

export const fromB = (): string => 'b';

export const backToA = (): string => fromA();
