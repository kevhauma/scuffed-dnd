/**
 * Violates `ui-primitives-are-leaves` (TICKET-DX-08)
 *
 * A base component reading the configuration store. It would work, and it would quietly end the
 * primitive's reusability: every caller now inherits a dependency on a ruleset being loaded, and
 * the component can no longer be rendered by a test, a different feature, or a page that has no
 * configuration at all.
 *
 * It lives in `boundaryFixtures/` rather than beside a component so `libraryConventions.test.ts`
 * can skip it — the library's own conventions are about components, and this is not one.
 */

import { useConfigStore } from '../../../stores/configStore';

export const aStoreInAPrimitive = useConfigStore;
