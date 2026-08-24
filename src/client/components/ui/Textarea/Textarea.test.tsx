import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('renders with default styles', () => {
    render(<Textarea placeholder="Test textarea" />);
    const textarea = screen.getByPlaceholderText('Test textarea');
    expect(textarea).toBeDefined();
    expect(textarea.className).toContain('bg-parchment-100');
    expect(textarea.className).toContain('border-ink-700/40');
    expect(textarea.className).toContain('shadow-carved');
    expect(textarea.className).toContain('resize-y');
  });

  it('applies error styles when error prop is true (CR-32)', () => {
    render(<Textarea error placeholder="Error textarea" />);
    const textarea = screen.getByPlaceholderText('Error textarea');
    expect(textarea.className).toContain('border-crimson');
  });

  it('applies disabled styles when disabled', () => {
    render(<Textarea disabled placeholder="Disabled textarea" />);
    const textarea = screen.getByPlaceholderText('Disabled textarea');
    expect(textarea.className).toContain('opacity-60');
    expect(textarea.className).toContain('cursor-not-allowed');
    expect(textarea.className).toContain('resize-none');
  });

  it('accepts className prop for positioning', () => {
    render(<Textarea className="ml-4 flex-1" placeholder="Positioned textarea" />);
    const textarea = screen.getByPlaceholderText('Positioned textarea');
    expect(textarea.className).toContain('ml-4');
    expect(textarea.className).toContain('flex-1');
  });

  it('sets default rows to 4', () => {
    render(<Textarea placeholder="Default rows" />);
    const textarea = screen.getByPlaceholderText('Default rows');
    expect(textarea.getAttribute('rows')).toBe('4');
  });

  it('accepts custom rows prop', () => {
    render(<Textarea rows={8} placeholder="Custom rows" />);
    const textarea = screen.getByPlaceholderText('Custom rows');
    expect(textarea.getAttribute('rows')).toBe('8');
  });
});
