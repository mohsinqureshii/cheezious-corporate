import { z } from 'zod';

/**
 * Environment validation.
 *
 * Every process in the platform boots through one of these schemas. A missing or
 * malformed variable fails fast at startup with a readable report rather than
 * surfacing as an undefined value somewhere deep in a request handler.
 */

const nonEmpty = (label: string) => z.string().min(1, `${label} must not be empty`);

const secret = (label: string) =>
  z
    .string()
    .min(32, `${label} must be at least 32 characters. Generate with: openssl rand -base64 48`);

const boolish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const port = z.coerce.number().int().min(1).max(65535);

/**
 * A URL that falls back to its default when the platform hands us a broken one.
 *
 * Hosting platforms build these from references to other services — Railway's
 * `https://${{cms.RAILWAY_PUBLIC_DOMAIN}}` and its equivalents. Delete that
 * service's domain and the reference resolves to nothing, leaving `https://`,
 * which is not a URL. Treating that as a fatal misconfiguration means removing
 * a domain from the CMS takes the whole API offline — which is what happened,
 * and is far out of proportion to what these values are for: building links
 * back to the other applications.
 *
 * A genuinely malformed value still fails. Only the empty and scheme-only
 * cases, which is precisely what an unresolved reference produces, fall back.
 */
const serviceUrl = (fallback: string) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' || /^https?:\/\/$/.test(trimmed) ? undefined : trimmed;
  }, z.string().url().default(fallback));

const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

export const runtimeSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
});

export const databaseSchema = z.object({
  DATABASE_URL: nonEmpty('DATABASE_URL').url('DATABASE_URL must be a valid connection URL'),
  DIRECT_DATABASE_URL: z.string().url().optional().or(z.literal('')),
});

export const apiSchema = runtimeSchema.merge(databaseSchema).extend({
  /**
   * Railway, Fly, Heroku and Cloud Run all inject `PORT` and expect the process
   * to bind exactly that. `API_PORT` stays the name the rest of the codebase
   * uses, and `PORT` wins wherever a platform sets it — see the transform at
   * the bottom of this schema.
   */
  PORT: port.optional(),
  API_PORT: port.default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  API_PUBLIC_URL: serviceUrl('http://localhost:4000'),

  CORPORATE_WEB_URL: serviceUrl('http://localhost:3000'),
  CMS_URL: serviceUrl('http://localhost:3001'),

  REDIS_URL: z.string().url().optional().or(z.literal('')),

  SESSION_SECRET: secret('SESSION_SECRET'),
  PREVIEW_SECRET: secret('PREVIEW_SECRET'),
  REVALIDATE_SECRET: secret('REVALIDATE_SECRET'),
  INTERNAL_API_KEY: secret('INTERNAL_API_KEY'),

  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(120),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(60),
  MAX_FAILED_LOGINS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),

  CORS_ALLOWED_ORIGINS: csv,

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_ROOT: z.string().default('./.storage'),
  STORAGE_PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000/media'),

  S3_ENDPOINT: z.string().optional().or(z.literal('')),
  S3_REGION: z.string().optional().or(z.literal('')),
  S3_BUCKET: z.string().optional().or(z.literal('')),
  S3_ACCESS_KEY_ID: z.string().optional().or(z.literal('')),
  S3_SECRET_ACCESS_KEY: z.string().optional().or(z.literal('')),
  S3_FORCE_PATH_STYLE: boolish.default('true'),

  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),
  MAX_APPLICATION_UPLOAD_MB: z.coerce.number().int().positive().default(10),

  SMTP_URL: z.string().optional().or(z.literal('')),
  MAIL_FROM: z.string().default('Cheezious Corporate <no-reply@example.com>'),

  /**
   * Run the background worker inside the API process.
   *
   * Off by default, because a separate worker is the better arrangement: a long
   * job cannot block a request, and the two scale independently. Turning it on
   * trades that for one fewer service to deploy, which is the right trade at
   * low traffic. Never turn it on with more than one API replica — each replica
   * would run its own loop.
   */
  RUN_WORKER: boolish.default('false'),
});

/**
 * The schema every API process boots through.
 *
 * The transform exists for one reason: a platform-injected `PORT` has to beat
 * the configured `API_PORT`, and doing that here means it is true for the API,
 * the worker and the tests at once rather than at each call site.
 */
export const apiEnvSchema = apiSchema.transform((env) => ({
  ...env,
  API_PORT: env.PORT ?? env.API_PORT,
}));

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const publicWebSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['en', 'ur']).default('en'),
  NEXT_PUBLIC_CONSUMER_SITE_URL: z.string().url().default('https://cheezious.com'),
  NEXT_PUBLIC_SEO_NOINDEX: z.enum(['0', '1']).default('0'),
  NEXT_PUBLIC_ANALYTICS_ADAPTER: z.string().default('console'),
});

export type PublicWebEnv = z.infer<typeof publicWebSchema>;

export const cmsSchema = z.object({
  NEXT_PUBLIC_CMS_API_URL: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
});

export type CmsEnv = z.infer<typeof cmsSchema>;

export class EnvironmentValidationError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    const lines = issues.map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`);
    super(
      `Invalid environment configuration:\n${lines.join('\n')}\n\n` +
        'See .env.example for the full list of supported variables.',
    );
    this.name = 'EnvironmentValidationError';
  }
}

/** Parse `source` against `schema`, throwing a readable aggregate error on failure. */
export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) throw new EnvironmentValidationError(result.error.issues);
  return result.data;
}

/**
 * In development we allow placeholder secrets so a fresh clone boots after a
 * plain `cp .env.example .env`. In production the placeholders are rejected.
 */
export function assertProductionSecrets(
  env: Pick<
    ApiEnv,
    'NODE_ENV' | 'SESSION_SECRET' | 'PREVIEW_SECRET' | 'REVALIDATE_SECRET' | 'INTERNAL_API_KEY'
  >,
): void {
  if (env.NODE_ENV !== 'production') return;
  const placeholders: Array<[string, string]> = [
    ['SESSION_SECRET', env.SESSION_SECRET],
    ['PREVIEW_SECRET', env.PREVIEW_SECRET],
    ['REVALIDATE_SECRET', env.REVALIDATE_SECRET],
    ['INTERNAL_API_KEY', env.INTERNAL_API_KEY],
  ];
  const offenders = placeholders.filter(([, v]) => v.startsWith('replace-me')).map(([k]) => k);
  if (offenders.length > 0) {
    throw new Error(
      `Refusing to start in production with placeholder secrets: ${offenders.join(', ')}. ` +
        'Generate real values with: openssl rand -base64 48',
    );
  }
}
