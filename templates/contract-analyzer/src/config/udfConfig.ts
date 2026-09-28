/**
 * Configuration for the Python Fabric User Data Functions backend.
 *
 * Every value here is injected at build time via Vite env vars, and none of
 * them are secrets: they are a public Entra SPA client id (public client, no
 * secret) and the publicly-invocable URLs of your own deployed User Data
 * Functions. Invoking those URLs still requires a valid delegated user token.
 *
 * Deliberately absent: the Content Understanding endpoint, the analyzer id, the
 * Foundry model endpoint, and the model deployment name. Those live in
 * `fabric-udf/function_app.py` so the browser never learns them and cannot be
 * pointed at a different analyzer or model.
 *
 * Required env vars (set in `.env` / `.env.local`):
 *   VITE_FABRIC_SPA_CLIENT_ID   Entra SPA app-registration client id
 *   VITE_UDF_ANALYZE_URL        Public URL of the `analyze_contract` function
 *   VITE_UDF_POLL_URL           Public URL of the `poll_contract` function
 *   VITE_UDF_ASK_URL            Public URL of the `ask_contract` function
 *
 * Optional:
 *   VITE_FABRIC_TENANT_ID       Entra tenant id (defaults to `organizations`)
 */
export interface UdfConfig {
  tenantId: string;
  clientId: string;
  urls: {
    analyze: string;
    poll: string;
    ask: string;
  };
}

export function getUdfConfig(): UdfConfig {
  const clientId = import.meta.env.VITE_FABRIC_SPA_CLIENT_ID as
    | string
    | undefined;
  const analyze = import.meta.env.VITE_UDF_ANALYZE_URL as string | undefined;
  const poll = import.meta.env.VITE_UDF_POLL_URL as string | undefined;
  const ask = import.meta.env.VITE_UDF_ASK_URL as string | undefined;
  const tenantId =
    (import.meta.env.VITE_FABRIC_TENANT_ID as string | undefined) ||
    'organizations';

  if (!clientId) {
    throw new Error(
      'Missing Entra config. Set VITE_FABRIC_SPA_CLIENT_ID in your .env file.'
    );
  }
  if (!analyze || !poll || !ask) {
    throw new Error(
      'Missing UDF function URLs. Set VITE_UDF_ANALYZE_URL, ' +
        'VITE_UDF_POLL_URL and VITE_UDF_ASK_URL in your .env file.'
    );
  }

  return { tenantId, clientId, urls: { analyze, poll, ask } };
}

export function isUdfConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_FABRIC_SPA_CLIENT_ID &&
      import.meta.env.VITE_UDF_ANALYZE_URL &&
      import.meta.env.VITE_UDF_POLL_URL &&
      import.meta.env.VITE_UDF_ASK_URL
  );
}
