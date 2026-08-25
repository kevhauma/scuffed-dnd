/**
 * Violates `types-are-the-bottom-layer` (TICKET-DX-08)
 *
 * `shared/types/` is the bottom of `types → engine → services → stores → components → routes`, and
 * this points the arrow the wrong way: a declaration file that imports the parser is a declaration
 * file with a runtime, and the layer everything else is allowed to depend on freely stops being
 * free to depend on.
 */

import { parseFormula } from '../../engine/formula/parser';

export const aRuntimeInTheTypeLayer = parseFormula;
