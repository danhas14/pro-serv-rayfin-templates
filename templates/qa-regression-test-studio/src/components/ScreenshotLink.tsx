/**
 * "View screenshot" link that actually opens the image.
 *
 * The stored OneLake URL cannot be opened directly — it is a data-plane API
 * address and a browser navigation carries no bearer token, so it returns 401.
 * This fetches the bytes through the runner using the signed-in user's token,
 * then opens the result as a blob URL in a new window.
 *
 * The fetch is started from the click handler so the popup is attributed to a
 * user gesture; opening the window only after an await would be blocked.
 */
import { useState } from 'react';

import {
  oneLakePortalUrl,
  screenshotFilename,
  screenshotImageUrl,
} from '@/lib/screenshots';
import { getRunnerToken } from '@/services/entraAuth';
import { getRunnerUrl } from '@/services/containerAppRunner';

interface Props {
  runId: string;
  screenshotUrl: string;
}

export function ScreenshotLink({ runId, screenshotUrl }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runnerBase = getRunnerUrl();
  const filename = screenshotFilename(screenshotUrl);
  const portalUrl = oneLakePortalUrl(screenshotUrl);

  async function open() {
    if (!filename || !runnerBase) return;
    setBusy(true);
    setError(null);

    // Opened up front so the browser attributes it to the click; navigating it
    // after the await avoids the popup blocker.
    const win = window.open('', '_blank');

    try {
      const token = await getRunnerToken();
      const response = await fetch(
        screenshotImageUrl(runnerBase, runId, filename),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? 'That screenshot is no longer available.'
            : `Could not load the screenshot (HTTP ${response.status}).`
        );
      }

      const blobUrl = URL.createObjectURL(await response.blob());
      if (win) {
        win.location.href = blobUrl;
      } else {
        window.location.href = blobUrl;
      }
      // Revoked late so the new window has finished reading it.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      win?.close();
      setError(
        err instanceof Error ? err.message : 'Could not load the screenshot.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (!filename || !runnerBase) {
    // Pre-proxy runs, or the runner is not configured: the portal is the only
    // route to the evidence.
    return portalUrl ? (
      <a
        href={portalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
        title="Open this screenshot in the Fabric portal"
      >
        Open in OneLake
      </a>
    ) : null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        disabled={busy}
        className="text-blue-600 hover:underline disabled:opacity-50"
      >
        {busy ? 'Opening…' : 'View screenshot'}
      </button>
      {portalUrl && (
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-gray-600 hover:underline"
          title="Open this screenshot in the Fabric portal"
        >
          Open in OneLake
        </a>
      )}
      {error && <span className="text-red-600">{error}</span>}
    </>
  );
}
