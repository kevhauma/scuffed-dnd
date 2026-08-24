import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Ornament } from './Ornament';
import { variantStyles } from './Ornament.style';

const VARIANTS = Object.keys(variantStyles) as (keyof typeof variantStyles)[];

describe('Ornament', () => {
  it('should draw every variant in the style table', () => {
    // The drawings and the styles are two records keyed the same way, and nothing in the types
    // stops one from gaining an entry the other lacks — which would render an ornament with no
    // size, or size an ornament with no drawing
    for (const variant of VARIANTS) {
      const { container, unmount } = render(<Ornament variant={variant} />);
      const svg = container.querySelector('svg');

      expect(svg, `${variant} renders nothing`).not.toBeNull();
      expect(svg?.getAttribute('viewBox'), `${variant} has no viewBox`).toBeTruthy();
      expect(svg?.children.length, `${variant} is empty`).toBeGreaterThan(0);
      unmount();
    }
  });

  it('should be hidden from assistive technology', () => {
    // An ornament carries no information. Four "image"s announced per card is worse than silence.
    for (const variant of VARIANTS) {
      const { container, unmount } = render(<Ornament variant={variant} />);
      expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      unmount();
    }
  });

  it('should take its size from the variant and its placement from the caller', () => {
    const { container } = render(<Ornament variant="rivet" className="absolute left-2 top-2" />);
    const className = container.querySelector('svg')?.getAttribute('class') ?? '';

    expect(className).toContain(variantStyles.rivet);
    expect(className).toContain('absolute left-2 top-2');
  });

  it('should take its colour from whatever it is pinned to', () => {
    // `currentColor` throughout is what lets one drawing serve a brass rivet on oak and an ink
    // vine on parchment. The rivet's highlight is the documented exception.
    const { container } = render(<Ornament variant="corner" />);
    const fills = [...container.querySelectorAll('[fill], [stroke]')].flatMap((node) =>
      [node.getAttribute('fill'), node.getAttribute('stroke')].filter(Boolean)
    );

    expect(fills.length).toBeGreaterThan(0);
    for (const paint of fills) {
      expect(['currentColor', 'none']).toContain(paint);
    }
  });
});
