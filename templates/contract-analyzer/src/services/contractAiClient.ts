/**
 * Thin client for the Python Fabric User Data Functions backend.
 *
 * Each function is invoked via its public REST endpoint. The user's Power BI
 * token is sent as the `Authorization` bearer (invocation auth) and an
 * Azure-AI-audience token is sent in the JSON body as `aiToken` so the function
 * can call Content Understanding and the Foundry model *as the signed-in user*.
 * Body keys must match the Python parameter names, which are camelCase.
 *
 * No AI endpoint, analyzer id, model name, or API key appears anywhere in this
 * file — all of that lives server-side in the function.
 *
 * Response envelope (per the UDF REST contract):
 *   { functionName, invocationId, status, output, errors }
 */
import { getUdfConfig } from '@/config/udfConfig';
import type {
  AnalyzedContract,
  ContractAnswer,
  PollResult,
} from '@/types/contract';

import {
  getAiToken,
  getFabricToken,
  getGraphToken,
  SignInRequiredError,
} from './fabricAuth';

/** SharePoint and OneDrive for Business links need a Graph token to read. */
export function isSharePointUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().endsWith('.sharepoint.com');
  } catch {
    return false;
  }
}

interface UdfError {
  errorCode?: string;
  message?: string;
  properties?: {
    error_message?: string;
    error_type?: string;
    [key: string]: unknown;
  };
}

interface UdfEnvelope<T> {
  functionName: string;
  invocationId: string;
  status: string;
  output: T;
  errors?: UdfError[];
}

const GENERIC_FAILURE =
  'The contract service could not complete that request. Please try again.';

/**
 * Log failure detail for developers without showing it to users.
 *
 * Guarded by `import.meta.env.DEV`, which Vite replaces with the literal
 * `false` when building, so nothing is logged in a deployed bundle.
 */
function logDetail(context: string, detail: unknown): void {
  if (import.meta.env.DEV) {
    console.debug(`[contractAi] ${context}`, detail);
  }
}

/**
 * Reduce a UDF failure to one sentence that is safe to render.
 *
 * The function deliberately raises `ValueError`/`RuntimeError` with messages
 * written for end users — upload-size limits, "provide a file or a URL",
 * "try a shorter question". Those arrive in `errors[].properties.error_message`
 * and are worth keeping.
 *
 * Everything wrapping them is not: `functionName`, `invocationId`, `errorCode`,
 * and `error_type` describe internals, and dumping the whole response body —
 * which this used to do — put raw JSON, Python exception names, and upstream
 * service internals straight into the UI. Take the message, drop the envelope.
 */
function userFacingError(errors: UdfError[] | undefined): string {
  const messages = (errors ?? [])
    .map((e) => e.properties?.error_message)
    .filter((m): m is string => typeof m === 'string' && m.trim().length > 0);

  return messages.length > 0 ? messages.join(' ') : GENERIC_FAILURE;
}

async function invoke<T>(
  url: string,
  params: Record<string, unknown>
): Promise<T> {
  const [bearer, aiToken] = await Promise.all([
    getFabricToken(),
    getAiToken(),
  ]);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`, // Power BI token (invocation auth)
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...params, aiToken }), // Azure AI token in body
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new SignInRequiredError();

    // A failed call still usually carries a UDF envelope. Parse it for the
    // user-safe message rather than surfacing the body verbatim.
    const raw = await res.text();
    logDetail(`HTTP ${res.status}`, raw);

    let parsed: UdfEnvelope<unknown> | null = null;
    try {
      parsed = JSON.parse(raw) as UdfEnvelope<unknown>;
    } catch {
      parsed = null;
    }
    throw new Error(userFacingError(parsed?.errors));
  }

  const envelope = (await res.json()) as UdfEnvelope<T>;
  if (envelope.status !== 'Succeeded') {
    logDetail(`status ${envelope.status}`, envelope);
    throw new Error(userFacingError(envelope.errors));
  }
  return envelope.output;
}

export const contractAi = {
  /**
   * Start analyzing an uploaded contract.
   *
   * `contentBase64` must be the raw file bytes, base64 encoded, with no
   * data-URL prefix. The function starts the analysis, saves a `Processing`
   * row, and returns immediately with `status: "Processing"` and a
   * `contractId`. Call `poll(contractId)` until it reports `Succeeded`.
   */
  analyzeFile: (
    ownerId: string,
    fileName: string,
    contentType: string,
    contentBase64: string
  ): Promise<AnalyzedContract> =>
    invoke<AnalyzedContract>(getUdfConfig().urls.analyze, {
      ownerId, // camelCase — matches the Python parameter names
      graphToken: '',
      fileName,
      contentType,
      contentBase64,
      sourceUrl: '',
    }),

  /**
   * Start analyzing a contract from a URL.
   *
   * SharePoint and OneDrive links additionally carry a Graph token, because
   * Content Understanding cannot read them itself — it fetches URLs
   * anonymously and SharePoint answers with a sign-in page. The function
   * hands Content Understanding a pre-authenticated download URL instead. Any
   * other public URL is fetched by Content Understanding directly and needs no
   * Graph token. Returns immediately with `status: "Processing"`; call
   * `poll(contractId)` until it finishes.
   */
  analyzeUrl: async (
    ownerId: string,
    sourceUrl: string
  ): Promise<AnalyzedContract> => {
    // `interactive: true` here is deliberate. Graph is a separate resource from
    // the Power BI and Azure AI tokens warmed at sign-in, so its consent has
    // never been granted when a SharePoint link is first analyzed. A silent
    // acquire would just throw and bounce the user back to the sign-in banner
    // with no popup — which reads as "nothing happens". Requesting interactively
    // from this click gesture surfaces the one-time Graph consent prompt.
    const graphToken = isSharePointUrl(sourceUrl)
      ? await getGraphToken({ interactive: true })
      : '';

    return invoke<AnalyzedContract>(getUdfConfig().urls.analyze, {
      ownerId,
      graphToken,
      fileName: '',
      contentType: '',
      contentBase64: '',
      sourceUrl,
    });
  },

  /**
   * Check on an in-flight analysis started by `analyzeFile` / `analyzeUrl`.
   *
   * Each call is one quick status check. Poll it every few seconds until
   * `status` is `Succeeded` (the row now holds the extracted fields and is
   * ready to read) or `Failed` (see `error`). Splitting the work this way keeps
   * every call short, so a large contract that takes minutes to analyze never
   * trips the 240-second Fabric function limit.
   */
  poll: (contractId: string): Promise<PollResult> =>
    invoke<PollResult>(getUdfConfig().urls.poll, { contractId }),

  /**
   * Ask a question about one stored contract. Only the id travels — the
   * function reads the grounding context straight from the database, so a long
   * contract's analyzer result never passes through the browser.
   */
  ask: (question: string, contractId: string): Promise<ContractAnswer> =>
    invoke<ContractAnswer>(getUdfConfig().urls.ask, {
      question,
      contractId,
    }),
};

/** Read a `File` as base64, stripping the `data:...;base64,` prefix. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error(`Could not read "${file.name}" from disk.`));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error(`Could not read "${file.name}" from disk.`));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
