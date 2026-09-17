'use client';

import { getBlockSpec } from '@cheezious/page-builder';

/**
 * The block list.
 *
 * Reordering is done with buttons and keyboard shortcuts rather than drag and
 * drop alone. Drag-and-drop is fine for a mouse and unusable with a keyboard or
 * a screen reader, and a corporate CMS has to be operable by everyone in the
 * team — so the buttons are the primary mechanism, not a fallback.
 */

export interface EditorBlockSummary {
  key: string;
  blockKey: string;
  data: Record<string, unknown>;
  isHidden: boolean;
  anchor: string | null;
}

export interface BlockListProps {
  blocks: EditorBlockSummary[];
  selectedKey: string | null;
  canEdit: boolean;
  onSelect: (key: string) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  onDuplicate: (key: string) => void;
  onRemove: (key: string) => void;
  onToggleVisibility: (key: string) => void;
  onAdd: () => void;
}

export function BlockList({
  blocks,
  selectedKey,
  canEdit,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onToggleVisibility,
  onAdd,
}: BlockListProps) {
  if (blocks.length === 0) {
    return (
      <div className="border border-dashed border-border-subtle bg-surface-base px-06 py-10 text-center">
        <h2 className="text-heading-02 text-content-primary">This page has no content yet</h2>
        <p className="mt-02 text-body-01 text-content-secondary">
          Pages are built from blocks — a hero, editorial sections, statistics, a call to action.
        </p>
        {canEdit ? (
          <button type="button" onClick={onAdd} className="btn-primary mt-05">
            Add the first block
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <ol className="space-y-03">
        {blocks.map((block, index) => {
          const spec = getBlockSpec(block.blockKey);
          const isSelected = block.key === selectedKey;
          const isHero = spec?.category === 'hero';

          return (
            <li key={block.key}>
              <div
                className={[
                  'border bg-surface-base transition-colors duration-fast',
                  isSelected ? 'border-interactive' : 'border-border-subtle hover:border-border-strong',
                  block.isHidden ? 'opacity-60' : '',
                ].join(' ')}
              >
                <div className="flex items-start gap-03 p-04">
                  <span className="mt-01 w-6 shrink-0 text-end font-mono text-helper-01 text-content-tertiary tabular">
                    {index + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => onSelect(block.key)}
                    className="min-w-0 flex-1 text-left"
                    aria-current={isSelected ? 'true' : undefined}
                  >
                    <span className="flex flex-wrap items-center gap-02">
                      <span className="text-body-compact font-medium text-content-primary">
                        {spec?.name ?? block.blockKey}
                      </span>
                      {isHero ? (
                        <span className="tag bg-gray-20 text-content-secondary">Always first</span>
                      ) : null}
                      {block.isHidden ? (
                        <span className="tag bg-gray-20 text-content-secondary">Hidden</span>
                      ) : null}
                      {block.anchor ? (
                        <span className="tag bg-status-infoSubtle text-status-info">#{block.anchor}</span>
                      ) : null}
                    </span>

                    {/* A one-line preview of the block's own content, so a long
                        page is scannable without opening every block. */}
                    <span className="mt-01 block truncate text-helper-01 text-content-secondary">
                      {previewOf(block.data) || spec?.description || 'No content yet'}
                    </span>
                  </button>

                  {canEdit ? (
                    <div className="flex shrink-0 items-center gap-01">
                      <IconButton
                        label={`Move ${spec?.name ?? 'block'} up`}
                        disabled={index === 0 || isHero || blocks[index - 1] ? getBlockSpec(blocks[index - 1]!.blockKey)?.category === 'hero' : false}
                        onClick={() => onMove(block.key, -1)}
                      >
                        <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.4" fill="none" />
                      </IconButton>

                      <IconButton
                        label={`Move ${spec?.name ?? 'block'} down`}
                        disabled={index === blocks.length - 1 || isHero}
                        onClick={() => onMove(block.key, 1)}
                      >
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" />
                      </IconButton>

                      <IconButton
                        label={block.isHidden ? `Show ${spec?.name ?? 'block'}` : `Hide ${spec?.name ?? 'block'}`}
                        onClick={() => onToggleVisibility(block.key)}
                      >
                        {block.isHidden ? (
                          <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4zM3 3l10 10" stroke="currentColor" strokeWidth="1.2" fill="none" />
                        ) : (
                          <>
                            <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2" fill="none" />
                            <circle cx="8" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                          </>
                        )}
                      </IconButton>

                      {!spec?.singleton ? (
                        <IconButton label={`Duplicate ${spec?.name ?? 'block'}`} onClick={() => onDuplicate(block.key)}>
                          <path d="M5 5h7v7H5zM3 3h7v1H4v6H3z" stroke="currentColor" strokeWidth="1.1" fill="none" />
                        </IconButton>
                      ) : null}

                      <IconButton
                        label={`Remove ${spec?.name ?? 'block'}`}
                        danger
                        onClick={() => {
                          // A block can hold a lot of work; removing it is
                          // confirmed rather than instant.
                          if (window.confirm(`Remove the ${spec?.name ?? 'block'} block? This cannot be undone once you save.`)) {
                            onRemove(block.key);
                          }
                        }}
                      >
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" fill="none" />
                      </IconButton>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {canEdit ? (
        <button
          type="button"
          onClick={onAdd}
          className="mt-04 flex w-full items-center justify-center gap-02 border border-dashed
                     border-border-strong bg-surface-base px-05 py-04 text-body-compact
                     text-interactive transition-colors duration-fast hover:bg-interactive-subtle"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Add a block
        </button>
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={[
        'inline-flex h-7 w-7 items-center justify-center transition-colors duration-fast',
        'disabled:cursor-not-allowed disabled:opacity-30',
        danger
          ? 'text-content-secondary hover:bg-status-dangerSubtle hover:text-status-danger'
          : 'text-content-secondary hover:bg-surface-hover hover:text-content-primary',
      ].join(' ')}
    >
      <span className="sr-only">{label}</span>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

/**
 * A short preview of a block's content.
 *
 * Reads whichever of the common text fields the block happens to use, so the
 * list shows what the block actually says rather than only its type.
 */
function previewOf(data: Record<string, unknown>): string {
  const candidates = ['headline', 'heading', 'statement', 'title', 'standfirst', 'intro', 'body'];

  for (const key of candidates) {
    const value = data[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    }
  }

  // Collection blocks carry counts rather than prose.
  const quote = data.quote as { text?: string } | undefined;
  if (quote?.text) return quote.text.slice(0, 120);

  for (const key of ['statistics', 'pillars', 'steps', 'items', 'entries']) {
    const value = data[key];
    if (Array.isArray(value) && value.length > 0) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }

  return '';
}
