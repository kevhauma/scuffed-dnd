/**
 * The root boundary, proven by modules that break it (TICKET-DX-07)
 *
 * `yarn run check` cruises `src/` and reports nothing, which is exactly what a *broken* rule set
 * also does. So every rule in [`.dependency-cruiser.mjs`](../.dependency-cruiser.mjs) is asserted
 * here against a module that really violates it — a real module, in a real root, with a real
 * forbidden import — plus one legal crossing that must come back clean, so "refuses everything"
 * cannot pass for "enforces the boundary".
 *
 * The fixtures live in `boundaryFixtures/` directories inside the three roots, which the enforcing
 * config excludes for the obvious reason. This suite cruises those directories with the same rule
 * set and the exclusion lifted.
 *
 * **Validates: v3 Req 50, Req 51.2; overview D14**
 */

import { cruise } from 'dependency-cruiser';
import { describe, expect, it } from 'vitest';
import depcruiseConfig from '../.dependency-cruiser.mjs';

const FIXTURE_ROOTS = [
  'src/client/boundaryFixtures',
  'src/server/boundaryFixtures',
  'src/shared/boundaryFixtures',
];

/**
 * The real rules, with the fixture exemption on each rule's `from` lifted
 *
 * The enforcing config scopes every rule away from `boundaryFixtures/` as a *source* so the
 * fixtures can exist without failing `yarn run check`. Everything else about the rule — its `to`,
 * its dependency types — is the config's own, so what is asserted below is what is enforced.
 */
const rules = (depcruiseConfig.forbidden ?? []).map((rule) => {
  const { pathNot: _lifted, ...from } = rule.from;
  return { ...rule, from };
});

/** Every violation the fixtures produce, cruised once for the whole suite */
const violations = await (async () => {
  const result = await cruise(FIXTURE_ROOTS, {
    ...depcruiseConfig.options,
    validate: true,
    ruleSet: { forbidden: rules },
  });

  if (typeof result.output === 'string') throw new Error('expected a cruise result, not a report');

  return result.output.summary.violations;
})();

/** The rule names reported against one fixture module */
function rulesBrokenBy(module: string): string[] {
  return violations
    .filter((violation) => violation.from.replace(/\\/g, '/') === module)
    .map((violation) => violation.rule.name);
}

describe('the three-root boundary', () => {
  it('refuses client/ reaching into server/', () => {
    expect(rulesBrokenBy('src/client/boundaryFixtures/reachesServer.ts')).toContain(
      'no-client-to-server'
    );
  });

  it('refuses server/ reaching into client/', () => {
    expect(rulesBrokenBy('src/server/boundaryFixtures/reachesClient.ts')).toContain(
      'no-server-to-client'
    );
  });

  it('refuses shared/ reaching into either sibling', () => {
    expect(rulesBrokenBy('src/shared/boundaryFixtures/reachesClient.ts')).toContain(
      'no-shared-to-siblings'
    );
    expect(rulesBrokenBy('src/shared/boundaryFixtures/reachesServer.ts')).toContain(
      'no-shared-to-siblings'
    );
  });

  it('refuses a type-only crossing, which compiles away but still couples the roots', () => {
    // The fixture that makes `tsPreCompilationDeps: true` load-bearing — every other one uses a
    // value import, so without this the option could be flipped off and all of them stay green
    expect(rulesBrokenBy('src/server/boundaryFixtures/reachesClientTypeOnly.ts')).toContain(
      'no-server-to-client'
    );
  });

  it('refuses either sibling reaching anything under src/ that is not itself or shared/', () => {
    expect(rulesBrokenBy('src/server/boundaryFixtures/reachesClient.ts')).toContain(
      'server-reaches-only-shared'
    );
    expect(rulesBrokenBy('src/client/boundaryFixtures/reachesServer.ts')).toContain(
      'client-reaches-only-shared'
    );
  });

  it('refuses the browser half of services/ from the server, by name', () => {
    // The pure half is imported from `src/server/sharedKernel.test.ts` and passes; this is the
    // other side of that proof (TICKET-DX-07 acceptance criterion 6)
    expect(rulesBrokenBy('src/server/boundaryFixtures/reachesBrowserStorage.ts')).toContain(
      'no-server-to-client'
    );
  });

  it('refuses a cross-root crossing spelled with ../ rather than with its alias', () => {
    expect(rulesBrokenBy('src/client/boundaryFixtures/reachesSharedRelatively.ts')).toContain(
      'cross-root-imports-use-an-alias'
    );
  });

  it('allows the same crossing spelled with #shared/', () => {
    expect(rulesBrokenBy('src/client/boundaryFixtures/reachesSharedByAlias.ts')).toEqual([]);
  });

  it('reports every rule in the config at least once', () => {
    // A rule nobody proves is a rule nobody knows works. This fails when one is added without a
    // fixture, which is the only way the list above stays honest.
    const proven = new Set(violations.map((violation) => violation.rule.name));
    // `name` is optional on the rule type but every rule here carries one, and an unnamed rule is
    // exactly the kind of thing this test should refuse rather than quietly skip
    const declared = rules.map((rule) => rule.name ?? '(unnamed)');

    expect(declared.filter((name) => !proven.has(name))).toEqual([]);
  });
});
