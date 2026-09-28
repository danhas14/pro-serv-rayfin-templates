/**
 * Register the applications under test.
 *
 * Four rows in the customer's case — two internal, two commercial off-the-shelf
 * — and keeping the start URL here rather than on each test means a URL change
 * at release time is one edit instead of one per test.
 */
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/AuthContext';
import {
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
  type ApplicationRow,
} from '@/services/testStore';

const EMPTY = {
  name: '',
  description: '',
  start_url: '',
  kind: 'Internal',
  platform: 'Web',
  auth_required: true,
};

type Draft = typeof EMPTY;

export function ApplicationsPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = () =>
    listApplications()
      .then(setApps)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load.')
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    void refresh();
  }, []);

  async function save() {
    if (!draft.name.trim() || !draft.start_url.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateApplication(editingId, draft);
      } else {
        await createApplication({ ...draft, created_by: user?.id ?? 'unknown' });
      }
      setDraft(EMPTY);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (
      !window.confirm(
        'Delete this application? Tests that reference it will no longer run.'
      )
    ) {
      return;
    }
    try {
      await deleteApplication(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Applications</h1>
        <p className="mt-1 text-sm text-gray-500">
          The systems your tests run against.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">
          {editingId ? 'Edit application' : 'Add an application'}
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Name</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Supplier Portal"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">Start URL</span>
            <input
              value={draft.start_url}
              onChange={(e) => setDraft({ ...draft, start_url: e.target.value })}
              placeholder="https://portal.example.com"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">Type</span>
            <select
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="Internal">Internally developed</option>
              <option value="COTS">Commercial off-the-shelf</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">Platform</span>
            <select
              value={draft.platform}
              onChange={(e) => setDraft({ ...draft, platform: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="Web">Web only</option>
              <option value="WebAndMobile">Web and mobile browser</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-gray-700">
              Description
            </span>
            <input
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.auth_required}
              onChange={(e) =>
                setDraft({ ...draft, auth_required: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              Requires sign-in before tests can proceed
            </span>
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => void save()}
            disabled={saving || !draft.name.trim() || !draft.start_url.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add'}
          </button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setDraft(EMPTY);
              }}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-500">Loading…</p>
        ) : apps.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No applications registered yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {apps.map((app) => (
              <li key={app.id} className="flex items-start justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {app.name}
                    </span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                      {app.kind === 'COTS' ? 'Off-the-shelf' : 'Internal'}
                    </span>
                    {app.platform === 'WebAndMobile' && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">
                        Mobile
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-gray-500">
                    {app.start_url}
                  </div>
                  {app.description && (
                    <div className="mt-0.5 text-xs text-gray-500">
                      {app.description}
                    </div>
                  )}
                </div>

                <div className="ml-4 flex shrink-0 gap-3">
                  <button
                    onClick={() => {
                      setEditingId(app.id);
                      setDraft({
                        name: app.name,
                        description: app.description ?? '',
                        start_url: app.start_url,
                        kind: app.kind,
                        platform: app.platform,
                        auth_required: app.auth_required,
                      });
                    }}
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void remove(app.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
