/**
 * Stat Modifier Badges Tests
 *
 * The id→abbreviation resolution is the whole reason this component exists (TICKET-MAT-01), so
 * that is what is asserted: the spelling a User reads, the tone that says which way it goes, and
 * the fallback when the ruleset no longer defines the stat a modifier names.
 *
 * **Validates: Concept 09; Requirements 7.6, 22.1-22.4**
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Stat } from '#shared/types/config';
import { StatModifierBadges } from './StatModifierBadges';

function stat(id: string, abbreviation: string, overrides: Partial<Stat> = {}): Stat {
  return {
    id,
    name: abbreviation,
    abbreviation,
    description: '',
    order: 0,
    countsTowardTotal: true,
    isResource: false,
    rounding: 'none',
    ...overrides,
  };
}

const STATS = [
  stat('mana-id', 'MANA'),
  stat('str-id', 'STR'),
  stat('apt-id', 'APT', { formula: '1' }),
];

/** A chip's text is split across nodes, so it is matched on the span's whole content */
const badge = (text: string) =>
  screen.getByText(
    (_content, element) => element?.tagName === 'SPAN' && element.textContent === text
  );

describe('StatModifierBadges', () => {
  it('should spell a modifier by its stat abbreviation, not its id', () => {
    render(<StatModifierBadges modifiers={[{ statId: 'mana-id', modifier: 50 }]} stats={STATS} />);

    expect(badge('MANA: +50')).toBeDefined();
  });

  it('should mark a bonus and a penalty with different tones', () => {
    render(
      <StatModifierBadges
        modifiers={[
          { statId: 'str-id', modifier: 11 },
          { statId: 'mana-id', modifier: -10 },
        ]}
        stats={STATS}
      />
    );

    expect(badge('STR: +11').className).toContain('text-forest');
    expect(badge('MANA: -10').className).toContain('text-crimson');
  });

  it('should still spell a derived stat, which the picker does not offer but an import can name', () => {
    render(<StatModifierBadges modifiers={[{ statId: 'apt-id', modifier: 2 }]} stats={STATS} />);

    expect(badge('APT: +2')).toBeDefined();
  });

  it('should fall back to the raw id for a stat the ruleset no longer defines', () => {
    // The validator reports it as a dangling reference; a chip nobody can see is a number nobody
    // can fix, so it is shown rather than dropped
    render(<StatModifierBadges modifiers={[{ statId: 'gone-id', modifier: 3 }]} stats={STATS} />);

    expect(badge('gone-id: +3')).toBeDefined();
  });

  it('should render two modifiers on the same stat rather than collapsing them', () => {
    // The level dialog permits it, so the display must not lose one to a duplicate key
    render(
      <StatModifierBadges
        modifiers={[
          { statId: 'str-id', modifier: 2 },
          { statId: 'str-id', modifier: 5 },
        ]}
        stats={STATS}
      />
    );

    expect(badge('STR: +2')).toBeDefined();
    expect(badge('STR: +5')).toBeDefined();
  });
});
