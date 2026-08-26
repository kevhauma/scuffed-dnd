/**
 * What a referential validation report is (TICKET-IO-04)
 *
 * **Moved down a rung, not invented here.** These three declarations lived in
 * [`engine/validator.ts`](../engine/validator.ts) — which still exports them, so nothing that
 * imported them from there had to change — until IO-04 put a report *on the wire*: `POST
 * /api/rulesets/import` answers with the created ruleset and its report (v3 Req 35.3), and
 * `types/api.ts` is a declaration file that `types-are-the-bottom-layer` forbids from importing
 * anything with a runtime in it. A shape both the engine and the wire contract name belongs at the
 * bottom rung, which is here.
 *
 * The alternative was restating the report's four fields in `types/api.ts`, and that module's own
 * docblock is about exactly why not: a second declaration of a shape both roots use is one that can
 * drift silently.
 *
 * Nothing here executes. `validateConfiguration` — the thing that *builds* a report — stays in the
 * engine, where it can reach the formula validator and the reference resolver.
 */

/**
 * Validation issue severity levels
 *
 * `information` arrived with TICKET-SKL-03 for Concept 02's balance rule, which is explicitly *not*
 * a mistake: a skill weighted well above ~0.5 is a deliberate choice as often as an accident, and
 * reporting it as a warning would train the User to ignore warnings. It never affects `isValid`.
 *
 * **Still a bare union, deliberately.** CLAUDE.md's rule is that the pre-existing ones are converted
 * *when touched* rather than swept — and this move touches the declaration's address, not the
 * declaration: every one of the forty call sites that author a severity is unchanged, and rewriting
 * them all inside a feature ticket is the sweep the rule rules out. The ticket that next edits what
 * a severity *means* is the one that owes the const object.
 */
export type ValidationSeverity = 'error' | 'warning' | 'information';

/**
 * Validation issue
 */
export interface ValidationIssue {
  severity: ValidationSeverity;
  category: string;
  message: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
}

/**
 * Validation report containing all detected issues
 */
export interface ValidationReport {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Observations that are worth stating and are not defects — see {@link ValidationSeverity} */
  information: ValidationIssue[];
  timestamp: string;
}
