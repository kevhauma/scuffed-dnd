/**
 * The code itself (TICKET-GAM-02)
 *
 * Criterion four asks for three properties and they are the three `describe` blocks below:
 * **cryptographically sourced**, **long enough not to be guessable**, and **free of visually
 * ambiguous characters**. The third is the one worth testing hardest, because it is the one that
 * fails silently — a code with an `O` in it works perfectly until somebody reads it aloud.
 *
 * **Validates: v3 Req 38.1**
 */

import { describe, expect, it, vi } from 'vitest';
import { formatInviteCode, generateInviteCode, normalizeInviteCode } from './inviteCode';

/** The characters Crockford's alphabet leaves out, and which each of them reads as */
const AMBIGUOUS = { O: '0', I: '1', L: '1' };

describe('generateInviteCode', () => {
  it('draws from a cryptographically secure source, never Math.random', () => {
    const secure = vi.spyOn(globalThis.crypto, 'getRandomValues');
    const loose = vi.spyOn(Math, 'random');

    generateInviteCode();

    expect(secure).toHaveBeenCalled();
    expect(loose).not.toHaveBeenCalled();

    secure.mockRestore();
    loose.mockRestore();
  });

  it('is ten characters, which is fifty bits of a thirty-two character alphabet', () => {
    expect(generateInviteCode()).toHaveLength(10);
  });

  it('never emits a character that can be mistaken for another', () => {
    // Two hundred codes is two thousand characters — enough that a one-in-thirty-two mistake in the
    // alphabet shows up rather than hiding behind a lucky run
    const drawn = new Set(
      Array.from({ length: 200 }, () => generateInviteCode())
        .join('')
        .split('')
    );

    for (const forbidden of Object.keys(AMBIGUOUS)) {
      expect(drawn.has(forbidden), forbidden).toBe(false);
    }
  });

  it('uses the whole alphabet, so the space really is what it claims', () => {
    // The counterpart to the case above: an alphabet that excluded too much would also pass it, and
    // would quietly shrink the space the security argument rests on
    const drawn = new Set(
      Array.from({ length: 200 }, () => generateInviteCode())
        .join('')
        .split('')
    );

    expect(drawn.size).toBe(32);
  });

  it('does not repeat itself', () => {
    const codes = Array.from({ length: 500 }, () => generateInviteCode());

    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('normalizeInviteCode', () => {
  it('accepts the hyphenated form a human is shown', () => {
    expect(normalizeInviteCode('A1B2C-3D4E5')).toBe('A1B2C3D4E5');
  });

  it('accepts lower case, spaces and a pasted newline', () => {
    expect(normalizeInviteCode('  a1b2c 3d4e5\n')).toBe('A1B2C3D4E5');
  });

  it.each(Object.entries(AMBIGUOUS))('reads %s as %s', (typed, meant) => {
    // Somebody hearing a code aloud cannot tell these apart, and refusing them would be punishing
    // them for the alphabet's problem rather than their own
    expect(normalizeInviteCode(typed)).toBe(meant);
  });

  it('is idempotent, so a stored code and a typed one meet in the same form', () => {
    const code = generateInviteCode();

    expect(normalizeInviteCode(normalizeInviteCode(code))).toBe(normalizeInviteCode(code));
  });

  it('leaves a generated code untouched, because it is already normal', () => {
    const code = generateInviteCode();

    expect(normalizeInviteCode(code)).toBe(code);
  });

  it('answers nothing usable with an empty string rather than a partial match', () => {
    expect(normalizeInviteCode('---')).toBe('');
    expect(normalizeInviteCode('')).toBe('');
  });
});

describe('formatInviteCode', () => {
  it('splits a stored code into two groups a person can keep their place in', () => {
    expect(formatInviteCode('A1B2C3D4E5')).toBe('A1B2C-3D4E5');
  });

  it('round-trips through the normaliser', () => {
    const code = generateInviteCode();

    expect(normalizeInviteCode(formatInviteCode(code))).toBe(code);
  });
});
