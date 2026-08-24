/**
 * Config Transfer Panel
 *
 * Rename, export and import for the current ruleset. Files are how the User keeps more than one
 * ruleset — the Application itself holds exactly one.
 *
 * **One deliberate exception to the "no raw HTML controls" rule:** a `<input type="file">` cannot
 * be styled and has no base-component equivalent, so it is kept visually hidden and driven from a
 * `Button`. Every control the User actually sees is still a base component.
 *
 * **Validates: Requirements 1.1, 1.4, 1.5, 1.6, 18.5, 21.1-21.5**
 */

import { useId, useRef } from 'react';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Text } from '../../ui/Text/Text';
import { ValidationReport } from '../../ui/ValidationReport/ValidationReport';
import { useConfigTransfer } from './useConfigTransfer';

export function ConfigTransferPanel() {
  const {
    config,
    name,
    canRename,
    pendingFileName,
    importErrors,
    importReport,
    importReportIssues,
    handleExport,
    handleFileChosen,
    handleCancelImport,
    handleConfirmImport,
    handleDraftName,
    handleRename,
  } = useConfigTransfer();

  const nameFieldId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!config) return null;

  return (
    <Card className="mb-8 p-6">
      <Text variant="h5" as="h2" className="mb-3">
        Ruleset File
      </Text>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <FormField
          label="Name"
          id={nameFieldId}
          value={name}
          onChange={(event) => handleDraftName(event.target.value)}
          className="grow"
        />
        <Button variant="secondary" disabled={!canRename} onClick={handleRename}>
          Rename
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={handleExport}>
          Export Configuration
        </Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Import Configuration
        </Button>
        <Text variant="body-small-secondary" as="span">
          Exporting writes a JSON file; importing replaces this ruleset with one.
        </Text>

        {/* Hidden on purpose — see the note at the top of this file */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Configuration file"
          className="sr-only"
          onChange={(event) => {
            handleFileChosen(event.target.files?.[0] ?? null);
            // Clear the input so choosing the same file twice fires a change both times
            event.target.value = '';
          }}
        />
      </div>

      {importErrors.length > 0 && (
        <div className="mt-4">
          <Text variant="error" as="p" className="mb-1">
            That file was not imported. Your current ruleset is unchanged.
          </Text>
          <ul className="list-disc pl-5">
            {importErrors.map((message) => (
              <li key={message}>
                <Text variant="error" as="span">
                  {message}
                </Text>
              </li>
            ))}
          </ul>
        </div>
      )}

      {importReport && (
        <div className="mt-4">
          <Text variant={importReport.isValid ? 'success' : 'warning'} as="p" className="mb-1">
            {importReport.isValid
              ? 'Imported ruleset — no issues found.'
              : 'Imported ruleset — the checks below found problems to fix.'}
          </Text>
          {importReportIssues.length > 0 && <ValidationReport issues={importReportIssues} />}
        </div>
      )}

      <Dialog
        open={pendingFileName !== null}
        onClose={handleCancelImport}
        title="Replace Configuration"
      >
        <Text variant="body" className="mb-6">
          Importing {pendingFileName} replaces "{config.name}" and everything in it. Existing
          characters are not deleted, but they were built on the current ruleset. Export it first if
          you want to keep it.
        </Text>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleCancelImport}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmImport}>
            Replace Configuration
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
