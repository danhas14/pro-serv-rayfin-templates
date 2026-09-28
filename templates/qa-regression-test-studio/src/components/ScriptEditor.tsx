/**
 * Hand-editing surface for the generated Playwright script.
 *
 * The steps editor stays the primary way to define a test; this is the escape
 * hatch for the cases a generated script cannot cover — a bespoke wait, an
 * unusual control, a workaround for a site that resists automation.
 *
 * Deliberately a plain textarea rather than a full code editor: it adds no
 * dependency to the bundle, and the realistic workflow is pasting or adjusting
 * a few lines rather than writing from scratch. Line numbers are provided
 * because runtime errors are easier to place with them, and wrapping is off so
 * Python indentation stays readable and the numbers stay aligned.
 */
import { useEffect, useRef, useState } from 'react';

import { hasBlockingIssue, validateScript } from '@/lib/scriptContract';
import { formatDateTime } from '@/lib/format';
import type { ScriptRow } from '@/services/testStore';

interface Props {
  script: ScriptRow | null;
  saving: boolean;
  onSave: (body: string) => Promise<void>;
}

const TAB = '    ';

export function ScriptEditor({ script, saving, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(script?.script_body ?? '');
  const [savedAt, setSavedAt] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Adopt the stored script whenever a different version arrives (initial load
  // or a regenerate), but never while the user has unsaved work in progress.
  const stored = script?.script_body ?? '';
  const dirty = body !== stored;
  const lastAdopted = useRef(stored);
  useEffect(() => {
    if (stored !== lastAdopted.current) {
      lastAdopted.current = stored;
      setBody(stored);
    }
  }, [stored]);

  const issues = dirty || body ? validateScript(body) : [];
  const blocked = hasBlockingIssue(issues);
  const lineCount = body.split('\n').length;

  async function save() {
    if (!dirty || blocked || saving) return;
    await onSave(body);
    setSavedAt(true);
    setTimeout(() => setSavedAt(false), 1500);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      void save();
      return;
    }

    // Without this, Tab moves focus out of the editor mid-edit.
    if (event.key === 'Tab') {
      event.preventDefault();
      const el = event.currentTarget;
      const { selectionStart, selectionEnd } = el;
      const next =
        body.slice(0, selectionStart) + TAB + body.slice(selectionEnd);
      setBody(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = selectionStart + TAB.length;
      });
    }
  }

  if (!script && !open) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Playwright script</h2>
        <p className="mt-1 text-xs text-gray-500">
          No script yet. Use “Generate script” above to create one from the
          steps, then edit it here if you need to.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Playwright script
          </h2>
          <p className="text-xs text-gray-500">
            {script?.status === 'edited'
              ? 'Edited by hand'
              : `Generated${
                  script?.generated_by_model
                    ? ` by ${script.generated_by_model}`
                    : ''
                }`}
            {script?.updated_at
              ? ` · updated ${formatDateTime(script.updated_at)}`
              : ''}
            {' · used by “Run with screenshots”'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          )}
          {savedAt && !dirty && (
            <span className="text-xs text-emerald-600">Saved</span>
          )}
          {open && dirty && (
            <button
              onClick={() => setBody(stored)}
              disabled={saving}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Revert
            </button>
          )}
          {open && (
            <button
              onClick={() => void save()}
              disabled={!dirty || blocked || saving}
              title={
                blocked
                  ? 'Fix the problem below before saving'
                  : !dirty
                    ? 'No changes to save'
                    : undefined
              }
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save script'}
            </button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {open ? 'Hide' : 'Edit script'}
          </button>
        </div>
      </header>

      {open && (
        <div className="p-4">
          <div className="flex overflow-hidden rounded-md border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
            <div
              ref={gutterRef}
              aria-hidden
              className="max-h-[32rem] select-none overflow-hidden bg-gray-50 px-2 py-2 text-right font-mono text-xs leading-5 text-gray-400"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={onKeyDown}
              onScroll={() => {
                if (gutterRef.current && textareaRef.current) {
                  gutterRef.current.scrollTop = textareaRef.current.scrollTop;
                }
              }}
              spellCheck={false}
              wrap="off"
              className="h-[32rem] flex-1 resize-y overflow-auto px-3 py-2 font-mono text-xs leading-5 text-gray-800 focus:outline-none"
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-gray-400">
              {lineCount} lines · {body.length.toLocaleString()} characters ·
              Ctrl+S to save
            </span>
          </div>

          {issues.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {issues.map((issue, i) => (
                <li
                  key={i}
                  className={`rounded-md border px-3 py-2 text-xs ${
                    issue.level === 'error'
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
