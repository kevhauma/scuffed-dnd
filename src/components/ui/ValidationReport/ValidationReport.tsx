import { Card } from '../Card/Card';
import {
  containerStyles,
  emptyStateStyles,
  entityInfoStyles,
  errorIconStyles,
  headerStyles,
  issueItemStyles,
  issueListStyles,
  messageStyles,
  summaryStyles,
  warningIconStyles,
} from './ValidationReport.style';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  category: string;
  message: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
}

export interface ValidationReportProps {
  issues: ValidationIssue[];
  onIssueClick?: (issue: ValidationIssue) => void;
  className?: string;
}

export function ValidationReport({ issues, onIssueClick, className = '' }: ValidationReportProps) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const handleIssueClick = (issue: ValidationIssue) => {
    if (onIssueClick) {
      onIssueClick(issue);
    }
  };

  /**
   * Interaction props, attached only when the row is actually interactive
   *
   * A row with no `onIssueClick` is static text: giving it a click handler, a button role and a tab
   * stop would announce it to assistive tech as something you can activate when nothing happens.
   */
  const interactionProps = (issue: ValidationIssue) =>
    onIssueClick
      ? {
          onClick: () => handleIssueClick(issue),
          onKeyDown: (event: React.KeyboardEvent) => handleIssueKeyDown(event, issue),
          role: 'button',
          tabIndex: 0,
        }
      : {};

  /**
   * Keyboard equivalent of clicking an issue
   *
   * An issue row is only interactive when `onIssueClick` is given, and then it takes `role="button"`
   * and a tab stop — so it has to answer Enter and Space like a real button does.
   */
  const handleIssueKeyDown = (event: React.KeyboardEvent, issue: ValidationIssue) => {
    if (!onIssueClick) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    onIssueClick(issue);
  };

  return (
    <Card variant="bordered" className={`${containerStyles} ${className}`}>
      <div className={headerStyles}>
        <h3 className="font-heading font-bold text-xl text-ink-900 m-0">Validation Report</h3>
        <div className={summaryStyles}>
          {errors.length > 0 && (
            <span className="text-crimson font-semibold">
              {errors.length} {errors.length === 1 ? 'Error' : 'Errors'}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="text-amber font-semibold">
              {warnings.length} {warnings.length === 1 ? 'Warning' : 'Warnings'}
            </span>
          )}
          {issues.length === 0 && <span className="text-forest font-semibold">No Issues</span>}
        </div>
      </div>

      {issues.length === 0 ? (
        <div className={emptyStateStyles}>
          <span className="text-4xl">✓</span>
          <p className="text-ink-700 font-body">Configuration is valid. No issues detected.</p>
        </div>
      ) : (
        <>
          {errors.length > 0 && (
            <div className="mb-4">
              <h4 className="font-heading font-semibold text-lg text-crimson mb-2">Errors</h4>
              <div className={issueListStyles}>
                {errors.map((issue) => (
                  <div
                    key={`${issue.category}-${issue.entityId ?? issue.entityName ?? ''}-${issue.message}`}
                    className={issueItemStyles}
                    {...interactionProps(issue)}
                  >
                    <span className={errorIconStyles}>✕</span>
                    <div className="flex-1">
                      <div className={messageStyles}>{issue.message}</div>
                      {(issue.entityType || issue.entityName) && (
                        <div className={entityInfoStyles}>
                          {issue.entityType && <span>{issue.entityType}</span>}
                          {issue.entityName && <span>"{issue.entityName}"</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div>
              <h4 className="font-heading font-semibold text-lg text-amber mb-2">Warnings</h4>
              <div className={issueListStyles}>
                {warnings.map((issue) => (
                  <div
                    key={`${issue.category}-${issue.entityId ?? issue.entityName ?? ''}-${issue.message}`}
                    className={issueItemStyles}
                    {...interactionProps(issue)}
                  >
                    <span className={warningIconStyles}>⚠</span>
                    <div className="flex-1">
                      <div className={messageStyles}>{issue.message}</div>
                      {(issue.entityType || issue.entityName) && (
                        <div className={entityInfoStyles}>
                          {issue.entityType && <span>{issue.entityType}</span>}
                          {issue.entityName && <span>"{issue.entityName}"</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
