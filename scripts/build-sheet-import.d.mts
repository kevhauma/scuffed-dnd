/**
 * Types for the sheet-import build script.
 *
 * Hand-written because the script itself is plain ESM run by `node` — it must not need a build
 * step to execute. The declarations exist so `src/services/sheetImport.test.ts` can import it
 * without `tsc --noEmit` falling back to `any`.
 *
 * `Configuration` is deliberately not imported here: the script's job is to produce untrusted JSON
 * that `validateConfiguration` then checks. Typing its output as an already-valid `Configuration`
 * would assume the very thing the test proves.
 */

/** One fragment file, as read from `docs/imports/` */
export interface SheetImportFragment {
  feature: string;
  title: string;
  tickets: string[];
  concept: string;
  source: { spreadsheet: string; exportedAt: string; ranges: string[] };
  confidence: string;
  notes: string[];
  data: Record<string, unknown[]>;
}

/** A fragment paired with the filename it came from */
export interface SheetImportEntry {
  name: string;
  fragment: SheetImportFragment;
}

export declare const IMPORTS_DIR: string;
export declare const OUTPUT_FILE: string;

export declare function readFragments(dir?: string): SheetImportEntry[];
export declare function buildConfiguration(entries: SheetImportEntry[]): Record<string, unknown>;
export declare function collisions(config: Record<string, unknown>): string[];
export declare function renderConfiguration(dir?: string): string;
