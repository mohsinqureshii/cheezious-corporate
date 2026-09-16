import { createHash, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Opaque token handling.
 *
 * Session tokens, password-reset tokens and preview tokens are all high-entropy
 * random strings. Only their SHA-256 digest is persisted, so a database leak
 * does not hand an attacker usable credentials.
 */

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokensMatch(token: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashToken(token), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

/**
 * Signed preview links.
 *
 * A preview URL carries the entity, locale and expiry in the clear plus an HMAC,
 * so the public site can validate a preview request without a database round
 * trip while remaining unforgeable.
 */
export interface PreviewPayload {
  entityType: string;
  entityId: string;
  locale: string;
  expiresAt: number;
}

export function signPreviewPayload(payload: PreviewPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyPreviewToken(token: string, secret: string): PreviewPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PreviewPayload;
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt < Date.now()) return null;
    if (!payload.entityType || !payload.entityId) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Hash an IP address for rate limiting and abuse detection without storing it. */
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/** Human-readable, non-guessable reference shown to a form submitter. */
export function generateReference(prefix: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}
