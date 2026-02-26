import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ValidationReport, ValidationIssue } from './ValidationReport';

describe('ValidationReport', () => {
  const errorIssue: ValidationIssue = {
    severity: 'error',
    category: 'formula',
    message: 'Undefined variable XYZ',
    entityType: 'Stat',
    entityName: 'Health',
  };

  const warningIssue: ValidationIssue = {
    severity: 'warning',
    category: 'reference',
    message: 'Unused skill code',
    entityType: 'Skill',
    entityName: 'STR',
  };

  it('renders with no issues', () => {
    render(<ValidationReport issues={[]} />);
    expect(screen.getByText('Validation Report')).toBeDefined();
    expect(screen.getByText('No Issues')).toBeDefined();
    expect(screen.getByText(/Configuration is valid/)).toBeDefined();
  });

  it('displays error count correctly', () => {
    render(<ValidationReport issues={[errorIssue]} />);
    expect(screen.getByText('1 Error')).toBeDefined();
  });

  it('displays multiple errors count correctly', () => {
    render(<ValidationReport issues={[errorIssue, { ...errorIssue, message: 'Another error' }]} />);
    expect(screen.getByText('2 Errors')).toBeDefined();
  });

  it('displays warning count correctly', () => {
    render(<ValidationReport issues={[warningIssue]} />);
    expect(screen.getByText('1 Warning')).toBeDefined();
  });

  it('displays both errors and warnings', () => {
    render(<ValidationReport issues={[errorIssue, warningIssue]} />);
    expect(screen.getByText('1 Error')).toBeDefined();
    expect(screen.getByText('1 Warning')).toBeDefined();
  });

  it('renders error messages', () => {
    render(<ValidationReport issues={[errorIssue]} />);
    expect(screen.getByText('Undefined variable XYZ')).toBeDefined();
    expect(screen.getByText('Stat')).toBeDefined();
    expect(screen.getByText('"Health"')).toBeDefined();
  });

  it('renders warning messages', () => {
    render(<ValidationReport issues={[warningIssue]} />);
    expect(screen.getByText('Unused skill code')).toBeDefined();
    expect(screen.getByText('Skill')).toBeDefined();
    expect(screen.getByText('"STR"')).toBeDefined();
  });

  it('calls onIssueClick when issue is clicked', () => {
    const onIssueClick = vi.fn();
    render(<ValidationReport issues={[errorIssue]} onIssueClick={onIssueClick} />);
    const issueElement = screen.getByText('Undefined variable XYZ').parentElement?.parentElement;
    if (issueElement) {
      fireEvent.click(issueElement);
      expect(onIssueClick).toHaveBeenCalledWith(errorIssue);
    }
  });

  it('accepts className prop for positioning', () => {
    const { container } = render(<ValidationReport issues={[]} className="mb-4" />);
    const card = container.firstChild as HTMLElement;
    expect(card?.className).toContain('mb-4');
  });
});
