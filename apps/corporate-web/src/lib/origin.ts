/**
 * Where this site thinks it lives.
 *
 * Two questions that look the same and are not. A redirect needs the origin the
 * visitor is actually using, which only the request knows. A canonical URL needs
 * the origin the site is *published* at, which only configuration knows — it has
 * to be the same for every visitor, or search engines see a different canonical
 * per hostname and the site competes with itself.
 *
 * Both are here because both were getting the answer from something that looked
 * authoritative and wasn't, and the failure in each case was silent.
 */

/** Read a header, taking the first value of a comma-joined list. */
type HeaderReader = (name: string) => string | null | undefined;

/**
 * The origin the visitor actually used, for redirects.
 *
 * Next's `request.url` cannot be used for this. Self-hosted behind a proxy, Next
 * builds it from the address the server is bound to and ignores the `Host`
 * header entirely, so every redirect it produces points at `localhost:3000` —
 * a broken site for everyone who is not the server itself.
 *
 * The host comes from `Host` in preference to `X-Forwarded-Host`: the edge that
 * routes to this service picks it by `Host`, so that header is the one name
 * known to reach us, and preferring it stops a forged `X-Forwarded-Host` from
 * turning our own redirect into a hop to someone else's site. The scheme has no
 * such source and must come from the proxy, which terminated the TLS.
 */
export function resolveRequestOrigin(
  header: HeaderReader,
  fallback: { url: string; scheme: string },
): string {
  const first = (name: string): string | undefined => {
    const value = header(name);
    if (typeof value !== 'string') return undefined;
    return value.split(',')[0]?.trim() || undefined;
  };

  const host = first('host') ?? first('x-forwarded-host');
  if (!host) return fallback.url;

  return `${first('x-forwarded-proto') ?? fallback.scheme}://${host}`;
}

/**
 * The published origin, for canonicals, hreflang, JSON-LD and the sitemap.
 *
 * Resolved at runtime first and only then from the build. `NEXT_PUBLIC_*` is
 * compiled into the bundle, so a deployment that learns its own domain after the
 * image was built — which is every deployment on a platform that assigns one —
 * cannot correct it without rebuilding. `SITE_URL` is read from the environment
 * of the running server, so it takes effect on restart.
 *
 * `RAILWAY_PUBLIC_DOMAIN` is the last resort before localhost: on Railway it
 * makes a correct canonical the default rather than something to remember. A
 * service with more than one domain gets whichever the platform names primary,
 * which is the one that should be canonical.
 */
export function resolveSiteUrl(env: Record<string, string | undefined>): string {
  const railwayDomain = clean(env.RAILWAY_PUBLIC_DOMAIN);

  const configured =
    clean(env.SITE_URL) ??
    clean(env.NEXT_PUBLIC_SITE_URL) ??
    (railwayDomain ? `https://${railwayDomain}` : undefined) ??
    'http://localhost:3000';

  return configured.replace(/\/+$/, '');
}

/** Treat empty and protocol-only values as unset — a deleted domain leaves one. */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || /^https?:\/\/$/.test(trimmed)) return undefined;
  return trimmed;
}
