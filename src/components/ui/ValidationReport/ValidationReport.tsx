import React from 'react';
import { Card } from '../Card/Card';
import { 
  containerStyles, 
  headerStyles, 
  summaryStyles, 
  issueListStyles, 
  issueItemStyles, 
  errorIconStyles, 
  warningIconStyles,
  messageStyles,
  entityInfoStyles,
  emptyStateStyles
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

export function ValidationReport({
  issues,
  onIssueClick,
  className = '',
}: ValidationReportProps) {
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  const handleIssueClick = (issue: ValidationIssue) => {
    if (onIssueClick) {
      onIssueClick(issue);
    }
  };

  return (
    <Card variant="bordered" className={`${containerStyles} ${className}`}>
      <div className={headerStyles}>
        <h3 className="font-heading font-bold text-xl text-ink-900 m-0">
          Validation Report
        </h3>
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
          {issues.length === 0 && (
            <span className="text-forest font-semibold">
              No Issues
            </span>
          )}
        </div>
      </div>

      {issues.length === 0 ? (
        <div className={emptyStateStyles}>
          <span className="text-4xl">✓</span>
          <p className="text-ink-700 font-body">
            Configuration is valid. No issues detected.
          </p>
        </div>
      ) : (
        <>
          {errors.length > 0 && (
            <div className="mb-4">
              <h4 className="font-heading font-semibold text-lg text-crimson mb-2">
                Errors
              </h4>
              <div className={issueListStyles}>
                {errors.map((issue, index) => (
                  <div
                    key={index}
                    className={issueItemStyles}
                    onClick={() => handleIssueClick(issue)}
                    role={onIssueClick ? 'button' : undefined}
                    tabIndex={onIssueClick ? 0 : undefined}
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
              <h4 className="font-heading font-semibold text-lg text-amber mb-2">
                Warnings
              </h4>
              <div className={issueListStyles}>
                {warnings.map((issue, index) => (
                  <div
                    key={index}
                    className={issueItemStyles}
                    onClick={() => handleIssueClick(issue)}
                    role={onIssueClick ? 'button' : undefined}
                    tabIndex={onIssueClick ? 0 : undefined}
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
