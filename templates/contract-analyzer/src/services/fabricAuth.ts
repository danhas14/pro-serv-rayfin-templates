/**
 * MSAL helper that acquires delegated tokens for the signed-in user.
 *
 * Two audiences are needed:
 *
 *  - Power BI       (`https://analysis.windows.net/powerbi/api/.default`)
 *    Used as the `Authorization` bearer when *invoking* the Fabric User Data
 *    Functions. Requires the `UserDataFunction.Execute.All` delegated
 *    permission on the SPA app registration.
 *
 *  - Azure AI       (`https://cognitiveservices.azure.com/user_impersonation`)
 *    Passed to the functions as `aiToken`. Both Azure AI Content Understanding
 *    and the Foundry model endpoint accept Entra bearer tokens with this
 *    audience. Each user also needs the *Cognitive Services User* role on the
 *    AI resource — consent lets the app ask for a token, the role is what makes
 *    the token work.
 *
 *    NOTE: this is the explicit scope, not `.default`, and that is deliberate.
 *    `.default` asks for "everything already statically configured for this
 *    resource" and is rejected outright when nothing is configured. The
 *    Cognitive Services API is not exposed in this tenant's "APIs my
 *    organization uses" picker, so the permission *cannot* be added to the app
 *    registration up front. Naming the scope explicitly triggers incremental
 *    consent instead: Entra prompts on first use. Do not "simplify" this back
 *    to `.default` — it will fail with AADSTS65001 / invalid_scope.
 *
 * MSAL runs as a *public client* (auth-code + PKCE) — there is no client
 * secret anywhere in this app, and tokens are short-lived, held only in the
 * browser's `sessionStorage`, and always scoped to the signed-in user. Azure AI
 * therefore enforces that user's own RBAC on every analyze and every question.
 */
import { PublicClientApplication, type AccountInfo } from '@azure/msal-browser';

import { getUdfConfig } from '@/config/udfConfig';

const PBI_SCOPE = 'https://analysis.windows.net/powerbi/api/.default';
const AI_SCOPE = 'https://cognitiveservices.azure.com/user_impersonation';

/**
 * Microsoft Graph, used only to read a document out of SharePoint or OneDrive.
 *
 * Explicit scope rather than `.default`, for the same reason as the Azure AI
 * scope above: it triggers incremental consent at first use instead of
 * requiring the permission to be pre-configured on the app registration.
 *
 * Acquired lazily — only when someone actually pastes a SharePoint link — so
 * users who only ever upload files are never prompted for Graph access they do
 * not need.
 */
const GRAPH_SCOPE = 'https://graph.microsoft.com/Files.Read.All';

/**
 * Thrown when a token cannot be obtained silently and an interactive sign-in
 * is required. Interactive sign-in opens a popup, which browsers block unless
 * it is started from a user gesture — and which is also blocked inside the
 * Fabric portal iframe when triggered automatically. Callers should catch this
 * and surface a "Connect to Azure AI" button that calls {@link signInToFabric}
 * from the click handler.
 */
export class SignInRequiredError extends Error {
  constructor() {
    super('Microsoft sign-in required to call Azure AI.');
    this.name = 'SignInRequiredError';
  }
}

let pcaPromise: Promise<PublicClientApplication> | null = null;
let account: AccountInfo | null = null;

async function getPca(): Promise<PublicClientApplication> {
  if (!pcaPromise) {
    const { tenantId, clientId } = getUdfConfig();
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

async function acquire(
  scope: string,
  opts: { interactive?: boolean; loginHint?: string }
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
      // Always let the user pick: the Fabric portal identity (which owns the
      // workspace permissions) often differs from other signed-in accounts,
      // and the wrong one yields a 401 when invoking the function.
      prompt: 'select_account',
    });
    account = result.account;
    return result.accessToken;
  }
}

/** Power BI service token — the bearer used to invoke the User Data Functions. */
export function getFabricToken(
  opts: { interactive?: boolean; loginHint?: string } = {}
): Promise<string> {
  return acquire(PBI_SCOPE, opts);
}

/** Azure AI token — forwarded to the functions as `aiToken`. */
export function getAiToken(
  opts: { interactive?: boolean; loginHint?: string } = {}
): Promise<string> {
  return acquire(AI_SCOPE, opts);
}

/**
 * Microsoft Graph token — forwarded as `graphToken` so the function can read a
 * SharePoint document as the signed-in user.
 *
 * Call this only on the SharePoint path. `Files.Read.All` usually needs admin
 * consent, and there is no reason to ask users who upload files for it.
 */
export function getGraphToken(
  opts: { interactive?: boolean; loginHint?: string } = {}
): Promise<string> {
  return acquire(GRAPH_SCOPE, opts);
}

/**
 * Start an interactive sign-in and warm both token caches. MUST be called from
 * a user-gesture handler (e.g. a button click) so the auth popup is not
 * blocked — this is the only reliable interactive path when the app is
 * embedded in the Fabric portal iframe.
 *
 * `loginHint` should be the Fabric portal account email so the correct
 * (permissioned) identity is pre-selected.
 */
export async function signInToFabric(loginHint?: string): Promise<void> {
  await getFabricToken({ interactive: true, loginHint });
  await getAiToken({ interactive: true, loginHint });
}
