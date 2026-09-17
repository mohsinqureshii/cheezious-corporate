import { describe, expect, it } from 'vitest';

import {
  checkPasswordPolicy,
  hashPassword,
  needsRehash,
  safeCompare,
  verifyPassword,
} from '../password';
import { MemoryRateLimitStore, RateLimiter, RATE_LIMITS } from '../rate-limit';
import {
  generateReference,
  generateToken,
  hashToken,
  signPreviewPayload,
  tokensMatch,
  verifyPreviewToken,
} from '../tokens';

describe('password hashing', () => {
  it('produces a verifiable argon2id hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(hash, 'wrong password entirely')).toBe(false);
  });

  it('salts each hash so identical passwords do not collide', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password-12345'),
      hashPassword('same-password-12345'),
    ]);
    expect(a).not.toBe(b);
  });

  it('returns false rather than throwing for a missing or corrupt hash', async () => {
    expect(await verifyPassword(null, 'anything')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });

  it('does not ask for a rehash at current parameters', async () => {
    expect(needsRehash(await hashPassword('another-strong-password'))).toBe(false);
  });
});

describe('password policy', () => {
  it('rejects short, common and predictable passwords', () => {
    expect(checkPasswordPolicy('short').valid).toBe(false);
    expect(checkPasswordPolicy('password123').valid).toBe(false);
    expect(checkPasswordPolicy('cheezious123').valid).toBe(false);
    expect(checkPasswordPolicy('aaaaaaaaaaaaaaaa').valid).toBe(false);
  });

  it('rejects a password containing the user email or name', () => {
    expect(checkPasswordPolicy('ayeshaK!2026xyz', { email: 'ayesha@cheezious.com' }).valid).toBe(
      false,
    );
    expect(checkPasswordPolicy('Ayesha!Khan2026', { name: 'Ayesha Khan' }).valid).toBe(false);
  });

  it('accepts a long passphrase even without symbols', () => {
    const result = checkPasswordPolicy('binding gravel orchard lantern');
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it('accepts a shorter password when it mixes character classes', () => {
    expect(checkPasswordPolicy('Tr#7vQm2Lp!x').valid).toBe(true);
  });
});

describe('opaque tokens', () => {
  it('stores only a digest and matches the original token', () => {
    const token = generateToken();
    const stored = hashToken(token);
    expect(stored).not.toContain(token);
    expect(stored).toHaveLength(64);
    expect(tokensMatch(token, stored)).toBe(true);
    expect(tokensMatch(generateToken(), stored)).toBe(false);
  });

  it('compares strings without leaking length-independent timing', () => {
    expect(safeCompare('abc', 'abc')).toBe(true);
    expect(safeCompare('abc', 'abd')).toBe(false);
    expect(safeCompare('abc', 'abcd')).toBe(false);
  });

  it('generates distinct, readable submission references', () => {
    const a = generateReference('JOB');
    expect(a).toMatch(/^JOB-\d{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(a).not.toBe(generateReference('JOB'));
  });
});

describe('preview tokens', () => {
  const secret = 'a-preview-secret-that-is-at-least-32-chars';
  const payload = {
    entityType: 'page',
    entityId: 'page_1',
    locale: 'en',
    expiresAt: Date.now() + 60_000,
  };

  it('round-trips a signed payload', () => {
    const token = signPreviewPayload(payload, secret);
    expect(verifyPreviewToken(token, secret)).toMatchObject({ entityId: 'page_1', locale: 'en' });
  });

  it('rejects a token signed with a different secret', () => {
    const token = signPreviewPayload(payload, 'a-completely-different-secret-value-32');
    expect(verifyPreviewToken(token, secret)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = signPreviewPayload(payload, secret);
    const [body, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...payload, entityId: 'page_secret' }),
      'utf8',
    ).toString('base64url');
    expect(body).not.toBe(forged);
    expect(verifyPreviewToken(`${forged}.${signature}`, secret)).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = signPreviewPayload({ ...payload, expiresAt: Date.now() - 1000 }, secret);
    expect(verifyPreviewToken(expired, secret)).toBeNull();
  });

  it('rejects malformed input without throwing', () => {
    expect(verifyPreviewToken('', secret)).toBeNull();
    expect(verifyPreviewToken('garbage', secret)).toBeNull();
    expect(verifyPreviewToken('a.b.c', secret)).toBeNull();
  });
});

describe('rate limiter', () => {
  it('allows up to the limit then refuses within the window', async () => {
    const limiter = new RateLimiter(new MemoryRateLimitStore());
    const rule = { limit: 3, windowMs: 60_000 };

    for (let i = 0; i < 3; i += 1) {
      expect((await limiter.check('ip:1.2.3.4', rule)).allowed).toBe(true);
    }
    const blocked = await limiter.check('ip:1.2.3.4', rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks each key independently', async () => {
    const limiter = new RateLimiter(new MemoryRateLimitStore());
    const rule = { limit: 1, windowMs: 60_000 };
    expect((await limiter.check('a', rule)).allowed).toBe(true);
    expect((await limiter.check('b', rule)).allowed).toBe(true);
    expect((await limiter.check('a', rule)).allowed).toBe(false);
  });

  it('keeps public write limits much stricter than public reads', () => {
    expect(RATE_LIMITS.jobApplication.limit).toBeLessThan(RATE_LIMITS.publicRead.limit);
    expect(RATE_LIMITS.login.limit).toBeLessThan(RATE_LIMITS.publicRead.limit);
  });
});
