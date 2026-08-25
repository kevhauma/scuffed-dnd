/**
 * The server's environment, read once and typed (TICKET-SRV-01)
 *
 * **The only reader of `process.env` in `src/`** — a test asserts that, because a second reader is
 * how a variable ends up documented in one place and consumed in another. Everything the server
 * needs to be told is declared in {@link ENV_VARIABLES}, and `.env.example` is checked against that
 * table rather than maintained beside it.
 *
 * **Required variables are eager, at the door rather than at import.** A server that starts and
 * then 500s on its first request is worse than one that refuses to start, so `entry.ts` calls
 * {@link serverEnv} once as it loads. Reading at *module* scope would be stricter and worse: every
 * route module would become unimportable without a complete environment, which takes the server
 * tests down with it — and they have no reason to care what a database URL says. The refusal names
 * *every* missing key at once; an operator filling in a `.env` should need one round trip, not four.
 *
 * Optional variables are a genuinely different case and this handles both: TICKET-AUTH-02 brings
 * two independently optional OAuth credential pairs, and an absent pair means that provider is off,
 * not that the server is broken.
 *
 * **Validates: v3 Req 47.2, 47.3**
 */

/** What a variable is, as data — the table `.env.example` is checked against */
export interface EnvVariable {
  /** Refuse to start without it */
  required: boolean;
  /** What it is for, in the words `.env.example` uses */
  description: string;
}

/**
 * Every variable the server reads
 *
 * Deliberately short: a variable with no reader is a setting nobody has decided the meaning of.
 * `DATABASE_URL` is the first **required** one (TICKET-DB-01) and is what makes the eager refusal
 * matter — a server that cannot find its database should not answer a request and then discover it.
 */
export const ENV_VARIABLES = {
  NODE_ENV: {
    required: false,
    description:
      'Which build this is. The tooling sets it; Vite refuses NODE_ENV=production from a .env ' +
      'file, because a production build is `yarn build` rather than a variable.',
  },
  DATABASE_URL: {
    required: true,
    description:
      'Path to the SQLite file holding every piece of server state. Relative paths resolve from ' +
      'the working directory. `:memory:` is accepted and is what the tests use. The file and its ' +
      '-wal/-shm companions must live somewhere durable and backed up.',
  },
  BETTER_AUTH_SECRET: {
    required: true,
    description:
      'The key every Auth_Session cookie is signed with (TICKET-AUTH-01). Changing it signs ' +
      'everybody out, which is also how you sign everybody out. Generate with ' +
      '`openssl rand -base64 32`. Passed to Better Auth explicitly rather than left to the ' +
      "library's own `process.env` read, because env.ts is the only reader of it in this repo.",
  },
  AUTH_SESSION_DAYS: {
    required: false,
    description:
      'How long an Auth_Session lasts, in days (TICKET-AUTH-01, v3 Req 48.2). A number rather ' +
      'than a literal in the auth config so that TICKET-AUTH-04 changes values and adds rotation ' +
      'rather than changing the shape. Defaults to 7.',
  },
  AUTH_SIGNIN_MAX_ATTEMPTS: {
    required: false,
    description:
      'How many failed sign-ins one email address may make inside the window before it is ' +
      'refused (v3 Req 30.7). Defaults to 5. Set to 0 to disable — which is what the tests that ' +
      'are not about rate limiting do.',
  },
  AUTH_SIGNIN_WINDOW_SECONDS: {
    required: false,
    description:
      'The window AUTH_SIGNIN_MAX_ATTEMPTS is counted over, in seconds (v3 Req 30.7). Defaults ' +
      'to 900 — fifteen minutes.',
  },
} as const satisfies Record<string, EnvVariable>;

/** The builds the server distinguishes */
export const NODE_ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

export type NodeEnv = (typeof NODE_ENV)[keyof typeof NODE_ENV];

/** The environment, resolved and coerced */
export interface ServerEnv {
  nodeEnv: NodeEnv;
  /** Where the SQLite file lives (TICKET-DB-01) */
  databaseUrl: string;
  /** What Auth_Session cookies are signed with (TICKET-AUTH-01) */
  authSecret: string;
  /** How long an Auth_Session lasts, in seconds — AUTH-04 makes this the *idle* half */
  authSessionSeconds: number;
  /** Failed sign-ins allowed per email address inside the window; 0 disables the limit */
  signInMaxAttempts: number;
  /** The window those attempts are counted over, in seconds */
  signInWindowSeconds: number;
}

/** What the optional auth settings mean when nothing sets them */
const AUTH_DEFAULTS = {
  SESSION_DAYS: 7,
  SIGNIN_MAX_ATTEMPTS: 5,
  SIGNIN_WINDOW_SECONDS: 900,
} as const;

const SECONDS_PER_DAY = 60 * 60 * 24;

/**
 * A non-negative integer from the environment, or the default
 *
 * Falls back rather than throwing, for the reason {@link asNodeEnv} does: a malformed *optional*
 * setting is not a missing one, and refusing to start over a typo in a tuning knob is a worse
 * failure than running with the documented default. A negative or non-numeric value is not
 * silently treated as zero — zero is a meaningful value for the attempt limit.
 *
 * @param raw What the environment said
 * @param fallback What to use when it said nothing usable
 * @returns The number to use
 */
function asCount(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Refusal to start, naming everything that is missing
 *
 * Carries the keys rather than only a sentence so that a caller — a start-up script, a test — can
 * act on the list instead of parsing the message back apart.
 */
export class MissingEnvironmentError extends Error {
  constructor(public readonly missing: string[]) {
    super(
      `The server cannot start: ${missing.length} required environment ` +
        `variable${missing.length === 1 ? ' is' : 's are'} missing — ${missing.join(', ')}. ` +
        'See .env.example.'
    );
    this.name = 'MissingEnvironmentError';
  }
}

/**
 * Every required variable the source does not set, in declaration order
 *
 * Takes the table as a parameter because the table is data: the mechanism is worth testing against
 * a table with required entries in it, and today's real one has none.
 *
 * @param variables What to look for
 * @param source Where to look — `process.env` in production, a literal in a test
 * @returns The missing keys, empty when the environment is complete
 */
export function collectMissing(
  variables: Record<string, EnvVariable>,
  source: Record<string, string | undefined>
): string[] {
  return Object.entries(variables)
    .filter(([key, variable]) => variable.required && !source[key])
    .map(([key]) => key);
}

/**
 * A `NODE_ENV` the server understands, or `development` for anything else
 *
 * Falling back rather than throwing is deliberate: a misspelled build name is not a *missing*
 * setting, and the safe reading of an unrecognised one is the less privileged of the two.
 */
function asNodeEnv(raw: string | undefined): NodeEnv {
  const known: NodeEnv[] = Object.values(NODE_ENV);
  return known.find((value) => value === raw) ?? NODE_ENV.DEVELOPMENT;
}

/**
 * Read and coerce an environment, or refuse
 *
 * @param source Where to read from; defaults to the real one
 * @returns The typed environment
 * @throws {MissingEnvironmentError} If any required variable is unset or empty
 */
export function readEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const missing = collectMissing(ENV_VARIABLES, source);
  if (missing.length > 0) throw new MissingEnvironmentError(missing);

  return {
    nodeEnv: asNodeEnv(source.NODE_ENV),
    // Non-null by construction: both are required, so `collectMissing` refused above
    databaseUrl: source.DATABASE_URL as string,
    authSecret: source.BETTER_AUTH_SECRET as string,
    authSessionSeconds:
      asCount(source.AUTH_SESSION_DAYS, AUTH_DEFAULTS.SESSION_DAYS) * SECONDS_PER_DAY,
    signInMaxAttempts: asCount(source.AUTH_SIGNIN_MAX_ATTEMPTS, AUTH_DEFAULTS.SIGNIN_MAX_ATTEMPTS),
    signInWindowSeconds: asCount(
      source.AUTH_SIGNIN_WINDOW_SECONDS,
      AUTH_DEFAULTS.SIGNIN_WINDOW_SECONDS
    ),
  };
}

/** Read once, then reused — the environment does not change under a running process */
let resolved: ServerEnv | null = null;

/**
 * The environment this process is running in
 *
 * `entry.ts` calls this as it loads, which is what makes a missing required variable a start-up
 * failure. Everywhere else calls it when it needs a value.
 *
 * @returns The typed environment
 * @throws {MissingEnvironmentError} On the first call, if any required variable is unset
 */
export function serverEnv(): ServerEnv {
  resolved ??= readEnv();
  return resolved;
}
