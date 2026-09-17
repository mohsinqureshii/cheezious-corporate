import { describe, expect, it } from 'vitest';

import { formatFileSize, formatRelativeTime } from '../format';
import { deepEqual, stableStringify } from '../object';
import { joinPath, normalizePath, slugify, uniqueSlug } from '../slug';
import { htmlToText, readingTimeMinutes, truncate } from '../text';

/**
 * These helpers are small, shared by every surface, and wrong in ways that are
 * hard to see: a slug that collapses to nothing takes a page's URL with it, and
 * a path that keeps its trailing slash quietly becomes a second address for the
 * same page.
 */

describe('slugify', () => {
  it('produces a readable ASCII slug', () => {
    expect(slugify('Annual Report 2026')).toBe('annual-report-2026');
    expect(slugify('  Leading and trailing  ')).toBe('leading-and-trailing');
    expect(slugify('Punctuation! Everywhere? Yes.')).toBe('punctuation-everywhere-yes');
  });

  it('strips accents rather than dropping the letters', () => {
    expect(slugify('Café Manager')).toBe('cafe-manager');
  });

  it('keeps Urdu rather than collapsing it to nothing', () => {
    // A slug that empties itself takes the page's URL with it, so Arabic-script
    // text is preserved instead of stripped. Percent-encoded UTF-8 paths are
    // handled correctly by browsers and search engines.
    const slug = slugify('کمپنی کی خبریں');
    expect(slug).not.toBe('');
    expect(slug).toContain('کمپنی');
    expect(slug).not.toContain(' ');
  });

  it('truncates on a separator rather than mid-word', () => {
    const slug = slugify('a-very-long-title-that-will-certainly-be-cut-somewhere', {
      maxLength: 20,
    });
    expect(slug.length).toBeLessThanOrEqual(20);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('returns an empty string for input with nothing sluggable in it', () => {
    expect(slugify('   ')).toBe('');
    expect(slugify('!!!')).toBe('');
  });
});

describe('uniqueSlug', () => {
  it('suffixes rather than failing on a collision', () => {
    expect(uniqueSlug('Annual Report', [])).toBe('annual-report');
    expect(uniqueSlug('Annual Report', ['annual-report'])).toBe('annual-report-2');
    expect(uniqueSlug('Annual Report', ['annual-report', 'annual-report-2'])).toBe(
      'annual-report-3',
    );
  });

  it('falls back to a usable slug when the input has none', () => {
    expect(uniqueSlug('!!!', [])).toBe('item');
  });
});

describe('normalizePath', () => {
  it('gives every path exactly one form', () => {
    // Two spellings of one address is two URLs for one page, which is a
    // duplicate-content problem and a broken redirect waiting to happen.
    expect(normalizePath('company')).toBe('/company');
    expect(normalizePath('/company/')).toBe('/company');
    expect(normalizePath('//company//news//')).toBe('/company/news');
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('/')).toBe('/');
  });

  it('joins segments into one normalised path', () => {
    expect(joinPath('/company', 'newsroom', 'stories')).toBe('/company/newsroom/stories');
    expect(joinPath('/company/', null, '/news/', undefined)).toBe('/company/news');
  });
});

describe('htmlToText', () => {
  it('keeps the words and loses the markup', () => {
    expect(htmlToText('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('does not let a block boundary run two words together', () => {
    expect(htmlToText('<p>One</p><p>Two</p>')).toBe('One Two');
  });

  it('drops script and style content entirely', () => {
    expect(htmlToText('<p>Safe</p><script>alert(1)</script>')).toBe('Safe');
    expect(htmlToText('<style>p{color:red}</style><p>Safe</p>')).toBe('Safe');
  });

  it('decodes the entities a meta description would otherwise show raw', () => {
    expect(htmlToText('<p>Fish &amp; chips &quot;today&quot;</p>')).toBe('Fish & chips "today"');
  });
});

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('Short', 20)).toBe('Short');
  });

  it('cuts on a word boundary and marks the cut', () => {
    const result = truncate('The quick brown fox jumps over the lazy dog', 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('  ');
  });

  it('does not leave punctuation stranded before the ellipsis', () => {
    expect(truncate('One sentence ends, another begins here', 18)).not.toContain(',…');
  });
});

describe('readingTimeMinutes', () => {
  it('never reports zero minutes', () => {
    expect(readingTimeMinutes('One word')).toBe(1);
  });

  it('scales with length', () => {
    const long = 'word '.repeat(880);
    expect(readingTimeMinutes(long)).toBe(4);
  });
});

describe('stableStringify and deepEqual', () => {
  it('ignores key order, which is what makes a diff meaningful', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('does not treat a different array order as equal', () => {
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });
});

describe('formatting', () => {
  it('describes file sizes at a human scale', () => {
    expect(formatFileSize(512)).toMatch(/512/);
    expect(formatFileSize(1024 * 1024)).toMatch(/MB/i);
  });

  it('describes a recent time relatively', () => {
    const justNow = new Date(Date.now() - 30_000).toISOString();
    expect(formatRelativeTime(justNow)).toMatch(/second|now/i);
  });
});
