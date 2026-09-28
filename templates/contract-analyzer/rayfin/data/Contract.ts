import { authenticated, date, entity, int, text, uuid } from '@microsoft/rayfin-core';

/**
 * One analyzed contract.
 *
 * Holds both halves of what the app produces:
 *
 * - the **uploaded document itself** (`content_base64`), so the original is
 *   recoverable without depending on the user's local copy, and
 * - the **Content Understanding response** (`fields_json` / `result_json` /
 *   `markdown`), which is what the Q&A panel is grounded in.
 *
 * Row-level security scopes every row to the user who created it: `owner_id`
 * holds the Entra subject claim (`claims.sub`) captured at insert time, and the
 * policy below means a user can only ever read or mutate their own contracts,
 * enforced in the database rather than in the UI.
 *
 * Note on column types: `owner_id` is an auth claim, not a foreign key, so it
 * is `@text()` rather than `@uuid()`. The large payload columns deliberately
 * omit `max` — that maps to `NVARCHAR(MAX)` on the Fabric SQL database, which
 * is required because a base64 PDF and a full analyzer result both blow past
 * the 4000-character `NVARCHAR(n)` ceiling. Neither column is uniquely
 * indexed, which is the one thing `NVARCHAR(MAX)` cannot support.
 */
@entity()
@authenticated('read', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated(['create', 'update', 'delete'], {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class Contract {
  @uuid()
  id!: string;

  /** Entra subject claim of the uploader. Set from `claims.sub` on create. */
  @text({ max: 128 })
  owner_id!: string;

  @text({ max: 400 })
  file_name!: string;

  @text({ max: 200 })
  content_type!: string;

  /** Byte length of the uploaded document. Zero for URL-sourced contracts. */
  @int()
  size_bytes!: number;

  /** Set when the contract was analyzed from a reference URL instead of a file. */
  @text({ optional: true, max: 2048 })
  source_url?: string;

  /** The Content Understanding analyzer that produced the extraction. */
  @text({ max: 64 })
  analyzer_id!: string;

  /** Terminal analyzer status, e.g. `Succeeded`. */
  @text({ max: 32 })
  status!: string;

  /**
   * Content Understanding polling URL for an in-flight analysis.
   *
   * Set while `status` is `Processing`; the browser calls `poll_contract`,
   * which reads this and checks the analysis. Analysis of a large contract can
   * take longer than a single Fabric function is allowed to run (240 s), so the
   * work is split: `analyze_contract` starts it and stores this URL, and
   * `poll_contract` finalizes the row once the service is done.
   */
  @text({ optional: true, max: 2048 })
  operation_url?: string;

  /** The uploaded document, base64 encoded. Empty for URL-sourced contracts. NVARCHAR(MAX). */
  @text()
  content_base64!: string;

  /** Flattened `{ fieldName: value | { value, confidence } }` map. NVARCHAR(MAX). */
  @text()
  fields_json!: string;

  /** Trimmed analyzer result — the grounding context for Q&A. NVARCHAR(MAX). */
  @text({ optional: true })
  result_json?: string;

  /** Markdown rendering of the document produced by the analyzer. NVARCHAR(MAX). */
  @text({ optional: true })
  markdown?: string;

  @date()
  created_at!: Date;
}
