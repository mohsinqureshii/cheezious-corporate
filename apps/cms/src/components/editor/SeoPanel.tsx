'use client';

import { useMemo } from 'react';

/**
 * SEO inspector.
 *
 * Shows the editor exactly what a search result and a shared link will look
 * like, and warns while they type rather than after they publish. The character
 * counts and the truncation preview use the same limits the public site applies,
 * so what is shown here is what actually ships.
 */

const LIMITS = {
  titleIdeal: 60,
  titleMax: 70,
  descriptionMin: 70,
  descriptionIdeal: 160,
  descriptionMax: 200,
};

export interface SeoPanelProps {
  seo: Record<string, unknown>;
  pageTitle: string;
  pageSummary: string;
  path: string;
  siteUrl: string;
  canEdit: boolean;
  onChange: (seo: Record<string, unknown>) => void;
}

export function SeoPanel({
  seo,
  pageTitle,
  pageSummary,
  path,
  siteUrl,
  canEdit,
  onChange,
}: SeoPanelProps) {
  const title = (seo.title as string) ?? '';
  const description = (seo.description as string) ?? '';
  const canonicalUrl = (seo.canonicalUrl as string) ?? '';
  const noindex = seo.noindex === true;
  const nofollow = seo.nofollow === true;
  const ogTitle = (seo.ogTitle as string) ?? '';
  const ogDescription = (seo.ogDescription as string) ?? '';

  // What will actually be used, including the page's own fallbacks.
  const effectiveTitle = title || pageTitle || 'Untitled page';
  const effectiveDescription = description || pageSummary || '';

  const issues = useMemo(() => {
    const found: Array<{ field: string; severity: 'warning' | 'error'; message: string }> = [];

    if (effectiveTitle.length > LIMITS.titleMax) {
      found.push({
        field: 'title',
        severity: 'warning',
        message: `The title is ${effectiveTitle.length} characters. Search results usually cut off around ${LIMITS.titleIdeal}.`,
      });
    }
    if (effectiveTitle.length < 15) {
      found.push({
        field: 'title',
        severity: 'warning',
        message: 'The title is very short. Add more context.',
      });
    }

    if (!effectiveDescription) {
      found.push({
        field: 'description',
        severity: 'error',
        message: 'No description. Search engines will invent one from the page content.',
      });
    } else if (effectiveDescription.length < LIMITS.descriptionMin) {
      found.push({
        field: 'description',
        severity: 'warning',
        message: `The description is ${effectiveDescription.length} characters. Aim for ${LIMITS.descriptionMin}–${LIMITS.descriptionIdeal}.`,
      });
    } else if (effectiveDescription.length > LIMITS.descriptionIdeal) {
      found.push({
        field: 'description',
        severity: 'warning',
        message: `The description is ${effectiveDescription.length} characters and will be truncated. Aim for ${LIMITS.descriptionIdeal} or fewer.`,
      });
    }

    if (!seo.ogImageId) {
      found.push({
        field: 'ogImage',
        severity: 'warning',
        message: 'No social image. The site-wide default will be used.',
      });
    }

    if (noindex) {
      found.push({
        field: 'noindex',
        severity: 'error',
        message: 'This page is set to noindex and will be excluded from search engines.',
      });
    }

    return found;
  }, [effectiveDescription, effectiveTitle, noindex, seo.ogImageId]);

  function set(field: string, value: unknown) {
    onChange({ ...seo, [field]: value });
  }

  return (
    <div className="space-y-05">
      {/* --- Search result preview ------------------------------------- */}
      <div>
        <p className="field-label">Search result preview</p>
        <div className="border border-border-subtle bg-surface-base p-04">
          <p className="truncate text-helper-01 text-content-secondary">
            {siteUrl.replace(/^https?:\/\//, '')}
            {path}
          </p>
          <p className="mt-01 truncate text-body-02 text-interactive">
            {truncate(effectiveTitle, LIMITS.titleIdeal)}
          </p>
          <p className="mt-01 text-helper-01 text-content-secondary">
            {effectiveDescription
              ? truncate(effectiveDescription, LIMITS.descriptionIdeal)
              : 'No description — search engines will generate one from the page.'}
          </p>
        </div>
      </div>

      {issues.length > 0 ? (
        <ul className="space-y-02">
          {issues.map((issue) => (
            <li
              key={`${issue.field}-${issue.message}`}
              className={[
                'border-s-[3px] px-03 py-02 text-helper-01',
                issue.severity === 'error'
                  ? 'border-status-danger bg-status-dangerSubtle text-content-primary'
                  : 'border-status-warning bg-status-warningSubtle text-content-primary',
              ].join(' ')}
            >
              {issue.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-s-[3px] border-status-success bg-status-successSubtle px-03 py-02 text-helper-01">
          This page is ready for search engines.
        </p>
      )}

      {/* --- Fields ---------------------------------------------------- */}
      <div>
        <label htmlFor="seo-title" className="field-label">
          SEO title
        </label>
        <input
          id="seo-title"
          value={title}
          disabled={!canEdit}
          onChange={(event) => set('title', event.target.value)}
          placeholder={pageTitle}
          className="input"
        />
        <CharacterCount value={effectiveTitle} ideal={LIMITS.titleIdeal} max={LIMITS.titleMax} />
        <p className="field-helper">Defaults to the page title when left empty.</p>
      </div>

      <div>
        <label htmlFor="seo-description" className="field-label">
          Meta description
        </label>
        <textarea
          id="seo-description"
          value={description}
          disabled={!canEdit}
          rows={3}
          onChange={(event) => set('description', event.target.value)}
          placeholder={pageSummary || 'Describe this page in a sentence or two.'}
          className="textarea"
        />
        <CharacterCount
          value={effectiveDescription}
          ideal={LIMITS.descriptionIdeal}
          max={LIMITS.descriptionMax}
          min={LIMITS.descriptionMin}
        />
        <p className="field-helper">Defaults to the page summary when left empty.</p>
      </div>

      <details className="border-t border-border-subtle pt-04">
        <summary className="cursor-pointer text-body-compact text-content-primary">
          Social sharing
        </summary>
        <div className="mt-04 space-y-04">
          <div>
            <label htmlFor="seo-og-title" className="field-label">
              Social title
            </label>
            <input
              id="seo-og-title"
              value={ogTitle}
              disabled={!canEdit}
              onChange={(event) => set('ogTitle', event.target.value)}
              placeholder={effectiveTitle}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="seo-og-description" className="field-label">
              Social description
            </label>
            <textarea
              id="seo-og-description"
              value={ogDescription}
              disabled={!canEdit}
              rows={2}
              onChange={(event) => set('ogDescription', event.target.value)}
              placeholder={effectiveDescription}
              className="textarea"
            />
          </div>

          <p className="field-helper">
            The social image is chosen from the media library. Without one, the site-wide default is
            used.
          </p>
        </div>
      </details>

      <details className="border-t border-border-subtle pt-04">
        <summary className="cursor-pointer text-body-compact text-content-primary">
          Advanced
        </summary>
        <div className="mt-04 space-y-04">
          <div>
            <label htmlFor="seo-canonical" className="field-label">
              Canonical URL
            </label>
            <input
              id="seo-canonical"
              type="url"
              value={canonicalUrl}
              disabled={!canEdit}
              onChange={(event) => set('canonicalUrl', event.target.value)}
              placeholder={`${siteUrl}${path}`}
              className="input"
            />
            <p className="field-helper">
              Only set this when this page duplicates another. Getting it wrong removes the page
              from search.
            </p>
          </div>

          {/* noindex is destructive to visibility, so it is labelled as such
              rather than presented as a neutral toggle. */}
          <label className="flex items-start gap-03">
            <input
              type="checkbox"
              checked={noindex}
              disabled={!canEdit}
              onChange={(event) => set('noindex', event.target.checked)}
              className="checkbox mt-01"
            />
            <span>
              <span className="block text-body-compact text-content-primary">
                Hide from search engines
              </span>
              <span className="block text-helper-01 text-content-secondary">
                The page stays reachable by direct link but is excluded from search results and the
                sitemap.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-03">
            <input
              type="checkbox"
              checked={nofollow}
              disabled={!canEdit}
              onChange={(event) => set('nofollow', event.target.checked)}
              className="checkbox mt-01"
            />
            <span>
              <span className="block text-body-compact text-content-primary">
                Do not follow links
              </span>
              <span className="block text-helper-01 text-content-secondary">
                Rarely needed. Tells search engines not to follow links from this page.
              </span>
            </span>
          </label>
        </div>
      </details>
    </div>
  );
}

function CharacterCount({
  value,
  ideal,
  max,
  min,
}: {
  value: string;
  ideal: number;
  max: number;
  min?: number;
}) {
  const length = value.length;
  const tone =
    length > max
      ? 'text-status-danger'
      : length > ideal || (min !== undefined && length > 0 && length < min)
        ? 'text-status-warning'
        : 'text-content-tertiary';

  return (
    <p className={['mt-01 text-end text-helper-01 tabular', tone].join(' ')}>
      {length} / {ideal}
    </p>
  );
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}
