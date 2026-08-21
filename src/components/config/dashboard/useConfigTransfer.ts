/**
 * Config Transfer Hook
 *
 * Export, import and rename for the one configuration the Application holds. Moving a ruleset
 * between browsers, or keeping a spare, is done with files — there is no in-app configuration
 * picker, by decision.
 *
 * Import validates twice, deliberately: **structurally** through `services/importExport.ts`, which
 * refuses to apply data that cannot be rendered, and then **referentially** through
 * `engine/validator.ts`, which reports a ruleset that parses but does not hang together. The second
 * is only a report — a broken-but-readable ruleset is still applied, because refusing it would
 * leave the User unable to repair the file in the app.
 *
 * **Validates: Requirements 1.1, 1.4, 1.5, 1.6, 18.5**
 */

import { useState } from 'react';
import type { ValidationReport } from '../../../engine/validator';
import { validateConfiguration } from '../../../engine/validator';
import {
  downloadConfiguration,
  importConfigurationFromFile,
  ValidationError,
} from '../../../services/importExport';
import { useConfigStore } from '../../../stores/configStore';

export function useConfigTransfer() {
  const config = useConfigStore((state) => state.config);
  const replaceConfig = useConfigStore((state) => state.replaceConfig);
  const renameConfig = useConfigStore((state) => state.renameConfig);

  /** The file the User picked, held until they confirm the replacement */
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  /** Why the chosen file could not be applied — one entry per reason */
  const [importErrors, setImportErrors] = useState<string[]>([]);

  /** The reference check on what was just imported, shown once it lands */
  const [importReport, setImportReport] = useState<ValidationReport | null>(null);

  /**
   * The name being edited, committed on submit rather than on every keystroke
   *
   * `null` means "not being edited", so the field falls back to the stored name and follows an
   * import that replaced it. Held here rather than in the panel (CR-43): form state is the hook's,
   * like every other configuration domain.
   */
  const [draftName, setDraftName] = useState<string | null>(null);
  const name = draftName ?? config?.name ?? '';

  const handleExport = () => {
    if (!config) return;

    // The service owns the Blob and the download; this only decides when
    downloadConfiguration(config);
  };

  const handleFileChosen = (file: File | null) => {
    setImportErrors([]);
    setImportReport(null);
    setPendingFile(file);
  };

  const handleCancelImport = () => {
    setPendingFile(null);
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;

    try {
      const imported = await importConfigurationFromFile(pendingFile);

      // Persistence belongs to the store action
      replaceConfig(imported);
      setImportReport(validateConfiguration(imported));
      setPendingFile(null);
    } catch (error) {
      // A rejected file leaves the current configuration exactly as it was
      setImportErrors(
        error instanceof ValidationError
          ? error.errors
          : [error instanceof Error ? error.message : String(error)]
      );
      setPendingFile(null);
    }
  };

  const handleDraftName = (value: string) => {
    setDraftName(value);
  };

  /** Rename to the drafted name, unless it is blank or unchanged; either way the draft is released */
  const handleRename = () => {
    const trimmed = name.trim();
    if (config && trimmed !== '' && trimmed !== config.name) {
      renameConfig(trimmed);
    }
    setDraftName(null);
  };

  return {
    config,
    name,
    canRename: name.trim() !== '',
    pendingFileName: pendingFile?.name ?? null,
    importErrors,
    importReport,
    importReportIssues: importReport
      ? [...importReport.errors, ...importReport.warnings, ...importReport.information]
      : [],
    handleExport,
    handleFileChosen,
    handleCancelImport,
    handleConfirmImport,
    handleDraftName,
    handleRename,
  };
}
