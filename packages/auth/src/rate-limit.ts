/**
 * Rate limiting.
 *
 * A fixed-window counter behind a small interface. The in-memory store is the
 * default and is correct for a single process; `RedisRateLimitStore` is used
 * when REDIS_URL is configured and multiple API instances share limits.
 */

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = Date.now();

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    this.sweep(now);

    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      return fresh;
    }
    existing.count += 1;
    return existing;
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  /** Drop expired buckets periodically so the map cannot grow without bound. */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

export interface RateLimitRule {
  /** Requests allowed within the window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export class RateLimiter {
  constructor(private readonly store: RateLimitStore = new MemoryRateLimitStore()) {}

  async check(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const { count, resetAt } = await this.store.increment(key, rule.windowMs);
    const allowed = count <= rule.limit;
    return {
      allowed,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - count),
      resetAt,
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
    };
  }

  async reset(key: string): Promise<void> {
    await this.store.reset(key);
  }
}

/**
 * Named rules. Public write endpoints are far stricter than reads because each
 * one creates a database row and, in several cases, sends an email.
 */
export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  passwordResetRequest: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordResetConfirm: { limit: 10, windowMs: 60 * 60 * 1000 },
  publicRead: { limit: 300, windowMs: 60 * 1000 },
  publicSearch: { limit: 60, windowMs: 60 * 1000 },
  jobApplication: { limit: 5, windowMs: 60 * 60 * 1000 },
  supplierSubmission: { limit: 5, windowMs: 60 * 60 * 1000 },
  propertySubmission: { limit: 5, windowMs: 60 * 60 * 1000 },
  partnershipSubmission: { limit: 5, windowMs: 60 * 60 * 1000 },
  contactSubmission: { limit: 8, windowMs: 60 * 60 * 1000 },
  formSubmission: { limit: 10, windowMs: 60 * 60 * 1000 },
  cmsWrite: { limit: 240, windowMs: 60 * 1000 },
  cmsUpload: { limit: 60, windowMs: 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;
