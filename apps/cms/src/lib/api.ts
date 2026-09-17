import type { Permission } from '@cheezious/permissions';

/**
 * CMS API client.
 *
 * The CMS runs on the same session cookie the API issues, so every request
 * carries credentials and nothing is cached: an editor must always see current
 * state, and a stale permission check would be a security problem rather than
 * an inconvenience.
 */

const API_URL = process.env.NEXT_PUBLIC_CMS_API_URL ?? 'http://localhost:4000';

export class CmsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'CmsApiError';
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** Field errors keyed by field name, for rendering inline form messages. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.fields ?? []).map((error) => [error.field, error.message]));
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  searchParams?: Record<string, string | number | boolean | undefined | null>;
  /** Forwarded on the server so a server component can act as the signed-in user. */
  cookie?: string;
  signal?: AbortSignal;
}

export async function cmsFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, API_URL);
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    // Sends the session cookie from the browser.
    credentials: 'include',
    // Never cached: the CMS must always reflect current state and current
    // permissions.
    cache: 'no-store',
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) {
    let code = 'INTERNAL_ERROR';
    let message = `Request failed (${response.status})`;
    let fields: Array<{ field: string; message: string }> | undefined;

    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string; fields?: Array<{ field: string; message: string }> };
      };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
      fields = body.error?.fields;
    } catch {
      // A non-JSON error body adds nothing beyond the status.
    }

    throw new CmsApiError(response.status, code, message, fields);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface Principal {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  isActive: boolean;
  roles: string[];
  permissions: Permission[];
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface SessionResponse {
  user: Principal;
  unreadNotifications: number;
}

/** Resolve the signed-in user, or null when the session is absent or expired. */
export async function getSession(cookie?: string): Promise<SessionResponse | null> {
  try {
    return await cmsFetch<SessionResponse>('/api/auth/me', { cookie });
  } catch (error) {
    if (error instanceof CmsApiError && error.isUnauthenticated) return null;
    throw error;
  }
}

export { API_URL };
