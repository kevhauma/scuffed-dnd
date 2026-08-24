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
  collectMissing,
  ENV_VARIABLES,
  type EnvVariable,
  MissingEnvironmentError,
  NODE_ENV,
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
    const complete = { DATABASE_URL: './data/app.db' };

    it('defaults an unset NODE_ENV to development rather than guessing production', () => {
      expect(readEnv(complete)).toEqual({
        nodeEnv: NODE_ENV.DEVELOPMENT,
        databaseUrl: './data/app.db',
      });
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
      .filter((path) => readFileSync(path, 'utf8').includes('process.env'));

    expect(readers.map((path) => path.replace(SRC_ROOT, 'src').replaceAll('\\', '/'))).toEqual([
      'src/server/env.ts',
    ]);
  });
});
