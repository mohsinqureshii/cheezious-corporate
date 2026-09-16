import { DEFAULT_LOCALE } from './locale-lite';

/** Locale-aware formatting used across the public site and the CMS. */

const DATE_LOCALE: Record<string, string> = { en: 'en-PK', ur: 'ur-PK' };

export function formatDate(
  value: Date | string | number,
  locale: string = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? 'en-PK', options).format(date);
}

export function formatDateTime(value: Date | string | number, locale: string = DEFAULT_LOCALE): string {
  return formatDate(value, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Short relative time ("3 days ago") for CMS activity feeds. */
export function formatRelativeTime(value: Date | string | number, locale: string = DEFAULT_LOCALE): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const rtf = new Intl.RelativeTimeFormat(DATE_LOCALE[locale] ?? 'en-PK', { numeric: 'auto' });
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const table: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];
  for (const [unit, seconds] of table) {
    if (Math.abs(diffSeconds) >= seconds) return rtf.format(Math.round(diffSeconds / seconds), unit);
  }
  return rtf.format(diffSeconds, 'second');
}

export function formatNumber(value: number, locale: string = DEFAULT_LOCALE, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(DATE_LOCALE[locale] ?? 'en-PK', options).format(value);
}

/** Human file size, used by the media library and the document centre. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
