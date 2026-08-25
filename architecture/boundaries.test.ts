/**
 * The architecture rules, proven by modules that break them (TICKET-DX-07, TICKET-DX-08)
 *
 * `yarn run check` cruises `src/` and reports nothing, which is exactly what a *broken* rule set
 * also does. So every rule in [`.dependency-cruiser.mjs`](../.dependency-cruiser.mjs) is asserted
 * here against a module that really violates it — a real module, in a real place, with a real
 * forbidden import — plus one legal crossing that must come back clean, so "refuses everything"
 * cannot pass for "enforces the boundary".
 *
 * The fixtures live in `boundaryFixtures/` directories, which the enforcing config excludes as
 * *sources* for the obvious reason. This suite cruises the whole of `src/` with that one exemption
 * lifted and every other exemption kept — so the same run proves two things at once: each rule
 * fires on its fixture, and **no real module breaks any of them**.
 *
 * **Validates: v3 Req 50, Req 51.1-51.9; overview D14**
 */

import { cruise } from 'dependency-cruiser';
import { describe, expect, it } from 'vitest';
import depcruiseConfig, { FIXTURES } from '../.dependency-cruiser.mjs';

/**
 * The real rules, with **only** the fixture exemption lifted
 *
 * Every other `pathNot` entry is a recorded decision — tests are not shipped, `useAppHydration`
 * probes rather than persists, the generated route tree's cycle is type-only — and lifting those
 * too would make this suite report them as failures, which is the opposite of what they are.
 */
const rules = (depcruiseConfig.forbidden ?? []).map((rule) => {
  const kept = [rule.from.pathNot ?? []].flat().filter((pattern) => pattern !== FIXTURES);
  return { ...rule, from: { ...rule.from, pathNot: kept.length > 0 ? kept : undefined } };
});

/** One cruise of the whole tree, shared by every case below */
const cruised = await cruise(['src'], {
  ...depcruiseConfig.options,
  validate: true,
  ruleSet: { forbidden: rules },
});

if (typeof cruised.output === 'string') throw new Error('expected a cruise result, not a report');
const violations = cruised.output.summary.violations;

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
});

describe('the layering rules', () => {
  it('refuses a framework in the Kernel — the zustand import DX-08 names', () => {
    expect(rulesBrokenBy('src/shared/boundaryFixtures/reachesFramework.ts')).toContain(
      'kernel-is-framework-free'
    );
  });

  it('refuses a runtime import from the type layer', () => {
    expect(rulesBrokenBy('src/shared/types/boundaryFixtures/reachesRuntime.ts')).toContain(
      'types-are-the-bottom-layer'
    );
  });

  it('refuses a component reaching the LocalStorage service', () => {
    expect(rulesBrokenBy('src/client/components/boundaryFixtures/reachesStorage.ts')).toContain(
      'persistence-belongs-to-the-store'
    );
  });

  it('refuses a server module outside db/ and repositories/ reaching the database', () => {
    expect(rulesBrokenBy('src/server/boundaryFixtures/reachesTheDatabase.ts')).toContain(
      'queries-belong-to-repositories'
    );
  });

  it('refuses a base component reading a store', () => {
    expect(rulesBrokenBy('src/client/components/ui/boundaryFixtures/reachesTheStore.ts')).toContain(
      'ui-primitives-are-leaves'
    );
  });
});

describe('the dependency-graph rules', () => {
  it('refuses an import cycle', () => {
    // Reported once for the cycle, from whichever member the traversal entered it by — so this
    // asserts the finding rather than a finding per module
    const cycles = violations
      .filter((violation) => violation.rule.name === 'no-circular')
      .map((violation) => violation.from.replace(/\\/g, '/'));

    expect(cycles).toContain('src/shared/boundaryFixtures/circularA.ts');
  });

  it('refuses a devDependency in a module that ships', () => {
    expect(rulesBrokenBy('src/shared/boundaryFixtures/reachesDevDependency.ts')).toContain(
      'no-dev-dep-in-production'
    );
  });

  it('refuses a package that is not in package.json', () => {
    expect(rulesBrokenBy('src/shared/boundaryFixtures/reachesUndeclaredPackage.ts')).toContain(
      'no-undeclared-dependency'
    );
  });

  it('reports an orphan as a warning rather than as an error', () => {
    const orphan = violations.find(
      (violation) =>
        violation.rule.name === 'no-orphans' &&
        violation.from.replace(/\\/g, '/') === 'src/shared/boundaryFixtures/orphan.ts'
    );

    // A warning that never reaches the report is the same as no rule; a warning that fails the
    // build is a rule the tree cannot satisfy, since an entry point looks orphaned from in here
    expect(orphan, 'the orphan fixture produced no finding at all').toBeDefined();
    expect(orphan?.rule.severity).toBe('warn');
  });
});

describe('the rule set as a whole', () => {
  it('reports every rule in the config at least once', () => {
    // A rule nobody proves is a rule nobody knows works. This fails when one is added without a
    // fixture, which is the only way the list above stays honest.
    const proven = new Set(violations.map((violation) => violation.rule.name));
    // `name` is optional on the rule type but every rule here carries one, and an unnamed rule is
    // exactly the kind of thing this test should refuse rather than quietly skip
    const declared = rules.map((rule) => rule.name ?? '(unnamed)');

    expect(declared.filter((name) => !proven.has(name))).toEqual([]);
  });

  it('is broken by no module that is not a fixture', () => {
    // The other half of the same cruise: the rules fire on what they should, and on nothing else.
    // This is what makes a green `yarn run arch` mean "the tree is clean" rather than "the tool is
    // blind", and it is where an inherited violation would surface if one were introduced.
    const offenders = violations
      .map((violation) => violation.from.replace(/\\/g, '/'))
      .filter((module) => !module.includes('/boundaryFixtures/'));

    expect([...new Set(offenders)]).toEqual([]);
  });
});

/**
 * The `err-long` reporter's text, which is what a developer actually reads
 *
 * `err-long` rather than `err` because only the long form prints a rule's `comment`, and the
 * comment is the difference between "the build failed" and "the build failed, and here is the
 * decision you walked into". That is why `yarn run arch` asks for it too — a rule that explains
 * itself only inside a test explains itself to nobody.
 *
 * Cruised over two fixtures rather than over the tree, because this is about the wording of one
 * finding rather than about the graph. The reporter hard-wraps its prose, so the text is collapsed
 * to single spaces before matching — otherwise these assertions would be pinned to a column width.
 */
const report = await (async () => {
  const result = await cruise(
    [
      'src/client/components/boundaryFixtures/reachesStorage.ts',
      'src/shared/boundaryFixtures/reachesFramework.ts',
    ],
    {
      ...depcruiseConfig.options,
      validate: true,
      ruleSet: { forbidden: rules },
      outputType: 'err-long',
    }
  );

  const text = typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
  return text.replace(/\s+/g, ' ');
})();

describe('a failure message', () => {
  it('names the decision behind persistence-belongs-to-the-store, not just the edge', () => {
    expect(report).toContain('persistence-belongs-to-the-store');
    expect(report).toContain('Persistence belongs to the');
    expect(report).toContain('patches state and persists in the same call');
  });

  it('names the decision behind kernel-is-framework-free, not just the edge', () => {
    expect(report).toContain('kernel-is-framework-free');
    expect(report).toContain('The Kernel imported a framework');
    expect(report).toContain('a rule with an environment');
  });
});
