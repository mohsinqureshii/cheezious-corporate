import { describe, expect, it } from 'vitest';

import { consent, email, httpUrl, phone, sitePath, slug } from '../primitives';
import { escapeHtml, isSafeUrl, sanitizeHtml } from '../sanitize';
import { PUBLIC_UPLOAD_MIMES, sanitizeFilename, validateUpload } from '../uploads';

describe('primitives', () => {
  it('normalises and validates email addresses', () => {
    expect(email.parse('  Ayesha@Cheezious.COM ')).toBe('ayesha@cheezious.com');
    expect(email.safeParse('not-an-email').success).toBe(false);
  });

  it('accepts real Pakistani phone formats', () => {
    for (const value of ['0301 234 5678', '+92 301 2345678', '(051) 111-222-333', '051-1112223']) {
      expect(phone.safeParse(value).success, value).toBe(true);
    }
    expect(phone.safeParse('12345').success).toBe(false);
    expect(phone.safeParse('call me maybe').success).toBe(false);
  });

  it('refuses non-http URL schemes', () => {
    expect(httpUrl.safeParse('https://cheezious.com').success).toBe(true);
    expect(httpUrl.safeParse('javascript:alert(1)').success).toBe(false);
    expect(httpUrl.safeParse('data:text/html,<script>').success).toBe(false);
  });

  it('validates slugs including Urdu script', () => {
    expect(slug.parse('Food-Safety')).toBe('food-safety');
    expect(slug.safeParse('قیادت').success).toBe(true);
    expect(slug.safeParse('has spaces').success).toBe(false);
    expect(slug.safeParse('double--hyphen').success).toBe(false);
  });

  it('validates site paths', () => {
    expect(sitePath.safeParse('/company/leadership').success).toBe(true);
    expect(sitePath.safeParse('/').success).toBe(true);
    expect(sitePath.safeParse('company/leadership').success).toBe(false);
    expect(sitePath.safeParse('/company//leadership').success).toBe(false);
    expect(sitePath.safeParse('/company/leadership/').success).toBe(false);
  });

  it('requires explicit consent', () => {
    expect(consent.safeParse(true).success).toBe(true);
    expect(consent.safeParse(false).success).toBe(false);
    expect(consent.safeParse(undefined).success).toBe(false);
  });
});

describe('html sanitisation', () => {
  it('removes script tags and their contents', () => {
    const result = sanitizeHtml('<p>Safe</p><script>alert("xss")</script>');
    expect(result).toContain('<p>Safe</p>');
    expect(result).not.toContain('script');
    expect(result).not.toContain('alert');
  });

  it('strips event handler attributes', () => {
    const result = sanitizeHtml('<p onclick="steal()">Text</p>');
    expect(result).toBe('<p>Text</p>');
  });

  it('strips inline styles', () => {
    expect(sanitizeHtml('<p style="position:fixed">x</p>')).toBe('<p>x</p>');
  });

  it('removes javascript: links but keeps safe ones', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">bad</a>')).toBe('<a>bad</a>');
    expect(sanitizeHtml('<a href="https://cheezious.com">good</a>')).toContain('href="https://cheezious.com"');
  });

  it('adds rel="noopener noreferrer" to links opening in a new tab', () => {
    const result = sanitizeHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('drops disallowed elements but keeps editorial ones', () => {
    const result = sanitizeHtml('<iframe src="https://evil"></iframe><h2>Heading</h2><blockquote>Quote</blockquote>');
    expect(result).not.toContain('iframe');
    expect(result).toContain('<h2>Heading</h2>');
    expect(result).toContain('<blockquote>Quote</blockquote>');
  });

  it('keeps internal page references so links survive slug changes', () => {
    const result = sanitizeHtml('<a href="/company" data-page-id="pg_1">Company</a>');
    expect(result).toContain('data-page-id="pg_1"');
  });

  it('escapes text for interpolation', () => {
    expect(escapeHtml('<b>&"')).toBe('&lt;b&gt;&amp;&quot;');
  });

  it('flags dangerous URL schemes', () => {
    expect(isSafeUrl('https://cheezious.com')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('  JavaScript:alert(1)')).toBe(false);
  });
});

describe('upload validation', () => {
  const pdfHead = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const pngHead = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const options = { maxBytes: 10 * 1024 * 1024, allowedMimes: PUBLIC_UPLOAD_MIMES };

  it('accepts a genuine PDF CV', () => {
    const result = validateUpload(
      { filename: 'Ayesha-Khan-CV.pdf', mimeType: 'application/pdf', byteSize: 240_000, head: pdfHead },
      options,
    );
    expect(result.valid).toBe(true);
    expect(result.kind).toBe('DOCUMENT');
  });

  it('rejects a file whose contents contradict its declared type', () => {
    const result = validateUpload(
      { filename: 'cv.pdf', mimeType: 'application/pdf', byteSize: 1000, head: pngHead },
      options,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/do not match/i);
  });

  it('rejects a double extension disguised as a PDF', () => {
    const result = validateUpload(
      { filename: 'cv.pdf.exe', mimeType: 'application/pdf', byteSize: 1000, head: pdfHead },
      options,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Executable/i);
  });

  it('rejects SVG from public forms even though the CMS allows it', () => {
    const result = validateUpload(
      { filename: 'logo.svg', mimeType: 'image/svg+xml', byteSize: 1000 },
      options,
    );
    expect(result.valid).toBe(false);
  });

  it('rejects oversized and empty files', () => {
    expect(validateUpload({ filename: 'a.pdf', mimeType: 'application/pdf', byteSize: 50_000_000 }, options).valid).toBe(false);
    expect(validateUpload({ filename: 'a.pdf', mimeType: 'application/pdf', byteSize: 0 }, options).valid).toBe(false);
  });

  it('strips path traversal and unsafe characters from filenames', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('system32');
    expect(sanitizeFilename('my cv (final).pdf')).toBe('my-cv-final-.pdf');
    expect(sanitizeFilename('.hidden')).toBe('hidden');
    expect(sanitizeFilename('')).toBe('file');
  });

  it('preserves Urdu filenames', () => {
    expect(sanitizeFilename('سی-وی.pdf')).toBe('سی-وی.pdf');
  });
});
