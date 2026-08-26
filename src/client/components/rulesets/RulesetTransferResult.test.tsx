/**
 * What an import or an upload reports back (TICKET-IO-04)
 *
 * The case that earns its place is the last one: **a ruleset with reference errors was still
 * created**, and the wording has to say that rather than reading as a refusal. v3 Req 35.3 makes the
 * report advisory on purpose — a file the User cannot import is a file they cannot repair in the app
 * — so "it was kept as it is" and a list of errors have to sit on screen together without
 * contradicting each other.
 *
 * **Validates: v3 Req 35.3, 35.5**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RulesetTransferResult } from './RulesetTransferResult';
import type { TransferResult } from './useRulesetTransfer';

/** A clean import, unless told otherwise */
function result(overrides: Partial<TransferResult> = {}): TransferResult {
  return {
    name: 'Ducklets',
    charactersCreated: 0,
    report: { isValid: true, errors: [], warnings: [], information: [], timestamp: 'now' },
    issues: [],
    ...overrides,
  };
}

describe('RulesetTransferResult', () => {
  it('renders nothing when nothing has happened', () => {
    const { container } = render(<RulesetTransferResult result={null} onDismiss={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  it('names the created ruleset rather than saying “imported” (v3 Req 35.5)', () => {
    render(<RulesetTransferResult result={result()} onDismiss={vi.fn()} />);

    expect(screen.getByText(/“Ducklets”/)).toBeTruthy();
    expect(screen.getByText(/no issues found/)).toBeTruthy();
  });

  it('counts the characters that came with it', () => {
    render(<RulesetTransferResult result={result({ charactersCreated: 3 })} onDismiss={vi.fn()} />);

    expect(screen.getByText(/3 characters/)).toBeTruthy();
  });

  it('says a broken ruleset was kept, and lists what is wrong with it', () => {
    const issues = [
      {
        severity: 'error' as const,
        category: 'reference',
        message: 'ladder no-such-ladder missing',
      },
    ];

    render(
      <RulesetTransferResult
        result={result({
          report: {
            isValid: false,
            errors: issues,
            warnings: [],
            information: [],
            timestamp: 'now',
          },
          issues,
        })}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText(/It was kept as it is/)).toBeTruthy();
    expect(screen.getByText(/no-such-ladder/)).toBeTruthy();
  });

  it('can be dismissed', () => {
    const onDismiss = vi.fn();
    render(<RulesetTransferResult result={result()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
