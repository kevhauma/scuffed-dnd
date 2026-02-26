import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('renders with default styles', () => {
    render(<Input placeholder="Test input" />);
    const input = screen.getByPlaceholderText('Test input');
    expect(input).toBeDefined();
    expect(input.className).toContain('bg-white');
    expect(input.className).toContain('border-stone-200');
  });

  it('applies error styles when error prop is true', () => {
    render(<Input error placeholder="Error input" />);
    const input = screen.getByPlaceholderText('Error input');
    expect(input.className).toContain('border-crimson');
  });

  it('applies disabled styles when disabled', () => {
    render(<Input disabled placeholder="Disabled input" />);
    const input = screen.getByPlaceholderText('Disabled input');
    expect(input.className).toContain('opacity-50');
    expect(input.className).toContain('cursor-not-allowed');
  });

  it('accepts className prop for positioning', () => {
    render(<Input className="ml-4 flex-1" placeholder="Positioned input" />);
    const input = screen.getByPlaceholderText('Positioned input');
    expect(input.className).toContain('ml-4');
    expect(input.className).toContain('flex-1');
  });

  it('supports different input types', () => {
    render(<Input type="number" placeholder="Number input" />);
    const input = screen.getByPlaceholderText('Number input');
    expect(input.getAttribute('type')).toBe('number');
  });
});
