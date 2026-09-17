'use client';

import { useRef, useState } from 'react';

/**
 * Rich text.
 *
 * A structured HTML editor rather than a WYSIWYG canvas. The toolbar wraps the
 * selection in the handful of tags the design system can render — headings,
 * emphasis, lists, quotes, links — and the preview shows what the site will
 * make of it.
 *
 * The deliberate choice is that the markup stays visible. A WYSIWYG that hides
 * its output is how pasted Word markup and stray inline styles get into a
 * corporate site and stay there for years. The server sanitises against an
 * allow-list regardless, so what is saved is always a subset of what is typed.
 */

interface ToolbarAction {
  label: string;
  title: string;
  wrap: [string, string];
  /** Placed on its own line rather than around the selection. */
  block?: boolean;
}

const ACTIONS: ToolbarAction[] = [
  { label: 'H2', title: 'Section heading', wrap: ['<h2>', '</h2>'], block: true },
  { label: 'H3', title: 'Sub-heading', wrap: ['<h3>', '</h3>'], block: true },
  { label: '¶', title: 'Paragraph', wrap: ['<p>', '</p>'], block: true },
  { label: 'B', title: 'Bold', wrap: ['<strong>', '</strong>'] },
  { label: 'I', title: 'Italic', wrap: ['<em>', '</em>'] },
  { label: 'Link', title: 'Link', wrap: ['<a href="https://">', '</a>'] },
  { label: 'List', title: 'Bulleted list', wrap: ['<ul>\n  <li>', '</li>\n</ul>'], block: true },
  { label: 'Quote', title: 'Quotation', wrap: ['<blockquote>', '</blockquote>'], block: true },
];

export interface RichTextFieldProps {
  id: string;
  label: string;
  value: string;
  help?: string;
  disabled?: boolean;
  rows?: number;
  onChange: (value: string) => void;
}

export function RichTextField({ id, label, value, help, disabled, rows = 12, onChange }: RichTextFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function apply(action: ToolbarAction) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const [open, close] = action.wrap;

    const insertion = action.block && start > 0 && value[start - 1] !== '\n'
      ? `\n${open}${selected}${close}`
      : `${open}${selected}${close}`;

    const next = value.slice(0, start) + insertion + value.slice(end);
    onChange(next);

    // Put the caret inside the new tags so typing continues where expected.
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + insertion.length - close.length;
      textarea.setSelectionRange(selected ? caret : start + insertion.indexOf(selected || close), caret);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setPreview((current) => !current)}
          className="btn-ghost btn-sm"
          aria-pressed={preview}
        >
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {preview ? (
        <div
          className="prose-cms min-h-40 border border-border-subtle bg-surface-base px-04 py-03"
          // The server sanitises on save; this renders the editor's own draft
          // back to them and is never another user's content.
          dangerouslySetInnerHTML={{ __html: value }}
        />
      ) : (
        <>
          {!disabled ? (
            <div className="flex flex-wrap gap-01 border border-b-0 border-border-subtle bg-surface-subtle px-02 py-01">
              {ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  title={action.title}
                  onClick={() => apply(action)}
                  className="px-02 py-01 text-helper-01 text-content-secondary transition-colors
                             duration-fast hover:bg-surface-hover hover:text-content-primary"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}

          <textarea
            ref={textareaRef}
            id={id}
            value={value}
            rows={rows}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="textarea font-mono text-helper-01"
            spellCheck
          />
        </>
      )}

      <p className="field-helper">
        {help ? `${help} ` : ''}
        Headings, emphasis, lists, quotations and links are kept. Scripts, inline styles and event
        handlers are removed when saved.
      </p>
    </div>
  );
}
