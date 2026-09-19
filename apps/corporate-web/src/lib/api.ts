import 'server-only';

/**
 * Server-side API client.
 *
 * All content fetching happens on the server. Two consequences that matter:
 * the browser never sees the API origin or holds credentials, and every response
 * participates in Next's caching so a page render does not re-fetch the same
 * navigation on every request.
 *
 * Cache tags mirror the API's invalidation tags, so publishing a page in the CMS
 * can revalidate exactly the routes that show it rather than the whole site.
 */

/**
 * Where this server reaches the API.
 *
 * `INTERNAL_API_URL` is set when the platform runs as one process: the API is
 * then on loopback, so a render talks to it directly instead of going back out
 * through the public edge and in again. Otherwise it is the public origin, as
 * it was when the API was a service of its own.
 */
const API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface FetchOptions {
  /** Seconds before Next revalidates. `false` opts out of caching entirely. */
  revalidate?: number | false;
  tags?: string[];
  /** Preview requests must never be cached or shared between visitors. */
  noStore?: boolean;
  searchParams?: Record<string, string | number | boolean | undefined | null>;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

function buildUrl(path: string, searchParams?: FetchOptions['searchParams']): string {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, API_URL);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = buildUrl(path, options.searchParams);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    ...(options.noStore
      ? { cache: 'no-store' as const }
      : {
          next: {
            revalidate: options.revalidate === false ? 0 : (options.revalidate ?? 120),
            tags: options.tags,
          },
        }),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      // A non-JSON error body is not worth failing over; the status is enough.
    }
    throw new ApiRequestError(response.status, path, message);
  }

  return (await response.json()) as T;
}

/**
 * Fetch that treats 404 as an expected absence rather than an error.
 *
 * Used where a missing record is a normal outcome — an optional footer
 * configuration, a locale variant that has not been translated yet.
 */
export async function apiFetchOptional<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T | null> {
  try {
    return await apiFetch<T>(path, options);
  } catch (error) {
    if (error instanceof ApiRequestError && error.isNotFound) return null;
    throw error;
  }
}

// URL helpers live in ./urls so client components can use them without pulling
// this server-only module into the browser bundle.
export { localePath, mediaUrl, stripLocale, switchLocalePath } from './urls';
