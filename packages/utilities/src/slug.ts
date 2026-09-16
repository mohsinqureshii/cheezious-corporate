/**
 * Slug utilities.
 *
 * Latin text is transliterated/normalised in the usual way. Urdu (and other
 * Arabic-script) text is preserved rather than stripped, because an Urdu page
 * whose slug collapses to an empty string is worse than a non-ASCII slug —
 * modern browsers and search engines handle percent-encoded UTF-8 paths fine.
 */

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

export function slugify(input: string, options: { maxLength?: number } = {}): string {
  const { maxLength = 96 } = options;
  const trimmed = input.trim();
  if (!trimmed) return '';

  const preserveScript = ARABIC_SCRIPT.test(trimmed);

  let slug = trimmed
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks
    .toLowerCase();

  slug = preserveScript
    ? slug.replace(/[^\p{L}\p{N}]+/gu, '-')
    : slug.replace(/[^a-z0-9]+/g, '-');

  slug = slug.replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');

  if (slug.length > maxLength) {
    slug = slug.slice(0, maxLength).replace(/-+[^-]*$/, '').replace(/-+$/, '');
  }
  return slug;
}

/** Produce a slug not present in `taken`, appending -2, -3, … as required. */
export function uniqueSlug(base: string, taken: Iterable<string>, options: { maxLength?: number } = {}): string {
  const existing = new Set(taken);
  const root = slugify(base, options) || 'item';
  if (!existing.has(root)) return root;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${root}-${n}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/** Normalise a site path: leading slash, no trailing slash, collapsed separators. */
export function normalizePath(path: string): string {
  if (!path) return '/';
  const collapsed = `/${path}`.replace(/\/{2,}/g, '/');
  const withoutTrailing = collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;
  return withoutTrailing || '/';
}

/** Join path segments into a normalised site path. */
export function joinPath(...segments: Array<string | null | undefined>): string {
  return normalizePath(segments.filter(Boolean).join('/'));
}
