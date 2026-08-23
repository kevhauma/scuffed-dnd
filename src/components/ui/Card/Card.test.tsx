import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

/** Enough cards that the per-card stain draw is very unlikely to come out all one way */
const SHEETS = Array.from({ length: 24 }, (_, index) => `sheet-${index}`);

describe('Card', () => {
  it('renders with default variant styles', () => {
    const { container } = render(<Card>Card content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toBeDefined();
    expect(card?.className).toContain('bg-parchment-50');
    expect(card?.className).toContain('shadow-parchment');
  });

  it('renders with elevated variant', () => {
    const { container } = render(<Card variant="elevated">Elevated card</Card>);
    const card = container.firstChild as HTMLElement;
    // The rest of the pile showing past this sheet, rather than a bigger blur
    expect(card?.className).toContain('shadow-stack');
  });

  it('is made of parchment rather than of rectangle', () => {
    // The hand-cut corners and the dog-eared fold are what stop a grid of cards reading as a grid
    // of divs. Both are stylesheet rules, so the assertion is on the classes that carry them.
    const { container } = render(<Card>Card content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card?.className).toContain('card-hand');
    expect(card?.className).toContain('card-parchment');
  });

  it('stains some sheets and not others', () => {
    // Each card seeds its own stain from `useId`, so a list of them comes out mixed rather than
    // uniformly marked or uniformly clean
    const { container } = render(
      <div>
        {SHEETS.map((sheet) => (
          <Card key={sheet}>{sheet}</Card>
        ))}
      </div>
    );

    const cards = [...(container.firstElementChild?.children ?? [])];
    const stained = cards.filter((card) => card.getAttribute('style')?.includes('--stain-a'));

    expect(stained.length).toBeGreaterThan(0);
    expect(stained.length).toBeLessThan(cards.length);
  });

  it('never stains a plaque, because timber does not stain', () => {
    const { container } = render(
      <div>
        {SHEETS.map((sheet) => (
          <Card key={sheet} variant="plaque">
            {sheet}
          </Card>
        ))}
      </div>
    );

    for (const card of container.firstElementChild?.children ?? []) {
      expect(card.getAttribute('style')).toBeNull();
    }
  });

  it('does not fold the corner of a plaque, because wood does not fold', () => {
    const { container } = render(<Card variant="plaque">Plaque</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card?.className).toContain('surface-fibre');
    expect(card?.className).not.toContain('card-parchment');
    // It keeps the hand-cut corners: a sawn board, not a missing radius
    expect(card?.className).toContain('card-hand');
  });

  it('lifts on hover only when it is the control', () => {
    const { container: plain } = render(<Card>Not a control</Card>);
    expect((plain.firstChild as HTMLElement)?.className).not.toContain('hover:-translate-y-0.5');

    const { container: link } = render(<Card interactive>A control</Card>);
    const card = link.firstChild as HTMLElement;
    expect(card?.className).toContain('hover:-translate-y-0.5');
    expect(card?.className).toContain('cursor-pointer');
  });

  it('renders with bordered variant', () => {
    const { container } = render(<Card variant="bordered">Bordered card</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card?.className).toContain('shadow-parchment-lg');
  });

  it('separates a paper card from the page by depth, never by an outline', () => {
    // Paper has an edge you see because of the shadow under it, not a keyline. Drawing both gave
    // every card a hard boundary that fought the shadow and flattened the stack.
    for (const variant of ['default', 'elevated', 'bordered'] as const) {
      const { container, unmount } = render(<Card variant={variant}>Paper</Card>);
      const className = (container.firstChild as HTMLElement)?.className ?? '';

      expect(className, `${variant} draws a border`).not.toMatch(/\bborder(-2)?\b/);
      expect(className, `${variant} has no shadow to stand on`).toMatch(/\bshadow-/);
      unmount();
    }
  });

  it('accepts className prop for positioning', () => {
    const { container } = render(<Card className="ml-4 mb-6">Positioned card</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card?.className).toContain('ml-4');
    expect(card?.className).toContain('mb-6');
  });

  it('renders children correctly', () => {
    render(
      <Card>
        <h2>Title</h2>
        <p>Content</p>
      </Card>
    );
    expect(screen.getByText('Title')).toBeDefined();
    expect(screen.getByText('Content')).toBeDefined();
  });
});
