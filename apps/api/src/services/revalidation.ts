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
      paths,
    };
  }

  /** A collection record: its own listing, and the sitemap. */
  collection(name: string, paths: string[] = []): RevalidationTarget {
    return { tags: [CACHE_TAGS.collection(name), CACHE_TAGS.sitemap], paths };
  }

  /** Site-wide furniture. */
  structure(): RevalidationTarget {
    return { tags: [CACHE_TAGS.navigation, CACHE_TAGS.footer, CACHE_TAGS.settings] };
  }

  async revalidate(target: RevalidationTarget): Promise<void> {
    const { env, logger } = this.ctx;
    if (!env.REVALIDATE_SECRET) return;

    try {
      const response = await fetch(`${env.CORPORATE_WEB_URL}/api/revalidate`, {
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
