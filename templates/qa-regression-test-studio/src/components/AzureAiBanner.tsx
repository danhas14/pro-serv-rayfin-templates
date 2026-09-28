/**
 * Banner prompting the one-time Azure AI consent needed to execute tests.
 *
 * Rendered above the page content rather than inside a modal so it never blocks
 * authoring: an analyst can write and organise tests all day without ever
 * connecting, and is only asked at the point of running one.
 *
 * When the app is inside the Fabric portal's iframe the banner offers a new-tab
 * link instead of a Connect button, because MSAL's consent popup is blocked
 * from a cross-origin iframe and clicking Connect there does nothing visible.
 */
import { useState } from 'react';

import { useAuth } from '@/hooks/AuthContext';
import { useAzureAi } from '@/hooks/AzureAiContext';

export function AzureAiBanner() {
  const { connected, checking, configured, embedded, error, connect } =
    useAzureAi();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  if (checking || connected) return null;

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong className="font-semibold">Agent not configured.</strong>{' '}
        Set <code className="font-mono text-xs">VITE_ENTRA_CLIENT_ID</code> and{' '}
        <code className="font-mono text-xs">VITE_AGENT_ENDPOINT</code> in{' '}
        <code className="font-mono text-xs">.env</code>, then redeploy. Tests can
        still be authored in the meantime.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-blue-900">
          <strong className="font-semibold">Connect to Azure AI</strong> to
          execute tests. Authoring works without it.
        </div>

        {embedded ? (
          <a
            href={window.location.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open in a new tab to connect
          </a>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              connect(user?.email)
                .catch(() => undefined)
                .finally(() => setBusy(false));
            }}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        )}
      </div>

      {embedded && (
        <p className="mt-2 text-xs text-blue-800">
          The sign-in popup is blocked inside the Fabric portal frame, so the
          first consent has to happen in a normal tab.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
