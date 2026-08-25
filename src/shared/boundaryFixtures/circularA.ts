/**
 * Violates `no-circular`, with [`circularB`](./circularB.ts) (TICKET-DX-08)
 *
 * The references are inside function bodies rather than at module top level, so the pair is a
 * genuine import cycle without being a temporal-dead-zone crash if anything ever loads it.
 */

import { fromB } from './circularB';

export const fromA = (): string => `a, then ${fromB()}`;
