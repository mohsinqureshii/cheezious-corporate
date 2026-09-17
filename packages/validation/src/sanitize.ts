/**
 * HTML sanitisation for editor-supplied rich text.
 *
 * An allow-list is used rather than a block-list: anything not explicitly
 * permitted is removed. This runs server-side before persistence, so stored
 * content is already safe and the renderer never has to trust the database.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'cite',
  'q',
  'a',
  'hr',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'figure',
  'figcaption',
  'span',
  'abbr',
  'time',
  'small',
  'code',
  'pre',
]);

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel', 'data-page-id']),
  th: new Set(['scope', 'colspan', 'rowspan']),
  td: new Set(['colspan', 'rowspan']),
  abbr: new Set(['title']),
  time: new Set(['datetime']),
  span: new Set(['lang', 'dir']),
  ol: new Set(['start']),
};

const GLOBAL_ATTRIBUTES = new Set(['id', 'lang', 'dir']);

const DANGEROUS_URL = /^\s*(javascript|data|vbscript|file):/i;

/** Strip every element that is not on the allow-list, along with its attributes. */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  let html = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /<(script|style|iframe|object|embed|form|input|button|link|meta|base)\b[\s\S]*?<\/\1>/gi,
      '',
    )
    .replace(
      /<(script|style|iframe|object|embed|form|input|button|link|meta|base)\b[^>]*\/?>/gi,
      '',
    );

  html = html.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*)?)\s*(\/?)>/g,
    (match, closing, rawName, rawAttrs, selfClose) => {
      const name = String(rawName).toLowerCase();
      if (!ALLOWED_TAGS.has(name)) return '';
      if (closing) return `</${name}>`;

      const attrs = sanitizeAttributes(name, String(rawAttrs ?? ''));
      return `<${name}${attrs}${selfClose ? ' /' : ''}>`;
    },
  );

  // Remove any residual stray angle brackets from malformed input.
  return html.replace(/<(?![/a-zA-Z])/g, '&lt;');
}

function sanitizeAttributes(tag: string, rawAttrs: string): string {
  const allowed = ALLOWED_ATTRIBUTES[tag];
  const out: string[] = [];
  const pattern = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(rawAttrs)) !== null) {
    const name = (match[1] ?? '').toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? '';

    // Event handlers and style are never permitted.
    if (name.startsWith('on') || name === 'style') continue;
    if (!allowed?.has(name) && !GLOBAL_ATTRIBUTES.has(name)) continue;

    if ((name === 'href' || name === 'src') && DANGEROUS_URL.test(value)) continue;

    out.push(`${name}="${escapeAttribute(value)}"`);
  }

  // Any link opening in a new tab gets rel="noopener noreferrer" added, so an
  // editor cannot accidentally expose the site to reverse tabnabbing.
  if (tag === 'a') {
    const hasTargetBlank = out.some((a) => a.startsWith('target=') && a.includes('_blank'));
    if (hasTargetBlank) {
      const relIndex = out.findIndex((a) => a.startsWith('rel='));
      if (relIndex >= 0) out.splice(relIndex, 1);
      out.push('rel="noopener noreferrer"');
    }
  }

  return out.length > 0 ? ` ${out.join(' ')}` : '';
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape text for safe interpolation into HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Reject a URL that could execute script when rendered as a link or image. */
export function isSafeUrl(value: string): boolean {
  return !DANGEROUS_URL.test(value);
}
