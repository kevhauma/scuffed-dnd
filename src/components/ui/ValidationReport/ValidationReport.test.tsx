import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type ValidationIssue, ValidationReport } from './ValidationReport';

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

  const informationIssue: ValidationIssue = {
    severity: 'information',
    category: 'Balance',
    message: 'Skill "Overweighted" has stat weights totalling 0.9',
    entityType: 'skill',
    entityName: 'Overweighted',
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

  /**
   * The third severity (TICKET-SKL-03). Its own heading and count, so an observation is never read
   * as a defect the User has to clear.
   */
  it('displays information under its own heading and count', () => {
    render(<ValidationReport issues={[informationIssue]} />);

    expect(screen.getByText('1 Note')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Information' })).toBeDefined();
    expect(screen.getByText('Skill "Overweighted" has stat weights totalling 0.9')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Warnings' })).toBeNull();
    expect(screen.queryByText('No Issues')).toBeNull();
  });

  it('keeps the three severities in separate sections', () => {
    render(<ValidationReport issues={[errorIssue, warningIssue, informationIssue]} />);

    expect(screen.getByText('1 Error')).toBeDefined();
    expect(screen.getByText('1 Warning')).toBeDefined();
    expect(screen.getByText('1 Note')).toBeDefined();
    for (const heading of ['Errors', 'Warnings', 'Information']) {
      expect(screen.getByRole('heading', { name: heading })).toBeDefined();
    }
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
