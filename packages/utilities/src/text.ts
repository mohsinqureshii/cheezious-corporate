/** Text helpers used by content modelling, SEO defaults and CMS previews. */

const BLOCK_LEVEL = /<\/(p|div|section|article|h[1-6]|li|tr|blockquote)>/gi;

/** Strip HTML to readable plain text (used for excerpts and meta descriptions). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(BLOCK_LEVEL, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Truncate on a word boundary, appending an ellipsis only when text was cut. */
export function truncate(input: string, maxLength: number, ellipsis = '…'): string {
  const text = input.trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - ellipsis.length);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,.;:—-]+$/, '')}${ellipsis}`;
}

/** Rough reading time in minutes, floored at 1. */
export function readingTimeMinutes(text: string, wordsPerMinute = 220): number {
  const words = htmlToText(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / wordsPerMinute));
}

export function titleCase(input: string): string {
  return input.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Initials for avatar fallbacks (max two characters). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return `${(parts[0] ?? '')[0] ?? ''}${(parts[parts.length - 1] ?? '')[0] ?? ''}`.toUpperCase();
}
