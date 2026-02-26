import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from './Select';

describe('Select', () => {
  const options = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3' },
  ];

  it('renders with default styles', () => {
    render(<Select options={options} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeDefined();
    expect(select.className).toContain('bg-white');
    expect(select.className).toContain('border-stone-200');
  });

  it('renders all options', () => {
    render(<Select options={options} />);
    const select = screen.getByRole('combobox');
    const optionElements = select.querySelectorAll('option');
    expect(optionElements.length).toBe(3);
  });

  it('renders placeholder when provided', () => {
    render(<Select options={options} placeholder="Select an option" />);
    const placeholderOption = screen.getByText('Select an option');
    expect(placeholderOption).toBeDefined();
    expect(placeholderOption.getAttribute('disabled')).toBe('');
  });

  it('applies disabled styles when disabled', () => {
    render(<Select options={options} disabled />);
    const select = screen.getByRole('combobox');
    expect(select.className).toContain('opacity-50');
    expect(select.className).toContain('cursor-not-allowed');
  });

  it('accepts className prop for positioning', () => {
    render(<Select options={options} className="ml-4 flex-1" />);
    const select = screen.getByRole('combobox');
    expect(select.className).toContain('ml-4');
    expect(select.className).toContain('flex-1');
  });
});
