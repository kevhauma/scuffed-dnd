import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormulaEditor } from './FormulaEditor';

describe('FormulaEditor', () => {
  const availableVariables = ['STR', 'DEX', 'CON', 'INT'];

  it('renders with label when provided', () => {
    render(
      <FormulaEditor
        value=""
        onChange={() => {}}
        availableVariables={availableVariables}
        label="Formula"
      />
    );
    expect(screen.getByText('Formula')).toBeDefined();
  });

  it('calls onChange when input value changes', () => {
    const onChange = vi.fn();
    render(
      <FormulaEditor
        value=""
        onChange={onChange}
        availableVariables={availableVariables}
      />
    );
    const input = screen.getByPlaceholderText(/Enter formula/);
    fireEvent.change(input, { target: { value: 'STR + DEX' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('validates formula and shows error for undefined variables', () => {
    const onValidate = vi.fn();
    const { rerender } = render(
      <FormulaEditor
        value=""
        onChange={() => {}}
        availableVariables={availableVariables}
        onValidate={onValidate}
      />
    );

    // Valid formula
    rerender(
      <FormulaEditor
        value="STR + DEX"
        onChange={() => {}}
        availableVariables={availableVariables}
        onValidate={onValidate}
      />
    );
    expect(onValidate).toHaveBeenCalledWith(true);

    // Invalid formula with undefined variable
    rerender(
      <FormulaEditor
        value="STR + XYZ"
        onChange={() => {}}
        availableVariables={availableVariables}
        onValidate={onValidate}
      />
    );
    expect(screen.getByText(/Undefined variables: XYZ/)).toBeDefined();
  });

  it('accepts className prop for positioning', () => {
    render(
      <FormulaEditor
        value=""
        onChange={() => {}}
        availableVariables={availableVariables}
        className="mb-4"
      />
    );
    const container = screen.getByPlaceholderText(/Enter formula/).parentElement?.parentElement;
    expect(container?.className).toContain('mb-4');
  });

  it('uses monospace font for input', () => {
    render(
      <FormulaEditor
        value="STR + DEX"
        onChange={() => {}}
        availableVariables={availableVariables}
      />
    );
    const input = screen.getByDisplayValue('STR + DEX');
    expect(input.className).toContain('font-mono');
  });
});
