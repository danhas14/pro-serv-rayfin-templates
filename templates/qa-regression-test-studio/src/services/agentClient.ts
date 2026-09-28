/**
 * Calls the `regression-test-agent` Foundry agent over the OpenAI Responses
 * protocol and returns the parsed `TestExecutionResult`.
 *
 * Called directly from the browser. That is safe and deliberate:
 *
 *  - the agent host sends `Access-Control-Allow-Origin: *` for this route
 *    (verified against the live endpoint), so no proxy is required;
 *  - the bearer is a short-lived delegated *user* token, so every run is
 *    attributable and authorized as the person who clicked Run;
 *  - there is no secret to hide server-side, so a proxy would add a failure
 *    point and an audit gap without adding a security boundary.
 *
 * `api-version=v1` is mandatory. The endpoint rejects `2025-05-01` with
 * `UnsupportedApiVersion` and older previews with "API version not supported",
 * so the version is pinned here rather than made configurable.
 */
import { getAgentConfig } from '@/config/agentConfig';
import {
  AGENT_SCOPES,
  describeToken,
  getAiToken,
  SignInRequiredError,
} from '@/services/entraAuth';
import type { AgentRequestPayload, AgentTestResult } from '@/types/agent';

/** Raised when the agent host itself rejects the call (auth, quota, tooling). */
export class AgentInvocationError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Service-provided detail. Safe to persist — contains no identity claims. */
    readonly detail?: string,
    /**
     * Signed-in identity that was refused. Deliberately NOT part of `detail`:
     * `detail` is written to the shared run history and the CSV export, and a
     * UPN / object id / tenant id has no business sitting in a table every
     * member of the team can read and download. Surfaced to the operator in
     * development only.
     */
    readonly identity?: string
  ) {
    super(message);
    this.name = 'AgentInvocationError';
  }
}

/** Raised when the agent replies but not with the agreed JSON contract. */
export class AgentContractError extends Error {
  constructor(
    message: string,
    readonly rawText: string
  ) {
    super(message);
    this.name = 'AgentContractError';
  }
}

interface ResponsesEnvelope {
  id?: string;
  status?: string;
  error?: { message?: string; code?: string };
  output?: Array<{
    type: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
}

/**
 * Pull the assistant's text out of a Responses payload.
 *
 * There is no top-level `output_text`. Text lives in
 * `output[] -> type === 'message' -> content[] -> .text`, and earlier entries
 * are `reasoning` / tool-call items carrying no text at all, so the array must
 * be filtered rather than indexed.
 */
function extractText(envelope: ResponsesEnvelope): string {
  const parts: string[] = [];
  for (const item of envelope.output ?? []) {
    if (item.type !== 'message') continue;
    for (const chunk of item.content ?? []) {
      if (chunk.text) parts.push(chunk.text);
    }
  }
  return parts.join('').trim();
}

/**
 * Recover a JSON object from the model's reply.
 *
 * The agent is instructed to emit bare JSON, but models occasionally wrap it in
 * a markdown fence. Stripping a fence is cheap and keeps a good run from being
 * discarded over formatting; anything beyond that is a genuine contract breach
 * and is surfaced as one rather than being guessed at.
 */
function parseResultJson(text: string): AgentTestResult {
  let candidate = text.trim();

  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) candidate = fenced[1].trim();

  if (!candidate.startsWith('{')) {
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first === -1 || last <= first) {
      throw new AgentContractError(
        'The agent did not return a JSON result object.',
        text
      );
    }
    candidate = candidate.slice(first, last + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new AgentContractError(
      'The agent returned text that is not valid JSON.',
      text
    );
  }

  const result = parsed as Partial<AgentTestResult>;
  if (!result.status) {
    throw new AgentContractError(
      'The agent result is missing the required "status" field.',
      text
    );
  }

  // Normalize the collections so downstream persistence never guards for null.
  return {
    testId: result.testId ?? 0,
    status: result.status,
    durationSeconds: result.durationSeconds ?? 0,
    stepResults: result.stepResults ?? [],
    assertionResults: result.assertionResults ?? [],
    failedStepNumber: result.failedStepNumber ?? null,
    failureReason: result.failureReason ?? null,
    summary: result.summary ?? '',
  };
}

/**
 * Pull a human-usable message out of an error response.
 *
 * Azure services are inconsistent here: some return `{error:{message}}`, some
 * `{error:{code}}`, some a bare `{message}`, and some no body at all with the
 * real reason only in the `x-ms-error-code` header. Checking each in turn is
 * what stops the UI from reporting a bare status code, which tells an analyst
 * nothing actionable.
 */
function describeFailure(response: Response, bodyText: string): string {
  const parts: string[] = [];

  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { message?: string; code?: string };
      message?: string;
      Message?: string;
    };
    const message =
      parsed?.error?.message ?? parsed?.message ?? parsed?.Message;
    if (message) parts.push(message);
    if (parsed?.error?.code) parts.push(`(code: ${parsed.error.code})`);
  } catch {
    // Not JSON — a trimmed slice of the raw body still beats nothing.
    const trimmed = bodyText.trim();
    if (trimmed) parts.push(trimmed.slice(0, 400));
  }

  const errorCode = response.headers.get('x-ms-error-code');
  if (errorCode && !parts.some((p) => p.includes(errorCode))) {
    parts.push(`(x-ms-error-code: ${errorCode})`);
  }

  const challenge = response.headers.get('www-authenticate');
  if (challenge) parts.push(`(www-authenticate: ${challenge})`);

  return parts.join(' ');
}

/**
 * Execute one test definition against the agent.
 *
 * `payload.secrets` is sent but never logged or persisted anywhere; the agent
 * is likewise instructed to redact them from every field it returns.
 */
export async function invokeAgent(
  payload: AgentRequestPayload,
  opts: { signal?: AbortSignal } = {}
): Promise<{ result: AgentTestResult; responseId?: string }> {
  const { endpoint, timeoutSeconds } = getAgentConfig();

  const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}api-version=v1`;

  const instruction =
    'Execute the following test definition against a live browser using the ' +
    'Browser Automation tool, then return exactly one TestExecutionResult ' +
    'JSON object and nothing else.\n\n' +
    JSON.stringify(payload, null, 2);

  // Abort on the caller's signal *or* the configured ceiling, whichever first.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutSeconds * 1000);
  const onAbort = () => timeout.abort();
  opts.signal?.addEventListener('abort', onAbort);

  /** One attempt with one audience. */
  async function attempt(
    scope: string,
    allowConsent: boolean
  ): Promise<{
    response: Response;
    bodyText: string;
    token: string;
  }> {
    const token = await getAiToken(scope, { interactive: allowConsent });
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: instruction }),
      signal: timeout.signal,
    });
    return { response, bodyText: await response.text(), token };
  }

  let success: { response: Response; bodyText: string; token: string } | null =
    null;
  const refusals: string[] = [];

  try {
    for (const [index, scope] of AGENT_SCOPES.entries()) {
      // The first audience must already be consented — that is what the
      // "Connect" button warms, and prompting there would be surprising.
      // A *fallback* audience has by definition never been consented, so it is
      // allowed to prompt: the user is already mid-click on "Run", and without
      // this the fallback could never be exercised at all.
      const allowConsent = index > 0 && refusals.length > 0;

      let outcome: Awaited<ReturnType<typeof attempt>>;
      try {
        outcome = await attempt(scope, allowConsent);
      } catch (err) {
        // A scope that cannot be acquired (never consented, or the consent
        // popup was blocked) is recorded and skipped rather than aborting the
        // whole run — another audience may still succeed.
        if (err instanceof SignInRequiredError) {
          refusals.push(`${new URL(scope).host}: not consented`);
          continue;
        }
        if (timeout.signal.aborted) {
          throw new AgentInvocationError(
            `The agent did not respond within ${timeoutSeconds} seconds.`
          );
        }
        if (allowConsent) {
          refusals.push(
            `${new URL(scope).host}: consent failed (${
              err instanceof Error ? err.message : 'unknown error'
            })`
          );
          continue;
        }
        throw new AgentInvocationError(
          err instanceof Error
            ? err.message
            : 'Network error calling the agent.'
        );
      }

      // Only an identity refusal is worth retrying with another audience.
      // Any other status is a real answer and must not be masked.
      if (outcome.response.status === 401 || outcome.response.status === 403) {
        const { aud } = describeToken(outcome.token);
        const detail = describeFailure(outcome.response, outcome.bodyText);
        refusals.push(
          `${aud ?? scope} → HTTP ${outcome.response.status}${
            detail ? ` (${detail})` : ' (no detail returned)'
          }`
        );
        continue;
      }

      success = outcome;
      break;
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }

  if (!success) {
    // Every audience was refused. The service-side reason is persisted; the
    // identity that was refused is not — it is a claim about a person, and the
    // run history is shared. It goes to the console in development only, where
    // the only reader is the signed-in user looking at their own session.
    let identity: string | undefined;
    try {
      const { upn, oid, tid, appid, scp } = describeToken(
        await getAiToken(AGENT_SCOPES[0])
      );
      identity = [
        upn ? `signed in as ${upn}` : null,
        oid ? `object id ${oid}` : null,
        tid ? `tenant ${tid}` : null,
        appid ? `client app ${appid}` : null,
        scp ? `granted scopes ${scp}` : 'no scp claim in the token',
      ]
        .filter(Boolean)
        .join(', ');
    } catch {
      identity = 'could not read the signed-in identity';
    }

    if (import.meta.env.DEV) {
      console.warn('[agent] all audiences refused —', identity);
    }

    throw new AgentInvocationError(
      'Azure AI refused the request. Check that this account holds Cognitive ' +
        'Services User or Foundry User on the Foundry project, and that the ' +
        'app registration has consent for the Azure AI scope.',
      403,
      `Attempts: ${refusals.join(' | ')}`,
      identity
    );
  }

  const { response, bodyText } = success;

  if (!response.ok) {
    throw new AgentInvocationError(
      `The agent endpoint returned HTTP ${response.status}.`,
      response.status,
      describeFailure(response, bodyText)
    );
  }

  let envelope: ResponsesEnvelope;
  try {
    envelope = JSON.parse(bodyText);
  } catch {
    throw new AgentContractError(
      'The agent endpoint returned a non-JSON response.',
      bodyText
    );
  }

  if (envelope.error?.message) {
    throw new AgentInvocationError(
      'The agent reported an error.',
      response.status,
      envelope.error.message
    );
  }

  const text = extractText(envelope);
  if (!text) {
    // `incomplete` means the model burned its output budget (it is a reasoning
    // model) before emitting the result — worth saying plainly.
    const reason =
      envelope.status === 'incomplete'
        ? 'The agent ran out of output budget before returning a result.'
        : 'The agent returned an empty response.';
    throw new AgentContractError(reason, bodyText);
  }

  return { result: parseResultJson(text), responseId: envelope.id };
}
