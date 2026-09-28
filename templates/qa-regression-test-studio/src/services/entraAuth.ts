/**
 * MSAL helper that acquires a delegated Azure AI token for the signed-in user.
 *
 * One audience is needed: `https://cognitiveservices.azure.com/user_impersonation`,
 * used as the `Authorization` bearer when calling the Foundry agent endpoint.
 * (The agent host accepts either the Cognitive Services or the `ai.azure.com`
 * audience; Cognitive Services is used here because it is already consented in
 * this tenant.)
 *
 * NOTE: this is the *explicit* scope, not `.default`, and that is deliberate.
 * `.default` asks for "everything already statically configured for this
 * resource" and is rejected outright when nothing is configured. The Cognitive
 * Services API is not exposed in this tenant's "APIs my organization uses"
 * picker, so the permission cannot be added to the app registration up front.
 * Naming the scope explicitly triggers incremental consent instead: Entra
 * prompts on first use. Do not "simplify" this back to `.default` — it fails
 * with AADSTS65001 / invalid_scope.
 *
 * MSAL runs as a *public client* (auth-code + PKCE). There is no client secret
 * anywhere in this app; tokens are short-lived, held only in `sessionStorage`,
 * and always scoped to the signed-in user. The agent therefore runs under that
 * user's own RBAC, so a user without the Cognitive Services User role on the AI
 * resource cannot execute tests — consent lets the app *ask* for a token, the
 * role is what makes the token *work*.
 */
import { PublicClientApplication, type AccountInfo } from '@azure/msal-browser';

import { getAgentConfig } from '@/config/agentConfig';

/**
 * Audiences the Foundry agent runtime may accept, most-likely first.
 *
 * `ai.azure.com` is first on documented evidence, not preference: the Browser
 * Automation toolbox behind this agent is reached through a remote-tool
 * connection created with `--auth-type user-entra-token --audience
 * https://ai.azure.com`, which passes the *caller's* identity through to the
 * tool. Presenting that audience is therefore what lets the toolbox re-use our
 * token. The Cognitive Services audience is kept as a fallback because the
 * plain model routes on the same host accept it, and a future agent without a
 * toolbox may too.
 *
 * Both are the *explicit* scope, not `.default`, and that is deliberate.
 * `.default` asks for "everything already statically configured for this
 * resource" and is rejected outright when nothing is configured. Neither API is
 * exposed in this tenant's "APIs my organization uses" picker, so the
 * permission cannot be added to the app registration up front. Naming the scope
 * explicitly triggers incremental consent instead: Entra prompts on first use.
 * Do not "simplify" these to `.default` — it fails with AADSTS65001 /
 * invalid_scope.
 */
export const AGENT_SCOPES = [
  'https://ai.azure.com/user_impersonation',
  'https://cognitiveservices.azure.com/user_impersonation',
] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];

/**
 * Thrown when a token cannot be obtained silently and an interactive sign-in is
 * required. Interactive sign-in opens a popup, which browsers block unless it
 * is started from a user gesture — and which is also blocked inside the Fabric
 * portal iframe. Callers catch this and surface a "Connect" button that calls
 * {@link connectToAzureAi} from the click handler.
 */
export class SignInRequiredError extends Error {
  constructor() {
    super('Microsoft sign-in is required before tests can be executed.');
    this.name = 'SignInRequiredError';
  }
}

let pcaPromise: Promise<PublicClientApplication> | null = null;
let account: AccountInfo | null = null;

async function getPca(): Promise<PublicClientApplication> {
  if (!pcaPromise) {
    const { tenantId, clientId } = getAgentConfig();
    const pca = new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });
    pcaPromise = pca.initialize().then(() => {
      const accounts = pca.getAllAccounts();
      if (accounts.length > 0) account = accounts[0];
      return pca;
    });
  }
  return pcaPromise;
}

/**
 * Access token for one of the {@link AGENT_SCOPES}. Silent by default; pass
 * `interactive` only from a click handler.
 */
export async function getAiToken(
  scope: string = AGENT_SCOPES[0],
  opts: { interactive?: boolean; loginHint?: string } = {}
): Promise<string> {
  const pca = await getPca();

  try {
    const result = await pca.acquireTokenSilent({
      scopes: [scope],
      account: account ?? undefined,
    });
    account = result.account;
    return result.accessToken;
  } catch {
    if (!opts.interactive) throw new SignInRequiredError();
    const result = await pca.acquireTokenPopup({
      scopes: [scope],
      loginHint: opts.loginHint,
      // Always let the user pick: the Fabric portal identity (which holds the
      // AI resource role assignment) often differs from other signed-in
      // accounts, and the wrong one yields a 401 on the first agent call.
      prompt: 'select_account',
    });
    account = result.account;
    return result.accessToken;
  }
}

/**
 * Start an interactive sign-in and warm the token cache. MUST be called from a
 * user-gesture handler so the auth popup is not blocked.
 *
 * Only the primary scope is acquired interactively. The alternate audience is
 * requested lazily and silently, so users are not made to click through a
 * second consent prompt for an audience that may never be needed.
 */
export async function connectToAzureAi(loginHint?: string): Promise<void> {
  await getAiToken(AGENT_SCOPES[0], { interactive: true, loginHint });
}

/**
 * ID token for the signed-in user, used as the bearer for the Container App
 * runner, whose Easy Auth is configured to accept this app registration's own
 * client id as the audience.
 *
 * An ID token is used rather than an access token because this app registration
 * exposes no API: it has no Application ID URI, so Entra cannot mint an access
 * token whose `aud` is this app. Granting one requires Graph write access that
 * this tenant does not give us. The ID token is still a signed, tenant-issued,
 * audience-scoped, short-lived assertion, and Easy Auth validates issuer,
 * audience, signature and expiry on it exactly as it would an access token.
 *
 * The trade-off is that an ID token carries no scopes, so the runner can only
 * authenticate the caller, not authorize a particular permission. Every
 * signed-in user of this app can therefore start a run. To tighten that: add an
 * Application ID URI plus a scope to the registration, request that scope here,
 * and drop the bare client id from the runner's `allowedAudiences` — the
 * `api://` audience is already configured, so no redeploy is needed.
 */
export async function getRunnerToken(
  opts: { interactive?: boolean } = {}
): Promise<string> {
  const pca = await getPca();
  const request = { scopes: ['openid', 'profile'], account: account ?? undefined };

  try {
    const result = await pca.acquireTokenSilent(request);
    account = result.account;
    return result.idToken;
  } catch {
    if (!opts.interactive) throw new SignInRequiredError();
    const result = await pca.acquireTokenPopup({
      ...request,
      prompt: 'select_account',
    });
    account = result.account;
    return result.idToken;
  }
}

/** True when a token can be had silently — used to render connection state. */
export async function isConnectedToAzureAi(): Promise<boolean> {
  try {
    await getAiToken();
    return true;
  } catch {
    return false;
  }
}
/**
 * MSAL popups are blocked inside the Fabric portal's cross-origin iframe, so
 * the first interactive consent must happen with the app open in its own tab.
 */
export function isEmbeddedInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Non-sensitive identity claims from the current access token, for diagnostics.
 *
 * A 403 from the agent means the token was accepted but the *principal* was not
 * authorized, and the single most common cause is that the browser is signed in
 * as a different account than the one holding the role assignment. Reading back
 * `upn` / `oid` / `aud` turns "permission denied" into "permission denied for
 * this specific identity against this specific audience", which is the
 * difference between a five-minute fix and an afternoon.
 *
 * Only the identifying claims are read. The token itself is never surfaced.
 */
export function describeToken(accessToken: string): {
  upn?: string;
  oid?: string;
  aud?: string;
  tid?: string;
  scp?: string;
  appid?: string;
} {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return {};
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '='
    );
    const claims = JSON.parse(atob(padded)) as Record<string, string>;
    return {
      upn: claims.upn ?? claims.preferred_username ?? claims.unique_name,
      oid: claims.oid,
      aud: claims.aud,
      tid: claims.tid,
      scp: claims.scp,
      appid: claims.appid ?? claims.azp,
    };
  } catch {
    return {};
  }
}
