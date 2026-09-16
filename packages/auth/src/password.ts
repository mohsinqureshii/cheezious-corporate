import { randomBytes, timingSafeEqual } from 'node:crypto';

import argon2 from 'argon2';

/**
 * Password hashing.
 *
 * Argon2id with parameters at the upper end of the OWASP recommendation. The
 * `type`, memory cost and parallelism are embedded in the stored hash, so these
 * values can be raised later without invalidating existing passwords — verify
 * reads the parameters from the hash itself.
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Verify a password. Returns false rather than throwing on a malformed hash, so
 * a corrupted row cannot turn into a 500 that distinguishes it from a wrong
 * password.
 */
export async function verifyPassword(hash: string | null | undefined, plaintext: string): Promise<boolean> {
  if (!hash) {
    // Spend comparable time anyway so "no password set" is not observable by timing.
    await argon2.hash(plaintext, ARGON2_OPTIONS).catch(() => undefined);
    return false;
  }
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

/** True when the stored hash was produced with weaker parameters than current policy. */
export function needsRehash(hash: string): boolean {
  try {
    return argon2.needsRehash(hash, ARGON2_OPTIONS);
  } catch {
    return true;
  }
}

export interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
  /** 0–4, suitable for a strength meter. */
  score: number;
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', 'qwerty123',
  'letmein', 'welcome1', 'admin123', 'changeme', 'cheezious', 'cheezious123',
]);

/**
 * Password policy. Length is weighted far more heavily than character-class
 * rules, which is what actually resists offline attack.
 */
export function checkPasswordPolicy(password: string, context: { email?: string; name?: string } = {}): PasswordPolicyResult {
  const errors: string[] = [];

  if (password.length < 12) errors.push('Use at least 12 characters.');
  if (password.length > 200) errors.push('Use no more than 200 characters.');

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) errors.push('This password is too common. Choose something less predictable.');

  const localPart = context.email?.split('@')[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && lower.includes(localPart)) {
    errors.push('Do not include your email address in your password.');
  }
  if (context.name) {
    for (const part of context.name.toLowerCase().split(/\s+/)) {
      if (part.length >= 4 && lower.includes(part)) {
        errors.push('Do not include your name in your password.');
        break;
      }
    }
  }
  if (/^(.)\1+$/.test(password)) errors.push('Do not use a single repeated character.');

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (password.length < 16 && classes < 3) {
    errors.push('Use a longer password, or mix upper case, lower case, numbers and symbols.');
  }

  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (password.length >= 20) score += 1;
  if (classes >= 3) score += 1;
  if (errors.length > 0) score = Math.min(score, 1);

  return { valid: errors.length === 0, errors, score: Math.min(4, score) };
}

/** Constant-time comparison for opaque tokens. */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still perform a comparison to keep timing uniform.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Generate a temporary password for an invited user. */
export function generateTemporaryPassword(): string {
  // Avoids ambiguous characters so it can be read aloud or copied reliably.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(20);
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10, 15)}-${out.slice(15, 20)}`;
}
