/**
 * Skill Bonus Badges Tests
 *
 * `StatModifierBadges.test.tsx`'s counterpart, asserting the same three things one entity over
 * (TICKET-ITEM-01): the spelling a User reads, the tone that says which way a bonus goes, and the
 * fallback when the ruleset no longer defines the skill a row names.
 *
 * The fallback is the case worth having a test for at all, because it is the one the component's
 * JSDoc argues hardest and the one nothing else covers — the items panel's own suite only ever
 * renders a vector whose skills all exist. A chip nobody can see is a number nobody can fix.
 *
 * **Validates: v4 systems/11; Requirements 7.6, 22.1-22.4**
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Skill } from '#shared/types/config';
import { SkillBonusBadges } from './SkillBonusBadges';

function skill(id: string, name: string): Skill {
  return { id, name, description: '', statWeights: [] };
}

const SKILLS = [
  skill('athletics-id', 'Athletics'),
  skill('sneaking-id', 'Sneaking'),
  // The sheet genuinely carries `skinning` and `Skinning`; two skills may share a spelling, and
  // that is the ruleset's business rather than this component's (TICKET-SKL-02)
  skill('skinning-lower-id', 'skinning'),
  skill('skinning-upper-id', 'Skinning'),
];

/** A chip's text is split across nodes, so it is matched on the span's whole content */
const badge = (text: string) =>
  screen.getByText(
    (_content, element) => element?.tagName === 'SPAN' && element.textContent === text
  );

describe('SkillBonusBadges', () => {
  it('should spell a bonus by its skill name, not its id', () => {
    render(
      <SkillBonusBadges bonuses={[{ skillId: 'athletics-id', modifier: 2 }]} skills={SKILLS} />
    );

    expect(badge('Athletics: +2')).toBeDefined();
  });

  it('should mark a bonus and a penalty with different tones', () => {
    // The ticket's own Battleaxe: better at Athletics, worse at Sneaking
    render(
      <SkillBonusBadges
        bonuses={[
          { skillId: 'athletics-id', modifier: 2 },
          { skillId: 'sneaking-id', modifier: -1 },
        ]}
        skills={SKILLS}
      />
    );

    expect(badge('Athletics: +2').className).toContain('text-forest');
    expect(badge('Sneaking: -1').className).toContain('text-crimson');
  });

  it('should read a zero as a bonus rather than a penalty', () => {
    // The editor prunes a zero on save, but an imported file may carry one and it is not a penalty
    render(
      <SkillBonusBadges bonuses={[{ skillId: 'athletics-id', modifier: 0 }]} skills={SKILLS} />
    );

    expect(badge('Athletics: +0').className).toContain('text-forest');
  });

  it('should fall back to the raw id for a skill the ruleset no longer defines', () => {
    // `engine/validator.ts` reports it as a dangling reference and
    // `calculateEquipmentSkillBonuses` drops it, so the chip is the only place a User can see the
    // row that needs repointing — hiding it would hide the repair
    render(<SkillBonusBadges bonuses={[{ skillId: 'gone-id', modifier: 3 }]} skills={SKILLS} />);

    expect(badge('gone-id: +3')).toBeDefined();
  });

  it('should render two rows naming the same skill rather than collapsing them', () => {
    // The dialog permits it, exactly as the material level dialog does, so the display must not
    // lose one to a duplicate key
    render(
      <SkillBonusBadges
        bonuses={[
          { skillId: 'athletics-id', modifier: 2 },
          { skillId: 'athletics-id', modifier: 5 },
        ]}
        skills={SKILLS}
      />
    );

    expect(badge('Athletics: +2')).toBeDefined();
    expect(badge('Athletics: +5')).toBeDefined();
  });

  it('should tell two skills that share a spelling apart by id', () => {
    render(
      <SkillBonusBadges
        bonuses={[
          { skillId: 'skinning-lower-id', modifier: 1 },
          { skillId: 'skinning-upper-id', modifier: -1 },
        ]}
        skills={SKILLS}
      />
    );

    // Both resolve, and each carries its own row's number — the vector is keyed by id, so a shared
    // name collides with nothing
    expect(badge('skinning: +1')).toBeDefined();
    expect(badge('Skinning: -1')).toBeDefined();
  });

  it('should render nothing at all for an empty vector', () => {
    const { container } = render(<SkillBonusBadges bonuses={[]} skills={SKILLS} />);

    expect(container.querySelectorAll('span')).toHaveLength(0);
  });
});
