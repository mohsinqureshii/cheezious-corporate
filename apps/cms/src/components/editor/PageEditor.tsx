'use client';

import { BLOCK_SPECS, defaultBlockData, type BlockDefinitionSpec } from '@cheezious/page-builder';
import { STATUS_META, type ContentStatus } from '@cheezious/permissions';
import { formatDateTime } from '@cheezious/utilities';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CmsApiError, cmsFetch } from '@/lib/api';

import { BlockInspector } from './BlockInspector';
import { BlockList } from './BlockList';
import { SeoPanel } from './SeoPanel';

/**
 * The page editor.
 *
 * Three commitments shape this screen:
 *
 *   1. **Nobody loses work.** Autosave runs on a debounce, save state is always
 *      visible, and navigating away with unsaved changes is intercepted. The
 *      save status is never ambiguous — "Saving…", "Saved", "Unsaved changes"
 *      and "Could not save" are four distinct, honest states.
 *   2. **The workflow is obvious.** The status and the transitions this person
 *      can actually perform sit in the top bar, not behind a menu.
 *   3. **Progressive disclosure.** Blocks are the primary work; SEO, publishing
 *      and metadata live in an inspector that does not compete with them.
 */

export interface EditorPage {
  id: string;
  title: string;
  path: string;
  slug: string;
  navLabel: string | null;
  summary: string | null;
  type: string;
  locale: string;
  status: ContentStatus;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  scheduledFor: string | null;
  reviewDate: string | null;
  updatedAt: string;
  blocks: Array<{
    id: string;
    blockKey: string;
    data: Record<string, unknown>;
    sortOrder: number;
    isHidden: boolean;
    anchor: string | null;
  }>;
  seo: Record<string, unknown> | null;
  updatedBy: { id: string; name: string } | null;
}

export interface AvailableTransition {
  action: string;
  label: string;
  description: string;
  confirm?: boolean;
}

export interface PageEditorProps {
  page: EditorPage;
  transitions: AvailableTransition[];
  versions: Array<{
    id: string;
    versionNumber: number;
    createdAt: string;
    note: string | null;
    createdBy: { name: string } | null;
  }>;
  canUpdate: boolean;
  siteUrl: string;
}

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface EditorBlock {
  key: string;
  blockKey: string;
  data: Record<string, unknown>;
  isHidden: boolean;
  anchor: string | null;
}

export function PageEditor({ page, transitions, versions, canUpdate, siteUrl }: PageEditorProps) {
  const router = useRouter();

  const [title, setTitle] = useState(page.title);
  const [summary, setSummary] = useState(page.summary ?? '');
  const [navLabel, setNavLabel] = useState(page.navLabel ?? '');
  const [seo, setSeo] = useState<Record<string, unknown>>(page.seo ?? {});
  const [blocks, setBlocks] = useState<EditorBlock[]>(() =>
    page.blocks.map((block) => ({
      key: block.id,
      blockKey: block.blockKey,
      data: block.data,
      isHidden: block.isHidden,
      anchor: block.anchor,
    })),
  );

  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'block' | 'settings' | 'seo' | 'history'>(
    'settings',
  );
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);
  const [status, setStatus] = useState<ContentStatus>(page.status);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the current in-memory state has been persisted, without
  // triggering a re-render on every keystroke.
  const dirtyRef = useRef(false);

  const markDirty = useCallback(() => {
    if (!canUpdate) return;
    dirtyRef.current = true;
    setSaveState('dirty');
  }, [canUpdate]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!canUpdate || !dirtyRef.current) return true;

    setSaveState('saving');
    setSaveError(null);
    setFieldErrors({});

    try {
      await cmsFetch(`/api/cms/pages/${page.id}`, {
        method: 'PATCH',
        body: {
          title,
          summary: summary || null,
          navLabel: navLabel || null,
          seo,
          blocks: blocks.map((block) => ({
            blockKey: block.blockKey,
            data: block.data,
            isHidden: block.isHidden,
            anchor: block.anchor ?? undefined,
          })),
        },
      });

      dirtyRef.current = false;
      setSaveState('saved');
      return true;
    } catch (error) {
      setSaveState('error');
      if (error instanceof CmsApiError) {
        setSaveError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setSaveError('We could not reach the server. Your changes are still here — try again.');
      }
      return false;
    }
  }, [blocks, canUpdate, navLabel, page.id, seo, summary, title]);

  /**
   * Autosave.
   *
   * Two seconds after the last change. Long enough not to fire mid-sentence,
   * short enough that a closed laptop rarely costs more than a sentence.
   */
  useEffect(() => {
    if (saveState !== 'dirty') return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), 2000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [saveState, save]);

  /**
   * Intercept navigation with unsaved changes.
   *
   * The browser's own dialog is the only thing that reliably fires on a closed
   * tab, so it is used rather than a prettier in-app modal that would not.
   */
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Cmd/Ctrl+S saves immediately, which is what everyone's fingers expect.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [save]);

  // --- Block operations -----------------------------------------------------

  const addBlock = useCallback(
    (spec: BlockDefinitionSpec, index?: number) => {
      const block: EditorBlock = {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        blockKey: spec.key,
        data: defaultBlockData(spec.key),
        isHidden: false,
        anchor: null,
      };

      setBlocks((current) => {
        const next = [...current];
        // A hero always goes first: the composition validator would reject it
        // anywhere else, so the editor never lets it be placed there.
        const position = spec.category === 'hero' ? 0 : (index ?? next.length);
        next.splice(position, 0, block);
        return next;
      });

      setSelectedBlock(block.key);
      setInspectorTab('block');
      setBlockPickerOpen(false);
      markDirty();
    },
    [markDirty],
  );

  const updateBlock = useCallback(
    (key: string, data: Record<string, unknown>) => {
      setBlocks((current) =>
        current.map((block) => (block.key === key ? { ...block, data } : block)),
      );
      markDirty();
    },
    [markDirty],
  );

  const removeBlock = useCallback(
    (key: string) => {
      setBlocks((current) => current.filter((block) => block.key !== key));
      setSelectedBlock((current) => (current === key ? null : current));
      markDirty();
    },
    [markDirty],
  );

  const duplicateBlock = useCallback(
    (key: string) => {
      setBlocks((current) => {
        const index = current.findIndex((block) => block.key === key);
        if (index === -1) return current;

        const source = current[index]!;
        const spec = BLOCK_SPECS.find((candidate) => candidate.key === source.blockKey);
        // Duplicating a singleton would produce a composition the server
        // rejects, so it is not offered.
        if (spec?.singleton) return current;

        const copy: EditorBlock = {
          ...source,
          key: `copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          // Anchors must stay unique, so the copy starts without one.
          anchor: null,
          data: structuredClone(source.data),
        };

        const next = [...current];
        next.splice(index + 1, 0, copy);
        return next;
      });
      markDirty();
    },
    [markDirty],
  );

  const moveBlock = useCallback(
    (key: string, direction: -1 | 1) => {
      setBlocks((current) => {
        const index = current.findIndex((block) => block.key === key);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= current.length) return current;

        const spec = BLOCK_SPECS.find((candidate) => candidate.key === current[index]!.blockKey);
        // A hero cannot be moved out of first position.
        if (spec?.category === 'hero') return current;

        const targetSpec = BLOCK_SPECS.find(
          (candidate) => candidate.key === current[target]!.blockKey,
        );
        if (targetSpec?.category === 'hero') return current;

        const next = [...current];
        [next[index], next[target]] = [next[target]!, next[index]!];
        return next;
      });
      markDirty();
    },
    [markDirty],
  );

  const toggleBlockVisibility = useCallback(
    (key: string) => {
      setBlocks((current) =>
        current.map((block) =>
          block.key === key ? { ...block, isHidden: !block.isHidden } : block,
        ),
      );
      markDirty();
    },
    [markDirty],
  );

  // --- Workflow -------------------------------------------------------------

  async function runTransition(
    action: string,
    extra: { scheduledFor?: string; note?: string } = {},
  ) {
    // Unsaved work is persisted before a transition, so publishing never ships
    // a stale version of what is on screen.
    const saved = await save();
    if (!saved) return;

    try {
      const result = await cmsFetch<{ status: ContentStatus }>(
        `/api/cms/pages/${page.id}/transition`,
        {
          method: 'POST',
          body: { action, ...extra },
        },
      );
      setStatus(result.status);
      router.refresh();
    } catch (error) {
      setSaveState('error');
      setSaveError(
        error instanceof CmsApiError ? error.message : 'That action could not be completed.',
      );
    }
  }

  async function openPreview() {
    await save();
    try {
      const { url } = await cmsFetch<{ url: string }>(`/api/cms/pages/${page.id}/preview`, {
        method: 'POST',
      });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setSaveError('The preview link could not be created.');
    }
  }

  const selected = useMemo(
    () => blocks.find((block) => block.key === selectedBlock) ?? null,
    [blocks, selectedBlock],
  );

  return (
    <div className="flex h-[calc(100vh-theme(spacing.header))] flex-col">
      {/* --- Top bar ---------------------------------------------------- */}
      <div className="flex shrink-0 flex-wrap items-center gap-04 border-b border-border-subtle bg-surface-base px-05 py-03">
        <Link
          href="/content/pages"
          className="flex items-center gap-02 text-body-compact text-interactive no-underline hover:underline"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Pages
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate text-heading-compact text-content-primary" title={title}>
            {title || 'Untitled page'}
          </p>
          <p className="truncate font-mono text-helper-01 text-content-tertiary">{page.path}</p>
        </div>

        <SaveIndicator state={saveState} error={saveError} updatedAt={page.updatedAt} />

        <StatusBadge status={status} hasUnpublishedChanges={page.hasUnpublishedChanges} />

        <div className="flex items-center gap-02">
          {canUpdate ? (
            <button
              type="button"
              onClick={() => void save()}
              className="btn-tertiary btn-sm"
              disabled={saveState === 'saving'}
            >
              Save
            </button>
          ) : null}

          <button type="button" onClick={() => void openPreview()} className="btn-tertiary btn-sm">
            Preview
          </button>

          {status === 'PUBLISHED' ? (
            <a
              href={`${siteUrl}/${page.locale}${page.path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost btn-sm no-underline"
            >
              View live
            </a>
          ) : null}

          <TransitionMenu transitions={transitions} onRun={runTransition} />
        </div>
      </div>

      {saveError ? (
        <div
          className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-03"
          role="alert"
        >
          <p className="text-body-compact text-content-primary">{saveError}</p>
          {Object.entries(fieldErrors).length > 0 ? (
            <ul className="mt-01 space-y-01">
              {Object.entries(fieldErrors).map(([field, message]) => (
                <li key={field} className="text-helper-01 text-content-secondary">
                  {message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!canUpdate ? (
        <div className="border-s-[3px] border-status-info bg-status-infoSubtle px-05 py-03">
          <p className="text-body-compact text-content-primary">
            You have read-only access to this page.
          </p>
        </div>
      ) : null}

      {/* --- Workspace -------------------------------------------------- */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-editor">
        <div className="scrollbar-thin min-h-0 overflow-y-auto bg-surface-subtle p-06">
          <div className="mx-auto max-w-3xl space-y-05">
            <div className="panel p-05">
              <label htmlFor="page-title" className="field-label">
                Page title
              </label>
              <input
                id="page-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  markDirty();
                }}
                disabled={!canUpdate}
                className="input text-heading-03"
              />
              <p className="field-helper">
                Used in the browser tab, search results and navigation.
              </p>
            </div>

            <BlockList
              blocks={blocks}
              selectedKey={selectedBlock}
              canEdit={canUpdate}
              onSelect={(key) => {
                setSelectedBlock(key);
                setInspectorTab('block');
              }}
              onMove={moveBlock}
              onDuplicate={duplicateBlock}
              onRemove={removeBlock}
              onToggleVisibility={toggleBlockVisibility}
              onAdd={() => setBlockPickerOpen(true)}
            />
          </div>
        </div>

        {/* --- Inspector --------------------------------------------------- */}
        <aside className="scrollbar-thin hidden min-h-0 overflow-y-auto border-s border-border-subtle bg-surface-base lg:block">
          <div className="sticky top-0 z-sticky flex border-b border-border-subtle bg-surface-base">
            {(['settings', 'block', 'seo', 'history'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setInspectorTab(tab)}
                className={[
                  'flex-1 border-b-2 px-03 py-03 text-body-compact capitalize transition-colors duration-fast',
                  inspectorTab === tab
                    ? 'border-interactive font-semibold text-content-primary'
                    : 'border-transparent text-content-secondary hover:bg-surface-hover',
                ].join(' ')}
                aria-current={inspectorTab === tab ? 'true' : undefined}
              >
                {tab === 'seo' ? 'SEO' : tab}
              </button>
            ))}
          </div>

          <div className="p-05">
            {inspectorTab === 'settings' ? (
              <SettingsPanel
                page={page}
                status={status}
                summary={summary}
                navLabel={navLabel}
                canEdit={canUpdate}
                onSummaryChange={(value) => {
                  setSummary(value);
                  markDirty();
                }}
                onNavLabelChange={(value) => {
                  setNavLabel(value);
                  markDirty();
                }}
              />
            ) : null}

            {inspectorTab === 'block' ? (
              selected ? (
                <BlockInspector
                  blockKey={selected.blockKey}
                  data={selected.data}
                  canEdit={canUpdate}
                  onChange={(data) => updateBlock(selected.key, data)}
                />
              ) : (
                <p className="text-body-01 text-content-secondary">
                  Select a block to edit its content and settings.
                </p>
              )
            ) : null}

            {inspectorTab === 'seo' ? (
              <SeoPanel
                seo={seo}
                pageTitle={title}
                pageSummary={summary}
                path={`/${page.locale}${page.path}`}
                siteUrl={siteUrl}
                canEdit={canUpdate}
                onChange={(next) => {
                  setSeo(next);
                  markDirty();
                }}
              />
            ) : null}

            {inspectorTab === 'history' ? (
              <HistoryPanel versions={versions} pageId={page.id} />
            ) : null}
          </div>
        </aside>
      </div>

      {blockPickerOpen ? (
        <BlockPicker
          existingBlockKeys={blocks.map((block) => block.blockKey)}
          onPick={(spec) => addBlock(spec)}
          onClose={() => setBlockPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * Save state.
 *
 * Four distinct, honest states. An editor must never have to guess whether
 * their work is safe.
 */
function SaveIndicator({
  state,
  error,
  updatedAt,
}: {
  state: SaveState;
  error: string | null;
  updatedAt: string;
}) {
  const content: Record<SaveState, { label: string; className: string }> = {
    idle: { label: `Saved ${formatDateTime(updatedAt)}`, className: 'text-content-tertiary' },
    dirty: { label: 'Unsaved changes', className: 'text-status-warning' },
    saving: { label: 'Saving…', className: 'text-content-secondary' },
    saved: { label: 'Saved', className: 'text-status-success' },
    error: { label: error ? 'Could not save' : 'Save failed', className: 'text-status-danger' },
  };

  const { label, className } = content[state];

  return (
    <p
      className={['hidden text-helper-01 md:block', className].join(' ')}
      role="status"
      aria-live="polite"
    >
      {label}
    </p>
  );
}

function StatusBadge({
  status,
  hasUnpublishedChanges,
}: {
  status: ContentStatus;
  hasUnpublishedChanges: boolean;
}) {
  const meta = STATUS_META[status];
  return (
    <span className="flex items-center gap-02">
      <span className="tag bg-gray-20 text-content-primary">{meta?.label ?? status}</span>
      {hasUnpublishedChanges && status === 'PUBLISHED' ? (
        <span className="tag bg-status-warningSubtle text-gray-90">Changes not live</span>
      ) : null}
    </span>
  );
}

/** Workflow actions. Only transitions this user may perform are rendered. */
function TransitionMenu({
  transitions,
  onRun,
}: {
  transitions: AvailableTransition[];
  onRun: (action: string, extra?: { scheduledFor?: string; note?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState('');
  const [note, setNote] = useState('');

  if (transitions.length === 0) return null;

  const primary = transitions.find((t) => t.action === 'PUBLISH') ?? transitions[0]!;
  const rest = transitions.filter((t) => t.action !== primary.action);

  return (
    <div className="relative flex items-center gap-01">
      <button
        type="button"
        className="btn-primary btn-sm"
        onClick={() => {
          if (primary.action === 'SCHEDULE') setScheduling(true);
          else if (primary.action === 'REQUEST_CHANGES') setNoteFor(primary.action);
          else onRun(primary.action);
        }}
      >
        {primary.label}
      </button>

      {rest.length > 0 ? (
        <>
          <button
            type="button"
            className="btn-secondary btn-sm px-02"
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="More actions"
            onClick={() => setOpen((value) => !value)}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>

          {open ? (
            <ul
              role="menu"
              className="absolute end-0 top-full z-dropdown mt-01 w-64 border border-border-subtle bg-surface-base shadow-menu"
            >
              {rest.map((transition) => (
                <li key={transition.action} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      if (transition.action === 'SCHEDULE') setScheduling(true);
                      else if (transition.action === 'REQUEST_CHANGES')
                        setNoteFor(transition.action);
                      else onRun(transition.action);
                    }}
                    className="block w-full px-05 py-03 text-left hover:bg-surface-hover"
                  >
                    <span className="block text-body-compact text-content-primary">
                      {transition.label}
                    </span>
                    <span className="mt-01 block text-helper-01 text-content-secondary">
                      {transition.description}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {scheduling ? (
        <Dialog
          title="Schedule publication"
          onClose={() => setScheduling(false)}
          onConfirm={() => {
            onRun('SCHEDULE', { scheduledFor: new Date(scheduledFor).toISOString() });
            setScheduling(false);
          }}
          confirmLabel="Schedule"
          confirmDisabled={!scheduledFor}
        >
          <label htmlFor="schedule-at" className="field-label">
            Publish at
          </label>
          <input
            id="schedule-at"
            type="datetime-local"
            value={scheduledFor}
            onChange={(event) => setScheduledFor(event.target.value)}
            min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
            className="input"
          />
          <p className="field-helper">The page goes live automatically at this time.</p>
        </Dialog>
      ) : null}

      {noteFor ? (
        <Dialog
          title="Request changes"
          onClose={() => setNoteFor(null)}
          onConfirm={() => {
            onRun(noteFor, { note });
            setNoteFor(null);
            setNote('');
          }}
          confirmLabel="Send back"
          confirmDisabled={note.trim().length === 0}
        >
          <label htmlFor="change-note" className="field-label">
            What needs to change?
          </label>
          <textarea
            id="change-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            className="textarea"
          />
          <p className="field-helper">The author sees this, so be specific.</p>
        </Dialog>
      ) : null}
    </div>
  );
}

function Dialog({
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel,
  confirmDisabled,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-gray-100/50 p-05"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md border border-border-subtle bg-surface-base shadow-modal">
        <div className="px-06 py-05">
          <h2 className="mb-04 text-heading-03 text-content-primary">{title}</h2>
          {children}
        </div>
        <div className="flex justify-end gap-03 border-t border-border-subtle px-06 py-04">
          <button type="button" onClick={onClose} className="btn-tertiary">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="btn-primary"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({
  page,
  status,
  summary,
  navLabel,
  canEdit,
  onSummaryChange,
  onNavLabelChange,
}: {
  page: EditorPage;
  status: ContentStatus;
  summary: string;
  navLabel: string;
  canEdit: boolean;
  onSummaryChange: (value: string) => void;
  onNavLabelChange: (value: string) => void;
}) {
  return (
    <div className="space-y-05">
      <div>
        <label htmlFor="page-summary" className="field-label">
          Summary
        </label>
        <textarea
          id="page-summary"
          value={summary}
          onChange={(event) => onSummaryChange(event.target.value)}
          disabled={!canEdit}
          rows={3}
          className="textarea"
        />
        <p className="field-helper">Used in listings and as the default meta description.</p>
      </div>

      <div>
        <label htmlFor="page-nav-label" className="field-label">
          Navigation label
        </label>
        <input
          id="page-nav-label"
          value={navLabel}
          onChange={(event) => onNavLabelChange(event.target.value)}
          disabled={!canEdit}
          className="input"
          placeholder={page.title}
        />
        <p className="field-helper">
          A shorter label for menus and breadcrumbs. Defaults to the title.
        </p>
      </div>

      <dl className="space-y-03 border-t border-border-subtle pt-05 text-body-compact">
        <Row label="Path" value={<span className="font-mono">{page.path}</span>} />
        <Row label="Type" value={page.type.replace(/_/g, ' ').toLowerCase()} />
        <Row label="Language" value={page.locale === 'en' ? 'English' : 'Urdu'} />
        <Row label="Status" value={STATUS_META[status]?.label ?? status} />
        <Row
          label="Published"
          value={page.publishedAt ? formatDateTime(page.publishedAt) : 'Never'}
        />
        {page.scheduledFor ? (
          <Row label="Scheduled" value={formatDateTime(page.scheduledFor)} />
        ) : null}
        <Row
          label="Last edited"
          value={`${formatDateTime(page.updatedAt)}${page.updatedBy ? ` by ${page.updatedBy.name}` : ''}`}
        />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-04">
      <dt className="text-content-secondary">{label}</dt>
      <dd className="text-end text-content-primary">{value}</dd>
    </div>
  );
}

function HistoryPanel({
  versions,
  pageId,
}: {
  versions: PageEditorProps['versions'];
  pageId: string;
}) {
  if (versions.length === 0) {
    return (
      <p className="text-body-01 text-content-secondary">
        No versions yet. A version is saved each time this page is published.
      </p>
    );
  }

  return (
    <ol className="space-y-04">
      {versions.map((version) => (
        <li key={version.id} className="border-s-2 border-border-subtle ps-04">
          <p className="text-body-compact font-medium text-content-primary">
            Version {version.versionNumber}
          </p>
          <p className="text-helper-01 text-content-secondary">
            {formatDateTime(version.createdAt)}
            {version.createdBy ? ` · ${version.createdBy.name}` : ''}
          </p>
          {version.note ? (
            <p className="mt-01 text-helper-01 text-content-tertiary">{version.note}</p>
          ) : null}
          <Link
            href={`/content/pages/${pageId}/versions/${version.id}`}
            className="mt-02 inline-block text-helper-01 text-interactive no-underline hover:underline"
          >
            Compare and restore
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** Block picker, grouped by category so sixty blocks stay navigable. */
function BlockPicker({
  existingBlockKeys,
  onPick,
  onClose,
}: {
  existingBlockKeys: string[];
  onPick: (spec: BlockDefinitionSpec) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const available = BLOCK_SPECS.filter((spec) => {
    // A singleton already on the page is not offered again.
    if (spec.singleton && existingBlockKeys.includes(spec.key)) return false;
    if (!query) return true;
    const haystack = `${spec.name} ${spec.description} ${spec.category}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const grouped = available.reduce<Record<string, BlockDefinitionSpec[]>>((accumulator, spec) => {
    (accumulator[spec.category] ??= []).push(spec);
    return accumulator;
  }, {});

  return (
    <div
      className="fixed inset-0 z-modal flex items-start justify-center bg-gray-100/50 p-05 pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Add a block"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col border border-border-subtle bg-surface-base shadow-modal">
        <div className="border-b border-border-subtle px-06 py-04">
          <h2 className="text-heading-03 text-content-primary">Add a block</h2>
          <input
            // A dialog takes focus when it opens: WAI-ARIA asks for it, and without
            // it a keyboard user is left behind the overlay with nothing focused.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search blocks"
            aria-label="Search blocks"
            className="input mt-04"
          />
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-06">
          {Object.keys(grouped).length === 0 ? (
            <p className="text-body-01 text-content-secondary">No blocks match that search.</p>
          ) : (
            Object.entries(grouped).map(([category, specs]) => (
              <div key={category} className="mb-06 last:mb-0">
                <h3 className="mb-03 text-label-01 uppercase tracking-wide text-content-tertiary">
                  {category}
                </h3>
                <ul className="grid gap-03 sm:grid-cols-2">
                  {specs.map((spec) => (
                    <li key={spec.key}>
                      <button
                        type="button"
                        onClick={() => onPick(spec)}
                        className="w-full border border-border-subtle p-04 text-left transition-colors
                                   duration-fast hover:border-interactive hover:bg-interactive-subtle"
                      >
                        <span className="block text-body-compact font-medium text-content-primary">
                          {spec.name}
                        </span>
                        <span className="mt-01 block text-helper-01 text-content-secondary">
                          {spec.description}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end border-t border-border-subtle px-06 py-04">
          <button type="button" onClick={onClose} className="btn-tertiary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
