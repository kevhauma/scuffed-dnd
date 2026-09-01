/**
 * Fifty browsers do not come back together (TICKET-LIVE-03, v3 Req 44.6)
 *
 * The property is about a **population** rather than about one client, which is why the delay is a
 * pure function of an attempt number and a random source: fifty draws can be asserted exactly, with
 * no clock and no flake.
 *
 * Two halves. The **band** — every delay for a given attempt lands in `[ceiling / 2, ceiling]` — is
 * what makes the floor and the spread both true: no client retries after almost no wait, and no two
 * clients with different draws wait the same length. The **growth** is what keeps a server that
 * stays down from being asked at a fixed rate forever.
 *
 * **Validates: v3 Req 44.6**
 */

import { describe, expect, it } from 'vitest';
import { backoffDelay, RECONNECT_BASE_MS, RECONNECT_CAP_MS } from './liveBackoff';

/** A random source that walks its range, one call at a time */
function walkingRandom(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index] ?? 0;
    index += 1;
    return value;
  };
}

describe('backoffDelay', () => {
  it('waits half the base ceiling at the least, on the first retry', () => {
    const atTheFloor = () => 0;
    const delay = backoffDelay(1, atTheFloor);

    // Not zero: on a server refusing because it is busy, the client that draws the bottom of the
    // range is the one that keeps asking. *Full* jitter spreads better and has exactly that hole.
    expect(delay).toBe(RECONNECT_BASE_MS / 2);
  });

  it('waits the whole ceiling at the most', () => {
    const atTheCeiling = () => 1;
    const delay = backoffDelay(1, atTheCeiling);

    expect(delay).toBe(RECONNECT_BASE_MS);
  });

  it('doubles the ceiling per attempt', () => {
    const atTheCeiling = () => 1;
    const ceilings = [1, 2, 3, 4].map((attempt) => backoffDelay(attempt, atTheCeiling));

    expect(ceilings).toEqual([1_000, 2_000, 4_000, 8_000]);
  });

  it('stops doubling at the cap', () => {
    const atTheCeiling = () => 1;

    // A browser left open overnight against a server that is down makes two attempts a minute, and
    // comes back within half a minute of the server returning
    const late = backoffDelay(20, atTheCeiling);

    expect(late).toBe(RECONNECT_CAP_MS);
  });

  it('treats a first attempt counted from zero as the first attempt', () => {
    const atTheCeiling = () => 1;
    const fromZero = backoffDelay(0, atTheCeiling);
    const fromOne = backoffDelay(1, atTheCeiling);

    // Answering rather than computing a fractional ceiling is what keeps the band claim true for
    // every input a caller can produce
    expect(fromZero).toBe(fromOne);
  });

  it('gives fifty clients fifty different delays, all inside the band', () => {
    // The criterion: a server restart drops every connected browser in the same instant. What each
    // one draws is its own point in the range, so what comes back is a spread rather than a wall.
    const population = 50;
    const draws = Array.from({ length: population }, (_unused, index) => index / population);
    const random = walkingRandom(draws);

    const delays = draws.map(() => backoffDelay(1, random));
    const distinct = new Set(delays);

    const floor = RECONNECT_BASE_MS / 2;
    const outsideTheBand = delays.filter((delay) => delay < floor || delay > RECONNECT_BASE_MS);

    expect(distinct.size).toBe(population);
    expect(outsideTheBand).toEqual([]);
  });

  it('spreads a later attempt across a wider window still', () => {
    // The spread grows with the ceiling, which is what stops a *second* round of fifty from
    // colliding after the first one has already been pushed together by the doubling
    const draws = [0, 0.5, 1];
    const random = walkingRandom(draws);

    const delays = draws.map(() => backoffDelay(3, random));

    expect(delays).toEqual([2_000, 3_000, 4_000]);
  });
});
