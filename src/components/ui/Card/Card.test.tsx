import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders with default variant styles', () => {
    render(<Card>Card content</Card>);
    const card = screen.getByText('Card content').parentElement;
    expect(card).toBeDefined();
    expect(card?.className).toContain('bg-parchment-50');
    expect(card?.className).toContain('shadow-parchment');
  });

  it('renders with elevated variant', () => {
    render(<Card variant="elevated">Elevated card</Card>);
    const card = screen.getByText('Elevated card').parentElement;
    expect(card?.className).toContain('shadow-parchment-lg');
  });

  it('renders with bordered variant', () => {
    render(<Card variant="bordered">Bordered card</Card>);
    const card = screen.getByText('Bordered card').parentElement;
    expect(card?.className).toContain('border-2');
    expect(card?.className).toContain('border-ink-700');
  });

  it('accepts className prop for positioning', () => {
    render(<Card className="ml-4 mb-6">Positioned card</Card>);
    const card = screen.getByText('Positioned card').parentElement;
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
