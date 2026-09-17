import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * On-publish revalidation.
 *
 * The public site is statically generated with a revalidation window, which is
 * what makes a hundred-page corporate site fast. The cost is that a publish
 * would otherwise take up to that window to appear — five minutes during which
 * the person who published it is refreshing and wondering.
 *
 * The API calls this the moment content is published, unpublished, renamed or
 * deleted, naming the cache tags that content is held under. Everything the site
 * fetches is tagged, so a publish invalidates exactly the pages that changed
 * rather than the whole site.
 *
 * Authentication is a shared secret compared in constant time. It is a private
 * endpoint between two of our own services, and a timing-variable comparison on
 * a secret is a bad habit whatever the surface.
 */

export const dynamic = 'force-dynamic';

const MAX_ENTRIES = 100;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET;

  // Without a configured secret the endpoint refuses rather than defaulting to
  // open: a revalidation endpoint anybody can call is a free way to make a
  // cached site re-render everything on demand.
  if (!secret) {
    return NextResponse.json({ error: 'Revalidation is not configured.' }, { status: 503 });
  }

  const provided = request.headers.get('x-revalidate-secret') ?? '';
  if (!timingSafeEqual(provided, secret)) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  let body: { tags?: unknown; paths?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const tags = stringList(body.tags);
  const paths = stringList(body.paths);

  for (const tag of tags) revalidateTag(tag);
  for (const path of paths) revalidatePath(path);

  return NextResponse.json({ revalidated: { tags: tags.length, paths: paths.length } });
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is string =>
        typeof entry === 'string' && entry.length > 0 && entry.length < 512,
    )
    .slice(0, MAX_ENTRIES);
}

/**
 * Constant-time string comparison.
 *
 * `node:crypto` is not available in every runtime this route may be deployed to,
 * so this compares character by character without short-circuiting. Lengths are
 * compared first, which leaks only the length.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}
