import { z } from 'zod';

/** Reusable primitives so validation rules stay identical across every module. */

export const cuid = z.string().cuid();
export const localeSchema = z.enum(['en', 'ur']);

/** Trims, then rejects empty — prevents "   " passing a required check. */
export const requiredString = (label: string, max = 500) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(1, `${label} is required`)
        .max(max, `${label} must be ${max} characters or fewer`),
    );

export const optionalString = (max = 500) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(max))
    .optional()
    .or(z.literal('').transform(() => undefined));

export const email = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.string().email('Enter a valid email address').max(254));

/**
 * Pakistani and international phone numbers. Deliberately permissive about
 * formatting (spaces, dashes, parentheses) and strict only about the digits,
 * because rejecting "0301 234 5678" would fail real applicants.
 */
export const phone = z
  .string()
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(7, 'Enter a valid phone number')
      .max(32)
      .regex(/^[+]?[\d\s()./-]{7,32}$/, 'Enter a valid phone number'),
  );

/** Only http(s). Rejects javascript:, data: and other scheme-based injection. */
export const httpUrl = z
  .string()
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .url('Enter a valid URL')
      .max(2048)
      .refine((v) => /^https?:\/\//i.test(v), 'The URL must start with http:// or https://'),
  );

export const optionalHttpUrl = httpUrl.optional().or(z.literal('').transform(() => undefined));

export const slug = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, 'A slug is required')
      .max(96)
      .regex(
        /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u,
        'Use lower-case letters, numbers and single hyphens',
      ),
  );

/** Site path without a locale prefix. */
export const sitePath = z
  .string()
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(1)
      .max(512)
      .regex(/^\/(?:[\p{L}\p{N}\-_/]*)$/u, 'A path must start with / and contain no spaces')
      .refine((v) => !v.includes('//'), 'A path must not contain //')
      .refine((v) => v === '/' || !v.endsWith('/'), 'A path must not end with /'),
  );

export const isoDate = z.coerce.date();

export const positiveInt = z.coerce.number().int().positive();
export const nonNegativeInt = z.coerce.number().int().min(0);

export const sortOrder = z.coerce.number().int().min(0).max(100000).default(0);

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const sortQuery = z.object({
  sortBy: z.string().max(64).optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Explicit consent. A boolean `true` is required — a missing or false value
 * fails, so a submission can never be stored without recorded consent.
 */
export const consent = z.literal(true, {
  errorMap: () => ({ message: 'You must agree before submitting this form' }),
});

/** Anti-spam fields present on every public form. */
/**
 * Bot defences shared by every public form.
 *
 * The honeypot is called `contactFax` rather than something like `website`
 * precisely because several of these forms collect a real website: a honeypot
 * that shares a name with a genuine field does not catch bots, it rejects
 * suppliers. It has to be plausible enough for an automated filler to complete
 * and a name no real form here will ever use.
 */
export const spamGuard = z.object({
  /**
   * Honeypot: must stay empty. Bots fill every field they find.
   *
   * Accepted by the schema and rejected afterwards, deliberately. A field-level
   * validation error would come back naming `contactFax`, which tells whoever is
   * automating the form exactly which field to leave alone next time.
   */
  contactFax: z.string().max(200).optional(),
  /** Milliseconds the form was on screen. Instant submissions are automated. */
  elapsedMs: z.coerce.number().int().min(0).optional(),
});
