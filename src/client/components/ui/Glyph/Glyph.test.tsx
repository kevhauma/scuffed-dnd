import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GLYPH_NAMES, type GlyphName } from '#shared/types/config';
import { Glyph } from './Glyph';
import { GLYPH_GROUPS, GLYPH_LABELS } from './Glyph.catalogue';

const NAMES: readonly GlyphName[] = GLYPH_NAMES;

describe('Glyph', () => {
  it('should draw every name in the set', () => {
    for (const name of NAMES) {
      const { container, unmount } = render(<Glyph name={name} />);
      const svg = container.querySelector('svg');

      expect(svg, `${name} renders nothing`).not.toBeNull();
      expect(svg?.querySelector('path')?.getAttribute('d'), `${name} has no path`).toBeTruthy();
      unmount();
    }
  });

  it('should be hidden from assistive technology', () => {
    // The slot's name and its occupant are real text beside the glyph. Announcing "image" over
    // each of seven tiles would be noise on top of information already available.
    for (const name of NAMES) {
      const { container, unmount } = render(<Glyph name={name} />);
      expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      unmount();
    }
  });

  it('should take its colour from whatever it sits in', () => {
    // One drawing serves a dim empty slot and a lit filled one, which only works if the tile
    // decides the colour
    for (const name of NAMES) {
      const { container, unmount } = render(<Glyph name={name} />);
      for (const path of container.querySelectorAll('path')) {
        expect(path.getAttribute('fill'), `${name} paints its own colour`).toBe('currentColor');
      }
      unmount();
    }
  });

  it('should take size and colour overrides from the caller', () => {
    const { container } = render(<Glyph name="helm" className="h-10 w-10 text-brass" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('h-10 w-10 text-brass');
  });
});

describe('the glyph catalogue', () => {
  it('should name every glyph exactly once, in exactly one group', () => {
    // The picker is built from the groups, so a glyph missing from them is one a User can never
    // choose — invisible in a way the `Record<GlyphName, …>` type cannot catch
    const grouped = GLYPH_GROUPS.flatMap((group) => group.names);

    expect([...grouped].sort()).toEqual([...NAMES].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('should give every glyph a label a picker can show', () => {
    for (const name of NAMES) {
      expect(GLYPH_LABELS[name], `${name} has no label`).toBeTruthy();
    }
  });

  it('should not reuse a label', () => {
    // Two identically-labelled buttons in the picker are two buttons nobody can tell apart
    const labels = NAMES.map((name) => GLYPH_LABELS[name]);

    expect(new Set(labels).size).toBe(labels.length);
  });
});
