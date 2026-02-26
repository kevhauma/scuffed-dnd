import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeDefined();
    expect(button.textContent).toBe('Click me');
  });

  it('applies primary variant by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-royal');
    expect(button.className).toContain('text-parchment-50');
  });

  it('applies secondary variant styles', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-parchment-100');
    expect(button.className).toContain('text-ink-900');
  });

  it('applies danger variant styles', () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-crimson');
    expect(button.className).toContain('text-parchment-50');
  });

  it('applies ghost variant styles', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-transparent');
    expect(button.className).toContain('text-ink-800');
  });

  it('applies small size styles', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('px-3');
    expect(button.className).toContain('py-1.5');
    expect(button.className).toContain('text-sm');
  });

  it('applies medium size styles by default', () => {
    render(<Button>Medium</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('px-4');
    expect(button.className).toContain('py-2');
    expect(button.className).toContain('text-base');
  });

  it('applies large size styles', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('px-6');
    expect(button.className).toContain('py-3');
    expect(button.className).toContain('text-lg');
  });

  it('handles disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button.disabled).toBe(true);
    expect(button.className).toContain('disabled:opacity-50');
    expect(button.className).toContain('disabled:cursor-not-allowed');
  });

  it('accepts custom className for positioning', () => {
    render(<Button className="ml-4 mt-2">Custom</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('ml-4');
    expect(button.className).toContain('mt-2');
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    const button = screen.getByRole('button');
    button.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('sets button type to button by default', () => {
    render(<Button>Button</Button>);
    const button = screen.getByRole('button');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('allows custom button type', () => {
    render(<Button type="submit">Submit</Button>);
    const button = screen.getByRole('button');
    expect(button.getAttribute('type')).toBe('submit');
  });

  it('includes focus ring styles for accessibility', () => {
    render(<Button>Focus</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('focus:outline-none');
    expect(button.className).toContain('focus:ring-2');
    expect(button.className).toContain('focus:ring-amber');
  });

  it('includes medieval styling elements', () => {
    render(<Button>Medieval</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('font-heading');
    expect(button.className).toContain('border-2');
    expect(button.className).toContain('shadow-parchment');
  });

  it('does not include margin or positioning styles in base component', () => {
    render(<Button>No Margin</Button>);
    const button = screen.getByRole('button');
    // Verify no margin classes are in the base styles
    expect(button.className).not.toMatch(/\bm-\d+\b/);
    expect(button.className).not.toMatch(/\bmt-\d+\b/);
    expect(button.className).not.toMatch(/\bmb-\d+\b/);
    expect(button.className).not.toMatch(/\bml-\d+\b/);
    expect(button.className).not.toMatch(/\bmr-\d+\b/);
  });
});
