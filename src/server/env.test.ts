/**
 * Environment loader tests (TICKET-SRV-01)
 *
 * Two of these are contracts rather than unit tests: that `.env.example` and `env.ts` name the same
 * set, and that nothing else in `src/` reads `process.env`. Both fail when someone adds a variable
 * in one place and forgets the other, which is the failure this module exists to prevent.
 *
 * **Validates: v3 Req 47.2, 47.3**
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SOCIAL_PROVIDER,
  SOCIAL_PROVIDERS,
  type SocialProvider,
} from '#shared/types/socialProvider';
import {
  collectMissing,
  ENV_VARIABLES,
  type EnvVariable,
  MissingEnvironmentError,
  NODE_ENV,
  providerVariables,
  readEnv,
  serverEnv,
} from './env';

const ENV_EXAMPLE = resolve(process.cwd(), '.env.example');
const SRC_ROOT = resolve(process.cwd(), 'src');

/** Every `.ts`/`.tsx` file under `src/`, so the scan below cannot miss a new directory */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('the server environment', () => {
  describe('collectMissing', () => {
    it('names every missing required variable at once, not the first', () => {
      const variables: Record<string, EnvVariable> = {
        FIRST: { required: true, description: '' },
        OPTIONAL: { required: false, description: '' },
        SECOND: { required: true, description: '' },
      };

      // One round trip to fill in a .env, not one per variable
      expect(collectMissing(variables, {})).toEqual(['FIRST', 'SECOND']);
    });

    it('treats an empty string as missing, because a blank line in a .env is not a value', () => {
      const variables: Record<string, EnvVariable> = { KEY: { required: true, description: '' } };

      expect(collectMissing(variables, { KEY: '' })).toEqual(['KEY']);
    });

    it('is satisfied by a set required variable', () => {
      const variables: Record<string, EnvVariable> = { KEY: { required: true, description: '' } };

      expect(collectMissing(variables, { KEY: 'value' })).toEqual([]);
    });

    it('never asks for an optional one', () => {
      const variables: Record<string, EnvVariable> = { KEY: { required: false, description: '' } };

      expect(collectMissing(variables, {})).toEqual([]);
    });
  });

  describe('MissingEnvironmentError', () => {
    it('carries the keys as data, so a caller need not parse the message apart', () => {
      const error = new MissingEnvironmentError(['ONE', 'TWO']);

      expect(error.missing).toEqual(['ONE', 'TWO']);
      expect(error.message).toContain('ONE, TWO');
      expect(error.message).toContain('.env.example');
    });
  });

  describe('readEnv', () => {
    /** The smallest complete environment — everything required and nothing else */
    const complete = { DATABASE_URL: './data/app.db', BETTER_AUTH_SECRET: 'a-test-secret' };

    it('defaults an unset NODE_ENV to development rather than guessing production', () => {
      expect(readEnv(complete)).toEqual({
        nodeEnv: NODE_ENV.DEVELOPMENT,
        databaseUrl: './data/app.db',
        authSecret: 'a-test-secret',
        // The documented defaults for every optional auth setting. Asserted as values rather than
        // as `expect.any(Number)`, because "30 days idle", "90 days absolute" and "5 attempts" are
        // the decisions — a silent change to any of them is what this catches.
        authSessionSeconds: 30 * 24 * 60 * 60,
        authSessionAbsoluteSeconds: 90 * 24 * 60 * 60,
        authSessionUpdateSeconds: 24 * 60 * 60,
        authSessionGraceSeconds: 30,
        signInMaxAttempts: 5,
        signInWindowSeconds: 900,
        // Neither provider configured is the *default* shape, not a degraded one (v3 Req 31.6)
        allowedHosts: [],
        socialProviders: { google: null, discord: null },
      });
    });

    it('takes the auth settings from the environment when they are given', () => {
      expect(
        readEnv({
          ...complete,
          AUTH_SESSION_DAYS: '14',
          AUTH_SESSION_ABSOLUTE_DAYS: '60',
          AUTH_SESSION_UPDATE_HOURS: '6',
          AUTH_SESSION_GRACE_SECONDS: '5',
          AUTH_SIGNIN_MAX_ATTEMPTS: '3',
          AUTH_SIGNIN_WINDOW_SECONDS: '60',
        })
      ).toMatchObject({
        authSessionSeconds: 14 * 24 * 60 * 60,
        authSessionAbsoluteSeconds: 60 * 24 * 60 * 60,
        authSessionUpdateSeconds: 6 * 60 * 60,
        authSessionGraceSeconds: 5,
        signInMaxAttempts: 3,
        signInWindowSeconds: 60,
      });
    });

    it('keeps 0 attempts, because disabling the limit is a real setting', () => {
      // The one value a `||` fallback would silently turn back into the default
      expect(readEnv({ ...complete, AUTH_SIGNIN_MAX_ATTEMPTS: '0' }).signInMaxAttempts).toBe(0);
    });

    it('falls back rather than throwing on a malformed optional number', () => {
      // Same reasoning as NODE_ENV below: a typo in a tuning knob is not a missing setting, and
      // refusing to start over one is a worse failure than running with the documented default
      for (const bad of ['not-a-number', '-1', '2.5', '']) {
        expect(readEnv({ ...complete, AUTH_SIGNIN_MAX_ATTEMPTS: bad }).signInMaxAttempts, bad).toBe(
          5
        );
      }
    });

    it('refuses an environment with no BETTER_AUTH_SECRET', () => {
      // Without it Better Auth would either refuse to start or sign cookies with something
      // guessable, and neither should be discovered on a first sign-in (TICKET-AUTH-01)
      expect(() => readEnv({ DATABASE_URL: './data/app.db' })).toThrow(/BETTER_AUTH_SECRET/);
    });

    it('reads a NODE_ENV it understands', () => {
      expect(readEnv({ ...complete, NODE_ENV: 'production' }).nodeEnv).toBe(NODE_ENV.PRODUCTION);
    });

    it('falls back rather than throwing on a NODE_ENV it does not understand', () => {
      // A misspelled build name should not stop the server; a *missing required* variable should
      expect(readEnv({ ...complete, NODE_ENV: 'staging' }).nodeEnv).toBe(NODE_ENV.DEVELOPMENT);
    });

    it('refuses an environment with no DATABASE_URL rather than defaulting to a file', () => {
      // Guessing a path here would create an empty database somewhere nobody backs up
      expect(() => readEnv({})).toThrow(MissingEnvironmentError);
      expect(() => readEnv({})).toThrow(/DATABASE_URL/);
    });

    describe('the social providers (TICKET-AUTH-02)', () => {
      /** Everything one provider needs, plus the host list it makes compulsory */
      function configured(provider: SocialProvider): Record<string, string> {
        const names = providerVariables(provider);
        return {
          ...complete,
          AUTH_ALLOWED_HOSTS: 'dnd.example.com',
          [names.id]: `${provider}-id`,
          [names.secret]: `${provider}-secret`,
        };
      }

      it.each(SOCIAL_PROVIDERS)('reads %s from its own pair of variables', (provider) => {
        expect(readEnv(configured(provider)).socialProviders[provider]).toEqual({
          clientId: `${provider}-id`,
          clientSecret: `${provider}-secret`,
        });
      });

      it.each(SOCIAL_PROVIDERS)(
        'leaves the other provider off when only %s is configured (v3 Req 31.6)',
        (provider) => {
          // The independence the requirement asks for: one configured provider says nothing about
          // the other, and neither says anything about email/password
          const other = SOCIAL_PROVIDERS.find((candidate) => candidate !== provider);
          const env = readEnv(configured(provider));

          expect(env.socialProviders[provider]).not.toBeNull();
          expect(other && env.socialProviders[other]).toBeNull();
        }
      );

      it.each(SOCIAL_PROVIDERS)('names the missing half of a %s pair', (provider) => {
        const names = providerVariables(provider);
        const half = { ...complete, AUTH_ALLOWED_HOSTS: 'a.example.com', [names.id]: 'an-id' };

        // Silently ignoring one set variable is how an operator ends up staring at a missing
        // button with the id right there in their .env
        expect(() => readEnv(half)).toThrow(new RegExp(names.secret));
      });

      it('refuses to start with a provider configured and no allowed hosts', () => {
        const { AUTH_ALLOWED_HOSTS: _omitted, ...withoutHosts } = configured(
          SOCIAL_PROVIDER.GOOGLE
        );

        // Fails closed: without a host list the OAuth callback origin would be derived from an
        // attacker-controlled `Host` header
        expect(() => readEnv(withoutHosts)).toThrow(/AUTH_ALLOWED_HOSTS/);
      });

      it('asks for no host list when neither provider is configured', () => {
        // The signed-out, no-accounts-anywhere deployment is still a supported one (D6)
        expect(readEnv(complete).allowedHosts).toEqual([]);
      });

      it('splits the host list and drops the blanks', () => {
        expect(
          readEnv({
            ...configured(SOCIAL_PROVIDER.DISCORD),
            AUTH_ALLOWED_HOSTS: ' a.com , ,b.com ',
          }).allowedHosts
        ).toEqual(['a.com', 'b.com']);
      });
    });
  });

  describe('providerVariables', () => {
    it.each(SOCIAL_PROVIDERS)('derives %s’s variable names, and the table declares them', (p) => {
      // The drift check: the names the reader derives and the names `.env.example` is checked
      // against are the same names, so a provider cannot be readable but undocumented
      const names = providerVariables(p);

      expect(Object.keys(ENV_VARIABLES)).toContain(names.id);
      expect(Object.keys(ENV_VARIABLES)).toContain(names.secret);
    });
  });

  describe('serverEnv', () => {
    it('reads once and hands back the same environment thereafter', () => {
      // The environment does not change under a running process, and the eager read belongs at the
      // door (entry.ts) rather than at module scope — see the module's own note for why
      expect(serverEnv()).toBe(serverEnv());
    });
  });

  describe('the .env.example contract', () => {
    const example = readFileSync(ENV_EXAMPLE, 'utf8');
    const documented = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]);

    it('documents exactly the variables the code reads', () => {
      expect([...documented].sort()).toEqual(Object.keys(ENV_VARIABLES).sort());
    });

    it('says of each whether it is required and what it is for', () => {
      const lines = example.split(/\r?\n/);

      for (const [key, variable] of Object.entries(ENV_VARIABLES)) {
        // The contiguous comment block directly above the assignment, and nothing else — a loose
        // "somewhere earlier in the file" check would let one variable's comment vouch for another
        const at = lines.findIndex((line) => line.startsWith(`${key}=`));
        const block: string[] = [];
        for (let i = at - 1; i >= 0 && lines[i].startsWith('#'); i--) block.unshift(lines[i]);
        const comment = block.join('\n');

        expect(at, `${key} is not in .env.example`).toBeGreaterThan(-1);
        expect(comment, `${key} has no comment of its own`).toContain(key);
        expect(comment, `${key} does not say required/optional`).toMatch(/required|optional/i);
        expect(variable.description.length, `${key} has no description`).toBeGreaterThan(0);
      }
    });

    it('names no origin, so nothing can be pointed at another backend (v3 Req 47.7)', () => {
      expect(example).not.toMatch(/https?:\/\/(?!\/)/);
      expect(example).not.toMatch(/API_URL|API_BASE|BACKEND_URL|SOCKET_URL/);
    });
  });

  it('is the only reader of process.env in src/', () => {
    const readers = sourceFiles(SRC_ROOT)
      // This file names the string it is looking for, which would otherwise make it its own match
      .filter((path) => path !== resolve(SRC_ROOT, 'server', 'env.test.ts'))
      // Tests are held to the companion rule below rather than to this one — see it for why
      .filter((path) => !/\.test\.tsx?$/.test(path))
      .filter((path) => readFileSync(path, 'utf8').includes('process.env'));

    expect(readers.map((path) => path.replace(SRC_ROOT, 'src').replaceAll('\\', '/'))).toEqual([
      'src/server/env.ts',
    ]);
  });

  it('is the only module that *reads* it, tests included (TICKET-AUTH-02)', () => {
    // **A test may arrange an environment; it may not consume one.** `socialSignIn.test.ts` has to
    // set the OAuth variables before the lazy first read, which is exercising this module's
    // contract rather than working around it. Consuming a variable is the thing the rule exists
    // against — that is how a setting ends up documented in one place and read in another — so the
    // check narrows to reads here instead of exempting tests wholesale.
    const assignment = /process\.env(?:\.[A-Z][A-Z0-9_]*|\[[^\]]+\])\s*\?{0,2}=[^=]/g;
    // Comments go first, so that a doc block *explaining* this rule is not itself a violation of it
    const comments = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;

    const consumers = sourceFiles(SRC_ROOT)
      .filter((path) => path !== resolve(SRC_ROOT, 'server', 'env.test.ts'))
      .filter((path) => /\.test\.tsx?$/.test(path))
      .filter((path) =>
        readFileSync(path, 'utf8')
          .replace(comments, '')
          .replace(assignment, '')
          .includes('process.env')
      );

    expect(consumers.map((path) => path.replace(SRC_ROOT, 'src').replaceAll('\\', '/'))).toEqual(
      []
    );
  });
});
