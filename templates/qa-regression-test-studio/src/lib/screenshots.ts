/**
 * Screenshot evidence links.
 *
 * A step's `screenshot_url` is the canonical OneLake location, but it is a
 * data-plane API address: opening it in a browser returns
 * `401 Authentication Failed with Bearer token is not present in the request`,
 * because a plain navigation cannot carry a token. So the image itself is
 * fetched through the runner (which authenticates the caller and reads OneLake
 * with its managed identity), and the OneLake URL is kept so it can be turned
 * into a Fabric portal deep link to the same file.
 */

/** Runner endpoint that streams one screenshot back as an image. */
export function screenshotImageUrl(
  runnerBaseUrl: string,
  runId: string,
  filename: string
): string {
  return `${runnerBaseUrl.replace(/\/+$/, '')}/screenshots/${encodeURIComponent(
    runId
  )}/${encodeURIComponent(filename)}`;
}

/**
 * Fabric portal deep link to the screenshot itself, derived from the stored
 * OneLake URL so no extra configuration is needed.
 *
 * `selectedPath` is the lakehouse-relative path, which is exactly the part of
 * the OneLake URL that follows the lakehouse id.
 */
export function oneLakePortalUrl(screenshotUrl: string): string | null {
  const match =
    /^https:\/\/onelake\.dfs\.fabric\.microsoft\.com\/([^/]+)\/([^/]+)\/(.+)$/.exec(
      screenshotUrl
    );
  if (!match) return null;
  const [, workspaceId, lakehouseId, path] = match;
  return (
    `https://app.powerbi.com/groups/${workspaceId}/lakehouses/${lakehouseId}` +
    `?experience=power-bi&selectedPath=${encodeURIComponent(path)}`
  );
}

/** Bare filename from a stored OneLake screenshot URL. */
export function screenshotFilename(screenshotUrl: string): string | null {
  const name = screenshotUrl.split('/').pop() ?? '';
  return /^[A-Za-z0-9_.-]+\.png$/.test(name) ? name : null;
}
