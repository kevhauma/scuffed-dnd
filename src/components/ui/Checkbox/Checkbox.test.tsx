import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders with default styles', () => {
    render(<Checkbox />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDefined();
    expect(checkbox.className).toContain('bg-white');
    expect(checkbox.className).toContain('border-stone-200');
  });

  it('renders with label when provided', () => {
    render(<Checkbox label="Accept terms" />);
    const label = screen.getByText('Accept terms');
    expect(label).toBeDefined();
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDefined();
  });

  it('applies disabled styles when disabled', () => {
    render(<Checkbox disabled label="Disabled checkbox" />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.className).toContain('opacity-50');
    expect(checkbox.className).toContain('cursor-not-allowed');
  });

  it('accepts className prop for positioning', () => {
    render(<Checkbox className="ml-4" label="Positioned checkbox" />);
    const container = screen.getByRole('checkbox').parentElement;
    expect(container?.className).toContain('ml-4');
  });

  it('can be checked', () => {
    render(<Checkbox checked readOnly />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
});
