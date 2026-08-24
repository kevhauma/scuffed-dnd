import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Label } from './Label';

describe('Label', () => {
  it('renders with default styles', () => {
    render(<Label>Field label</Label>);
    const label = screen.getByText('Field label');
    expect(label).toBeDefined();
    expect(label.className).toContain('font-heading');
    expect(label.className).toContain('text-ink-800');
    // Engraved caption, not a second run of body text: the label is a different kind of thing
    // from the value under it and now looks like one
    expect(label.className).toContain('uppercase');
  });

  it('shows required indicator when required prop is true', () => {
    render(<Label required>Required field</Label>);
    const label = screen.getByText('Required field');
    expect(label).toBeDefined();
    const asterisk = screen.getByText('*');
    expect(asterisk).toBeDefined();
    expect(asterisk.className).toContain('text-crimson');
  });

  it('does not show required indicator by default', () => {
    render(<Label>Optional field</Label>);
    const asterisk = screen.queryByText('*');
    expect(asterisk).toBeNull();
  });

  it('accepts className prop for positioning', () => {
    render(<Label className="mb-2">Positioned label</Label>);
    const label = screen.getByText('Positioned label');
    expect(label.className).toContain('mb-2');
  });

  it('accepts htmlFor prop', () => {
    render(<Label htmlFor="input-id">Label with htmlFor</Label>);
    const label = screen.getByText('Label with htmlFor');
    expect(label.getAttribute('for')).toBe('input-id');
  });
});
