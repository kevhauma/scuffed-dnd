/**
 * Validation Report Component
 *
 * Renders configuration validation issues grouped by severity.
 *
 * **Validates: Requirements 18.5, 21.1, 21.2, 21.3, 21.6, 21.7, 22.1-22.6**
 */

import { Card } from '../Card/Card';
import {
  containerStyles,
  emptyStateStyles,
  entityInfoStyles,
  headerStyles,
  issueItemStyles,
  issueListStyles,
  messageStyles,
  sectionListStyles,
  severityStyles,
  summaryStyles,
} from './ValidationReport.style';

/** Mirrors `engine/validator`'s severity — `information` is Concept 02's balance rule (SKL-03) */
export type ValidationSeverity = 'error' | 'warning' | 'information';

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
  const information = issues.filter((i) => i.severity === 'information');

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

  /**
   * One severity's heading and rows
   *
   * Written once rather than per severity: the three sections differ only in their heading, colour
   * and glyph, and TICKET-SKL-03's `information` would otherwise have been a third copy of markup
   * that already existed twice. Colours and the glyph come from `severityStyles`, so this carries
   * no class strings of its own.
   */
  const issueSection = (
    sectionIssues: ValidationIssue[],
    severity: ValidationSeverity,
    heading: string
  ) =>
    sectionIssues.length === 0 ? null : (
      <div>
        <h4 className={severityStyles[severity].heading}>{heading}</h4>
        <div className={issueListStyles}>
          {sectionIssues.map((issue) => (
            <div
              key={`${issue.category}-${issue.entityId ?? issue.entityName ?? ''}-${issue.message}`}
              className={issueItemStyles}
              {...interactionProps(issue)}
            >
              <span className={severityStyles[severity].icon}>
                {severityStyles[severity].glyph}
              </span>
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
    );

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
          {information.length > 0 && (
            <span className="text-royal font-semibold">
              {information.length} {information.length === 1 ? 'Note' : 'Notes'}
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
        <div className={sectionListStyles}>
          {issueSection(errors, 'error', 'Errors')}
          {issueSection(warnings, 'warning', 'Warnings')}
          {issueSection(information, 'information', 'Information')}
        </div>
      )}
    </Card>
  );
}
