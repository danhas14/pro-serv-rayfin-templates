/**
 * Shared types for the analyzer output.
 *
 * These mirror what `fabric-udf/function_app.py` returns after it flattens the
 * Azure AI Content Understanding response. Keeping the shape narrow here means
 * the UI never has to reason about the service's tagged-union field encoding
 * (`valueString` / `valueDate` / `valueObject` / …) — the UDF already did that.
 */

/**
 * Largest file the upload path accepts, in bytes.
 *
 * Must stay in sync with `MAX_UPLOAD_BYTES` in `fabric-udf/function_app.py`.
 * The real ceiling is the Fabric UDF request-body limit (measured: 28 MB
 * accepted, 32 MB refused with HTTP 413), and base64 inflates a file by 4/3 —
 * so ~21 MB is the hard maximum and 20 MB is the safe setting.
 *
 * Checked here as well as server-side because a 413 is raised by the platform
 * before the function runs, so its response carries no usable message. Without
 * this check the user would wait through a long upload only to get a generic
 * failure.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** A leaf value the analyzer extracted, with its confidence when reported. */
export interface ConfidenceValue {
  value: string | number | boolean | null;
  confidence: number;
}

/** One extracted field: a bare value, a value+confidence pair, or a container. */
export type ExtractedField =
  | string
  | number
  | boolean
  | null
  | ConfidenceValue
  | ExtractedField[]
  | { [key: string]: ExtractedField };

export type ExtractedFields = Record<string, ExtractedField>;

/** The trimmed analyzer result, stored server-side as the Q&A grounding context. */
export interface AnalyzerResult {
  operationId: string | null;
  status: string;
  analyzerId: string;
  apiVersion: string;
  mimeType: string | null;
  startPageNumber: number | null;
  endPageNumber: number | null;
  markdown: string;
  fields: ExtractedFields;
  warnings: unknown[];
}

/**
 * What `analyze_contract` returns.
 *
 * Deliberately small, and returned the moment the analysis is *accepted* — not
 * when it finishes. `status` is `"Processing"`; poll `poll_contract` with
 * `contractId` until it reports `"Succeeded"`, then read the extracted fields
 * back through the data API. The function saves the document and the analyzer
 * result to SQL itself, so a long contract never round-trips through the
 * browser.
 */
export interface AnalyzedContract {
  contractId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** Empty unless the contract was analyzed from a document reference URL. */
  sourceUrl: string;
  analyzerId: string;
  status: string;
}

/**
 * What `poll_contract` returns while an analysis is in flight.
 *
 * `status` is `"Processing"` (keep polling), `"Succeeded"` (done — the row now
 * holds the extracted fields), or `"Failed"` (see `error`).
 * `pollIntervalSeconds` is the backend's suggested wait between polls.
 */
export interface PollResult {
  contractId: string;
  status: string;
  pollIntervalSeconds?: number;
  error?: string;
}

/** What `ask_contract` returns. */
export interface ContractAnswer {
  answer: string;
  model: string;
}

/** A single turn in the Q&A panel. Held in component state, not persisted. */
export interface QaTurn {
  id: string;
  question: string;
  answer: string | null;
  error: string | null;
  pending: boolean;
}

/** True when a field carries a confidence score alongside its value. */
export function isConfidenceValue(
  field: ExtractedField
): field is ConfidenceValue {
  return (
    typeof field === 'object' &&
    field !== null &&
    !Array.isArray(field) &&
    'value' in field &&
    'confidence' in field
  );
}
