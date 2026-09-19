import { describe, expect, it } from 'vitest';

import { resolveRequestOrigin, resolveSiteUrl } from './origin';

/** Build a header reader from a plain object, as a request would expose one. */
function headers(values: Record<string, string>) {
  return (name: string) => values[name.toLowerCase()] ?? null;
}

const FALLBACK = { url: 'http://localhost:3000/', scheme: 'http' };

describe('resolveRequestOrigin', () => {
  it('uses the host the visitor asked for, not the port the server is bound to', () => {
    expect(resolveRequestOrigin(headers({ host: 'corporate.example' }), FALLBACK)).toBe(
      'http://corporate.example',
    );
  });

  it('takes the scheme from the proxy that terminated TLS', () => {
    const header = headers({ host: 'corporate.example', 'x-forwarded-proto': 'https' });
    expect(resolveRequestOrigin(header, FALLBACK)).toBe('https://corporate.example');
  });

  it('reads the first entry of a chained forwarded header', () => {
    const header = headers({ host: 'corporate.example', 'x-forwarded-proto': 'https, http' });
    expect(resolveRequestOrigin(header, FALLBACK)).toBe('https://corporate.example');
  });

  it('ignores a forged X-Forwarded-Host when a real Host is present', () => {
    const header = headers({ host: 'corporate.example', 'x-forwarded-host': 'attacker.example' });
    expect(resolveRequestOrigin(header, FALLBACK)).toBe('http://corporate.example');
  });

  it('falls back to X-Forwarded-Host only when there is no Host at all', () => {
    const header = headers({ 'x-forwarded-host': 'corporate.example' });
    expect(resolveRequestOrigin(header, FALLBACK)).toBe('http://corporate.example');
  });

  it('falls back to the request URL when the request names no host', () => {
    expect(resolveRequestOrigin(headers({}), FALLBACK)).toBe(FALLBACK.url);
  });

  it('keeps the port, because a host with one is a different origin', () => {
    expect(resolveRequestOrigin(headers({ host: 'corporate.example:8080' }), FALLBACK)).toBe(
      'http://corporate.example:8080',
    );
  });
});

describe('resolveSiteUrl', () => {
  it('prefers the runtime value, so a bad build can be corrected without rebuilding', () => {
    expect(
      resolveSiteUrl({
        SITE_URL: 'https://corporate.example',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      }),
    ).toBe('https://corporate.example');
  });

  it('uses the compiled value when nothing is set at runtime', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://corporate.example' })).toBe(
      'https://corporate.example',
    );
  });

  it("derives the origin from Railway's assigned domain", () => {
    expect(resolveSiteUrl({ RAILWAY_PUBLIC_DOMAIN: 'app-production.up.railway.app' })).toBe(
      'https://app-production.up.railway.app',
    );
  });

  it('treats a protocol-only leftover as unset, as a deleted domain leaves', () => {
    expect(
      resolveSiteUrl({ SITE_URL: 'https://', RAILWAY_PUBLIC_DOMAIN: 'app.up.railway.app' }),
    ).toBe('https://app.up.railway.app');
  });

  it('treats blank as unset', () => {
    expect(
      resolveSiteUrl({ SITE_URL: '   ', NEXT_PUBLIC_SITE_URL: 'https://corporate.example' }),
    ).toBe('https://corporate.example');
  });

  it('strips trailing slashes, which would otherwise double in every canonical', () => {
    expect(resolveSiteUrl({ SITE_URL: 'https://corporate.example//' })).toBe(
      'https://corporate.example',
    );
  });

  it('falls back to localhost when nothing is configured', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });
});
