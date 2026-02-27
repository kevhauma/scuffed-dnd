/**
 * Focus Stat Config Tests
 * 
 * Tests for focus stat bonus level configuration functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FocusStatConfig } from './FocusStatConfig';
import { useConfigStore } from '../../../stores/configStore';
import type { Configuration } from '../../../types';

// Mock the config store
vi.mock('../../../stores/configStore');

describe('FocusStatConfig', () => {
  const mockConfig: Configuration = {
    id: 'test-config',
    name: 'Test Config',
    version: '1.0.0',
    mainSkills: [],
    stats: [],
    specialitySkills: [],
    combatSkills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    focusStatBonusLevel: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSetFocusStatBonusLevel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useConfigStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = {
        config: mockConfig,
        setFocusStatBonusLevel: mockSetFocusStatBonusLevel,
      };
      return selector(state);
    });
  });

  it('renders focus stat configuration panel', () => {
    render(<FocusStatConfig />);
    
    expect(screen.getByText('Focus Stat Configuration')).toBeDefined();
    expect(screen.getByText(/Configure the bonus level characters receive/)).toBeDefined();
  });

  it('displays current focus stat bonus level', () => {
    render(<FocusStatConfig />);
    
    const input = screen.getByLabelText(/Focus Stat Bonus Level/);
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe('5');
  });

  it('shows current value when no changes', () => {
    render(<FocusStatConfig />);
    
    expect(screen.getByText(/Current focus stat bonus: 5 levels/)).toBeDefined();
  });

  it('enables save button when value changes', () => {
    render(<FocusStatConfig />);
    
    const input = screen.getByLabelText(/Focus Stat Bonus Level/);
    fireEvent.change(input, { target: { value: '10' } });
    
    const saveButton = screen.getByText('Save Changes');
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows reset button when value changes', () => {
    render(<FocusStatConfig />);
    
    const input = screen.getByLabelText(/Focus Stat Bonus Level/);
    fireEvent.change(input, { target: { value: '10' } });
    
    expect(screen.getByText('Reset')).toBeDefined();
  });

  it('calls setFocusStatBonusLevel when save is clicked', () => {
    render(<FocusStatConfig />);
    
    const input = screen.getByLabelText(/Focus Stat Bonus Level/);
    fireEvent.change(input, { target: { value: '10' } });
    
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);
    
    expect(mockSetFocusStatBonusLevel).toHaveBeenCalledWith(10);
  });

  it('resets value when reset button is clicked', () => {
    render(<FocusStatConfig />);
    
    const input = screen.getByLabelText(/Focus Stat Bonus Level/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '10' } });
    
    expect(input.value).toBe('10');
    
    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);
    
    expect(input.value).toBe('5');
  });

  it('shows error for negative values', () => {
    render(<FocusStatConfig />);
    
    const input = screen.getByLabelText(/Focus Stat Bonus Level/);
    fireEvent.change(input, { target: { value: '-5' } });
    
    expect(screen.getByText(/Please enter a valid non-negative number/)).toBeDefined();
  });

  it('shows error for invalid input', () => {
    render(<FocusStatConfig />);
    
    const input = screen.getByLabelText(/Focus Stat Bonus Level/);
    fireEvent.change(input, { target: { value: 'abc' } });
    
    expect(screen.getByText(/Please enter a valid non-negative number/)).toBeDefined();
  });

  it('disables save button for invalid input', () => {
    render(<FocusStatConfig />);
    
    const input = screen.getByLabelText(/Focus Stat Bonus Level/);
    fireEvent.change(input, { target: { value: '-5' } });
    
    const saveButton = screen.getByText('Save Changes') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('shows example preview for valid positive values', () => {
    render(<FocusStatConfig />);
    
    const input = screen.getByLabelText(/Focus Stat Bonus Level/);
    fireEvent.change(input, { target: { value: '8' } });
    
    expect(screen.getByText(/Example:/)).toBeDefined();
    expect(screen.getByText(/their effective STR level becomes 18/)).toBeDefined();
  });

  it('does not show example preview for zero value', () => {
    render(<FocusStatConfig />);
    
    const input = screen.getByLabelText(/Focus Stat Bonus Level/);
    fireEvent.change(input, { target: { value: '0' } });
    
    expect(screen.queryByText(/Example:/)).toBeNull();
  });

  it('shows no config message when config is null', () => {
    (useConfigStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = {
        config: null,
        setFocusStatBonusLevel: mockSetFocusStatBonusLevel,
      };
      return selector(state);
    });

    render(<FocusStatConfig />);
    
    expect(screen.getByText(/No configuration loaded/)).toBeDefined();
  });

  it('accepts zero as a valid value', () => {
    render(<FocusStatConfig />);
    
    const input = screen.getByLabelText(/Focus Stat Bonus Level/);
    fireEvent.change(input, { target: { value: '0' } });
    
    const saveButton = screen.getByText('Save Changes') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
    
    fireEvent.click(saveButton);
    expect(mockSetFocusStatBonusLevel).toHaveBeenCalledWith(0);
  });

  it('displays informational text about focus stats', () => {
    render(<FocusStatConfig />);
    
    expect(screen.getByText(/What is a Focus Stat\?/)).toBeDefined();
    expect(screen.getByText(/During character creation/)).toBeDefined();
  });
});
