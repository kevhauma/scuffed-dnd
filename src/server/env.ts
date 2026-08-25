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
 * Optional variables are a genuinely different case and this handles both: TICKET-AUTH-02's two
 * OAuth credential pairs are independently optional, and an absent pair means that provider is off
 * rather than that the server is broken (v3 Req 31.6).
 *
 * **Two refusals are conditional rather than table-driven**, and both fail closed: half a
 * credential pair names the missing half, and a configured provider with no `AUTH_ALLOWED_HOSTS`
 * refuses to start rather than deriving an OAuth callback origin from an attacker-controlled
 * `Host` header. See {@link readEnv}.
 *
 * **Validates: v3 Req 47.2, 47.3, 31.6, 31.8**
 */

import { SOCIAL_PROVIDERS, type SocialProvider } from '#shared/types/socialProvider';

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
      'The **idle** half of a session lifetime, in days (v3 Req 48.2). Every use pushes it out ' +
      'again, so this is how long you may stay away and still come back signed in. Defaults to 30.',
  },
  AUTH_SESSION_ABSOLUTE_DAYS: {
    required: false,
    description:
      'The **absolute** ceiling, in days (TICKET-AUTH-04, v3 Req 48.3). No amount of continuous ' +
      'use extends a session past this, which is what bounds a stolen cookie. Defaults to 90. A ' +
      'value below AUTH_SESSION_DAYS simply wins — the earlier of the two is always the answer.',
  },
  AUTH_SESSION_UPDATE_HOURS: {
    required: false,
    description:
      'How often a session in use is renewed and its identifier rotated, in hours (v3 Req 48.4). ' +
      'Not how long it lasts: a smaller number means more rotations and a shorter window for a ' +
      'captured cookie, at the cost of a write. Defaults to 24.',
  },
  AUTH_SESSION_GRACE_SECONDS: {
    required: false,
    description:
      'How long the identifier a rotation replaced stays valid, in seconds (TICKET-AUTH-04). It ' +
      'exists so that two browser tabs renewing in the same instant do not sign each other out. ' +
      'Defaults to 30. Set to 0 to rotate with no grace at all, accepting that hazard.',
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
  AUTH_ALLOWED_HOSTS: {
    required: false,
    description:
      'Comma-separated hostnames this deployment answers on (TICKET-AUTH-02, v3 Req 31.1). Not ' +
      'an origin to talk to — the subject line of this server, the way a certificate names its ' +
      'own hosts. It is what an OAuth redirect URI is built from, so that a forged Host header ' +
      'cannot steer a callback. Required as soon as either provider below is configured, and ' +
      'ignored otherwise. Wildcards are allowed, e.g. `*.example.com`.',
  },
  GOOGLE_CLIENT_ID: {
    required: false,
    description:
      'The OAuth client id from the Google Cloud console (TICKET-AUTH-02). Optional: with the ' +
      'pair unset the Google button is absent and nothing else changes.',
  },
  GOOGLE_CLIENT_SECRET: {
    required: false,
    description:
      'The secret paired with GOOGLE_CLIENT_ID. Never reaches the client bundle — env.ts is ' +
      'server-only and a boundary test proves it.',
  },
  DISCORD_CLIENT_ID: {
    required: false,
    description:
      'The OAuth client id from the Discord developer portal (TICKET-AUTH-02). Optional, on the ' +
      'same terms as the Google pair.',
  },
  DISCORD_CLIENT_SECRET: {
    required: false,
    description: 'The secret paired with DISCORD_CLIENT_ID. Server-only, like the Google one.',
  },
} as const satisfies Record<string, EnvVariable>;

/** The builds the server distinguishes */
export const NODE_ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

export type NodeEnv = (typeof NODE_ENV)[keyof typeof NODE_ENV];

/** One provider's OAuth credentials, both halves or neither (TICKET-AUTH-02) */
export interface SocialProviderCredentials {
  clientId: string;
  clientSecret: string;
}

/** What every provider is configured as: its credentials, or `null` for "not configured" */
export type SocialProviderCredentialMap = Readonly<
  Record<SocialProvider, SocialProviderCredentials | null>
>;

/** The environment, resolved and coerced */
export interface ServerEnv {
  nodeEnv: NodeEnv;
  /** Where the SQLite file lives (TICKET-DB-01) */
  databaseUrl: string;
  /** What Auth_Session cookies are signed with (TICKET-AUTH-01) */
  authSecret: string;
  /** The idle half of a session lifetime, in seconds — a use pushes it out again */
  authSessionSeconds: number;
  /** The absolute ceiling, in seconds; no use extends a session past it (TICKET-AUTH-04) */
  authSessionAbsoluteSeconds: number;
  /** How often a session in use is renewed and rotated, in seconds */
  authSessionUpdateSeconds: number;
  /** How long a rotated-away identifier stays honoured, in seconds */
  authSessionGraceSeconds: number;
  /** Failed sign-ins allowed per email address inside the window; 0 disables the limit */
  signInMaxAttempts: number;
  /** The window those attempts are counted over, in seconds */
  signInWindowSeconds: number;
  /** The hostnames this deployment answers on; empty when no provider is configured */
  allowedHosts: string[];
  /** Each provider's credentials, or `null` (TICKET-AUTH-02) */
  socialProviders: SocialProviderCredentialMap;
}

/** What the optional auth settings mean when nothing sets them */
const AUTH_DEFAULTS = {
  /** Come back after three weeks away and you are still in — a fortnightly game fits inside it */
  SESSION_DAYS: 30,
  /** …and a cookie stolen today is dead within three months, however continuously it is used */
  SESSION_ABSOLUTE_DAYS: 90,
  /** One rotation a day: a captured cookie's window is a day, and the write costs nothing */
  SESSION_UPDATE_HOURS: 24,
  /** Long enough for two tabs racing, short enough that rotation still means something */
  SESSION_GRACE_SECONDS: 30,
  SIGNIN_MAX_ATTEMPTS: 5,
  SIGNIN_WINDOW_SECONDS: 900,
} as const;

const SECONDS_PER_HOUR = 60 * 60;

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
 * The two variables a provider is configured through
 *
 * **Derived from the provider id rather than written beside it**, so `SOCIAL_PROVIDER` and the
 * environment cannot name different things. The entries in {@link ENV_VARIABLES} are spelled out in
 * full because that table is documentation — `env.test.ts` asserts these derived names all appear
 * in it, which is the drift check without the unreadable computed keys.
 *
 * @param provider Which provider
 * @returns The id and secret variable names
 */
export function providerVariables(provider: SocialProvider): { id: string; secret: string } {
  const prefix = provider.toUpperCase();
  return { id: `${prefix}_CLIENT_ID`, secret: `${prefix}_CLIENT_SECRET` };
}

/** A set value, or `undefined` — an empty string is a blank line in a `.env`, not a value */
function value(source: Record<string, string | undefined>, key: string): string | undefined {
  const raw = source[key];
  return raw === undefined || raw.trim() === '' ? undefined : raw.trim();
}

/**
 * A comma-separated list from the environment
 *
 * @param raw What the environment said
 * @returns The entries, trimmed, with the empties dropped
 */
function asList(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/** Every provider's credentials, and the half-pairs that make the environment incomplete */
function readSocialProviders(source: Record<string, string | undefined>): {
  providers: SocialProviderCredentialMap;
  missing: string[];
} {
  const providers = {} as Record<SocialProvider, SocialProviderCredentials | null>;
  const missing: string[] = [];

  for (const provider of SOCIAL_PROVIDERS) {
    const names = providerVariables(provider);
    const clientId = value(source, names.id);
    const clientSecret = value(source, names.secret);

    providers[provider] = clientId && clientSecret ? { clientId, clientSecret } : null;

    // **A half-configured pair is a mistake, not a disabled provider.** Silently ignoring one set
    // variable is how an operator ends up staring at a missing button with the id right there in
    // their `.env`; naming the absent half is one round trip to a working configuration.
    if (clientId && !clientSecret) missing.push(names.secret);
    if (clientSecret && !clientId) missing.push(names.id);
  }

  return { providers, missing };
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

  const { providers, missing: incomplete } = readSocialProviders(source);
  const allowedHosts = asList(source.AUTH_ALLOWED_HOSTS);

  // **Conditionally required, and it fails closed.** A provider with no allowed hosts would leave
  // Better Auth deriving its callback origin from the request `Host` header, which an attacker
  // controls — so the one case where that matters is the one case this refuses to start without.
  // The condition lives here rather than as a third field on `EnvVariable`: one variable needs it,
  // and a table column with a single user is a framework for a special case.
  if (SOCIAL_PROVIDERS.some((provider) => providers[provider]) && allowedHosts.length === 0) {
    incomplete.push('AUTH_ALLOWED_HOSTS');
  }

  if (incomplete.length > 0) throw new MissingEnvironmentError(incomplete);

  return {
    allowedHosts,
    socialProviders: providers,
    nodeEnv: asNodeEnv(source.NODE_ENV),
    // Non-null by construction: both are required, so `collectMissing` refused above
    databaseUrl: source.DATABASE_URL as string,
    authSecret: source.BETTER_AUTH_SECRET as string,
    authSessionSeconds:
      asCount(source.AUTH_SESSION_DAYS, AUTH_DEFAULTS.SESSION_DAYS) * SECONDS_PER_DAY,
    authSessionAbsoluteSeconds:
      asCount(source.AUTH_SESSION_ABSOLUTE_DAYS, AUTH_DEFAULTS.SESSION_ABSOLUTE_DAYS) *
      SECONDS_PER_DAY,
    authSessionUpdateSeconds:
      asCount(source.AUTH_SESSION_UPDATE_HOURS, AUTH_DEFAULTS.SESSION_UPDATE_HOURS) *
      SECONDS_PER_HOUR,
    authSessionGraceSeconds: asCount(
      source.AUTH_SESSION_GRACE_SECONDS,
      AUTH_DEFAULTS.SESSION_GRACE_SECONDS
    ),
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
