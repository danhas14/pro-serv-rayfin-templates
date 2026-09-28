/**
 * Confirmation dialog shown before a run, used to collect any credentials the
 * test needs.
 *
 * Secrets are gathered here, held in React state for the duration of the call,
 * and handed to the agent as a `secrets` map. They are never written to the
 * database, never placed in a URL, and never logged — the agent is likewise
 * instructed to redact them from every field it returns. That is why the tests
 * reference `{{secret:key}}` tokens rather than storing a password on the step:
 * a shared test repository that anyone on the team can open must not double as
 * a credential store.
 *
 * The inputs are `type="password"` and the browser is asked not to autofill
 * them, so a shoulder-surfer in a shared screen-share does not read them off.
 */
import { useState } from 'react';

interface Props {
  testName: string;
  secretKeys: string[];
  busy: boolean;
  onCancel: () => void;
  onRun: (secrets: Record<string, string>) => void;
}

export function RunTestDialog({
  testName,
  secretKeys,
  busy,
  onCancel,
  onRun,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({});

  const missing = secretKeys.filter((k) => !values[k]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Run test</h2>
        <p className="mt-1 text-sm text-gray-500">{testName}</p>

        {secretKeys.length > 0 ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-gray-600">
              This test needs the following credentials. They are used for this
              run only and are never saved.
            </p>
            {secretKeys.map((key) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-gray-700">{key}</span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={values[key] ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-gray-600">
            The agent will open a browser and execute the steps in order. This
            can take a few minutes — keep this tab open until it finishes.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || missing.length > 0}
            onClick={() => onRun(values)}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            title={
              missing.length > 0
                ? `Still needed: ${missing.join(', ')}`
                : undefined
            }
          >
            {busy ? 'Running…' : 'Run now'}
          </button>
        </div>
      </div>
    </div>
  );
}
