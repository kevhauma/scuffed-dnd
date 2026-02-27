/**
 * Materials Config Panel Tests
 * 
 * Basic tests for the materials configuration panel.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MaterialsConfigPanel } from './MaterialsConfigPanel';
import { useConfigStore } from '../../../stores/configStore';

describe('MaterialsConfigPanel', () => {
  beforeEach(() => {
    // Initialize empty config
    useConfigStore.getState().initializeConfig('Test Config');
  });

  it('renders without crashing', () => {
    render(<MaterialsConfigPanel />);
    expect(screen.getByText('Materials')).toBeInTheDocument();
  });

  it('displays add category button', () => {
    render(<MaterialsConfigPanel />);
    expect(screen.getByText('Add Category')).toBeInTheDocument();
  });

  it('shows empty state when no categories exist', () => {
    render(<MaterialsConfigPanel />);
    expect(screen.getByText(/No material categories configured yet/i)).toBeInTheDocument();
  });

  it('shows warning when no skills configured', () => {
    render(<MaterialsConfigPanel />);
    expect(screen.getByText(/No skills configured yet/i)).toBeInTheDocument();
  });

  it('shows warning when no currency tiers configured', () => {
    render(<MaterialsConfigPanel />);
    expect(screen.getByText(/No currency tiers configured yet/i)).toBeInTheDocument();
  });
});
