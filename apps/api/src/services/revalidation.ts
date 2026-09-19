import { CACHE_TAGS, type Locale } from '@cheezious/config';

import type { AppContext } from '../lib/context';

/**
 * Tell the public site that something changed.
 *
 * The site is statically generated with a revalidation window. Without this, a
 * publish takes up to that window to appear — five minutes during which the
 * person who published it refreshes and wonders whether it worked.
 *
 * Three rules:
 *
 *   1. **It never fails the operation.** A publish that succeeded and a cache
 *      that did not clear is a delay; a publish rolled back because a cache
 *      could not be reached is data loss. Failures are logged, not thrown.
 *   2. **It is not awaited on the request path where it does not have to be.**
 *      The caller decides; most call it without blocking the response.
 *   3. **It names tags rather than paths where it can.** Everything the site
 *      fetches is tagged, so invalidating a tag clears exactly the pages holding
 *      that content rather than guessing at URLs.
 */

export interface RevalidationTarget {
  tags?: string[];
  paths?: string[];
}

/**
 * The sitemap is named as a path as well as by tag.
 *
 * It renders per request today, so the tag is what actually clears it and the
 * path costs nothing. It is kept because a route handler that is cached again
 * later would hold its own entry, which no tag reaches — and the failure then is
 * silent: a sitemap that looks right and is a day old.
 */
const SITEMAP_PATH = '/sitemap.xml';

export class RevalidationService {
  constructor(private readonly ctx: AppContext) {}

  /** A page, by its path and locale, plus anything listing pages. */
  page(locale: Locale, path: string, previousPath?: string | null): RevalidationTarget {
    const paths = [`/${locale}${path}`];
    // A rename has to clear the old address too, or the redirect is masked by a
    // cached copy of the page that used to live there.
    if (previousPath && previousPath !== path) paths.push(`/${locale}${previousPath}`);

    return {
      tags: [
        CACHE_TAGS.pathname(`${locale}${path}`),
        CACHE_TAGS.collection('pages'),
        CACHE_TAGS.sitemap,
      ],
      paths: [...paths, SITEMAP_PATH],
    };
  }

  /**
   * A collection record: its own listing, and the sitemap.
   *
   * `names` are the public site's tag names, which are not the API's route
   * segments — see `cacheTags` on the collection config for why that distinction
   * is worth the extra field.
   */
  collection(names: string | string[], paths: string[] = []): RevalidationTarget {
    const list = Array.isArray(names) ? names : [names];
    return {
      tags: [...list.map((name) => CACHE_TAGS.collection(name)), CACHE_TAGS.sitemap],
      paths: [...paths, SITEMAP_PATH],
    };
  }

  /** Site-wide furniture. */
  structure(): RevalidationTarget {
    return { tags: [CACHE_TAGS.navigation, CACHE_TAGS.footer, CACHE_TAGS.settings] };
  }

  async revalidate(target: RevalidationTarget): Promise<void> {
    const { env, logger } = this.ctx;
    if (!env.REVALIDATE_SECRET) return;

    try {
      const response = await fetch(`${publicSiteOrigin(this.ctx)}/api/revalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': env.REVALIDATE_SECRET,
        },
        body: JSON.stringify({ tags: target.tags ?? [], paths: target.paths ?? [] }),
        // A slow public site must not hold up a publish.
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        logger.warn({ status: response.status, target }, 'revalidation was refused');
      }
    } catch (error) {
      // The content is published either way; it simply appears when the
      // revalidation window elapses instead of immediately.
      logger.warn({ err: error, target }, 'revalidation could not be reached');
    }
  }
}

/**
 * Where this process can reach the public site.
 *
 * Not the same question as where a *browser* reaches it. Under `SERVE_ALL` the
 * site is a child process on loopback and the deployment's public domain is
 * assigned by the platform, so `CORPORATE_WEB_URL` is neither set nor useful:
 * sending the revalidation to it means sending it nowhere, and a publish then
 * takes the full revalidation window to appear. Loopback is also one hop rather
 * than a round trip out through the public edge and back.
 */
function publicSiteOrigin(ctx: AppContext): string {
  const { env } = ctx;
  return env.SERVE_ALL ? `http://127.0.0.1:${env.WEB_INTERNAL_PORT}` : env.CORPORATE_WEB_URL;
}
