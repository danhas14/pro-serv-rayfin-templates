/**
 * Runtime configuration read from `import.meta.env`.
 *
 * Validated once, eagerly, with a message naming the missing variable — a
 * misconfigured deployment should say so on the config screen rather than
 * failing halfway through someone's first test run.
 */
export interface AgentConfig {
  clientId: string;
  tenantId: string;
  endpoint: string;
  timeoutSeconds: number;
}

let cached: AgentConfig | null = null;

/** Throws with a precise message when a required `VITE_*` value is missing. */
export function getAgentConfig(): AgentConfig {
  if (cached) return cached;

  const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
  const endpoint = import.meta.env.VITE_AGENT_ENDPOINT;

  if (!clientId) {
    throw new Error(
      'VITE_ENTRA_CLIENT_ID is not set. Add it to .env — see .env.example.'
    );
  }
  if (!endpoint) {
    throw new Error(
      'VITE_AGENT_ENDPOINT is not set. Add it to .env — see .env.example.'
    );
  }

  cached = {
    clientId,
    endpoint,
    tenantId: import.meta.env.VITE_ENTRA_TENANT_ID || 'organizations',
    timeoutSeconds: Number(import.meta.env.VITE_AGENT_TIMEOUT_SECONDS) || 600,
  };
  return cached;
}

/** True when config is present, for rendering a setup hint instead of crashing. */
export function isAgentConfigured(): boolean {
  try {
    getAgentConfig();
    return true;
  } catch {
    return false;
  }
}
