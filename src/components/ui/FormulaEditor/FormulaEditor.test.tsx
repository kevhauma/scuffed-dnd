import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
    render(<FormulaEditor value="" onChange={onChange} availableVariables={availableVariables} />);
    const input = screen.getByPlaceholderText(/Enter formula/);
    fireEvent.change(input, { target: { value: 'STR + DEX' } });
    expect(onChange).toHaveBeenCalled();
  });

  // RESTORED (CR-33): validation is derived from the props now, so a prop-driven `value` change
  // reports rather than leaving the previous verdict on screen. It was removed in TICKET-DX-01
  // because the component only validated inside its change handler.
  it('validates a formula that arrives by prop, not only one that is typed', () => {
    const onValidate = vi.fn();
    const { rerender } = render(
      <FormulaEditor
        value="STR + 1"
        onChange={() => {}}
        availableVariables={availableVariables}
        onValidate={onValidate}
      />
    );

    expect(onValidate).toHaveBeenLastCalledWith(true, undefined);
    expect(screen.queryByText(/Unknown variable/i)).toBeNull();

    rerender(
      <FormulaEditor
        value="WIS + 1"
        onChange={() => {}}
        availableVariables={availableVariables}
        onValidate={onValidate}
      />
    );

    expect(screen.getByText(/WIS/)).toBeDefined();
    expect(onValidate).toHaveBeenLastCalledWith(false, expect.stringContaining('WIS'));
  });

  it('revalidates when the available variables change under it (CR-33)', () => {
    const { rerender } = render(
      <FormulaEditor value="STR + 1" onChange={() => {}} availableVariables={availableVariables} />
    );
    expect(screen.getByDisplayValue('STR + 1').className).not.toContain('border-crimson');

    // The stat was renamed elsewhere: the displayed formula is invalid now and must say so
    rerender(<FormulaEditor value="STR + 1" onChange={() => {}} availableVariables={['MIGHT']} />);

    expect(screen.getByText(/STR/)).toBeDefined();
    expect(screen.getByDisplayValue('STR + 1').className).toContain('border-crimson');
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
