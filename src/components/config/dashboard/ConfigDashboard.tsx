/**
 * Config Dashboard
 *
 * Configuration mode's entry point: the ruleset's validation status, the seven areas to configure,
 * and the action that produces a full validation report. Layout and composition only — the
 * decisions live in `useConfigDashboard`.
 *
 * **Validates: Requirements 18.5, 18.6, 19.4, 21.1-21.5**
 */

import { Link } from '@tanstack/react-router';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { ValidationReport } from '../../ui/ValidationReport/ValidationReport';
import { useConfigDashboard } from './useConfigDashboard';

export function ConfigDashboard() {
  const {
    config,
    isLoaded,
    sections,
    status,
    report,
    reportIssues,
    handleInitialize,
    handleValidate,
  } = useConfigDashboard();

  if (!isLoaded) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="p-8 text-center">
          <Text variant="body">Loading configuration...</Text>
        </Card>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="p-8 text-center">
          <Text variant="h2" className="mb-4">
            No Configuration Found
          </Text>
          <Text variant="body" className="mb-6">
            You need to initialize a configuration before you can start adding skills and other game
            elements.
          </Text>
          <Button variant="primary" onClick={handleInitialize}>
            Initialize New Configuration
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <Text variant="h1" as="h1" className="mb-2">
          Configuration Dashboard
        </Text>
        <Text variant="body-secondary">Configure your custom game system: {config.name}</Text>
      </div>

      <Card className="mb-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Text variant="h5" as="h2" className="mb-1">
              Validation
            </Text>
            {/* Requirement 18.6 — the status is here whether or not the User asked for it */}
            {status?.isValid ? (
              <Text variant="success" as="p">
                This ruleset is valid.
              </Text>
            ) : (
              <Text variant={status && status.errors.length > 0 ? 'error' : 'warning'} as="p">
                {status?.errors.length ?? 0} error(s) · {status?.warnings.length ?? 0} warning(s)
              </Text>
            )}
          </div>
          <Button variant="secondary" onClick={handleValidate}>
            Validate Configuration
          </Button>
        </div>

        {/* Shown once the User has asked, even when clean — the primitive has its own empty state */}
        {report && <ValidationReport issues={reportIssues} className="mt-4" />}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className="block rounded-lg hover:shadow-parchment-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            <Card className="h-full">
              <Text variant="h5" as="h2" className="mb-1">
                {section.label}
              </Text>
              <Text variant="body-small-secondary">{section.description}</Text>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
