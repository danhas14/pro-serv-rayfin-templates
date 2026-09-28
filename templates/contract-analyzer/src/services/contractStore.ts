/**
 * Reading saved contracts.
 *
 * Writes deliberately do NOT happen here. The Rayfin data client builds each
 * GraphQL mutation as a string with the values inlined, and the server rejects
 * any query over 65 536 characters — which caps an uploaded document at roughly
 * 47 KB. The `analyze_contract` User Data Function writes the row instead, with
 * parameterized SQL and no size ceiling. See `fabric-udf/function_app.py`.
 *
 * What is left here is reads, which are safe because the payload travels in the
 * *response*, not the query. Even so, the large columns (`content_base64`,
 * `result_json`, `markdown`) are never selected: the UI does not render the
 * original document, and `ask_contract` loads its own grounding context
 * straight from the database by id.
 *
 * Access control is enforced in the database, not here: the `Contract` entity
 * carries a row-level security policy of `claims.sub == owner_id`, so these
 * queries can only ever see the signed-in user's own rows even though they do
 * not filter on the owner themselves.
 */
import type { Contract } from '../../rayfin/data/Contract';
import type { ExtractedFields } from '@/types/contract';

import { getRayfinClient } from './rayfinClient';

/**
 * Columns safe to select. Excludes `content_base64`, `result_json`, and
 * `markdown` — all of which can run to megabytes on a long contract.
 */
const COLUMNS = [
  'id',
  'owner_id',
  'file_name',
  'content_type',
  'size_bytes',
  'source_url',
  'analyzer_id',
  'status',
  'created_at',
] as const;

/** A saved contract as shown in the list. */
export type ContractSummary = Pick<Contract, (typeof COLUMNS)[number]>;

/** A saved contract plus its flattened extracted fields. */
export interface ContractDetail extends ContractSummary {
  fields: ExtractedFields;
}

/** List the signed-in user's saved contracts, newest first. */
export async function listContracts(): Promise<ContractSummary[]> {
  return getRayfinClient()
    .data.Contract.select([...COLUMNS])
    .orderBy({ created_at: 'desc' })
    .execute();
}

/**
 * Load one contract with its extracted fields.
 *
 * `fields_json` is the flattened `{ name: value | { value, confidence } }` map,
 * which is small — it is the analyzer's *extraction*, not the document text.
 */
export async function getContract(id: string): Promise<ContractDetail | null> {
  const rows = await getRayfinClient()
    .data.Contract.select([...COLUMNS, 'fields_json'])
    .where({ id: { eq: id } })
    .execute();

  const row = rows[0];
  if (!row) return null;

  let fields: ExtractedFields = {};
  try {
    fields = row.fields_json
      ? (JSON.parse(row.fields_json) as ExtractedFields)
      : {};
  } catch {
    fields = {};
  }

  return {
    id: row.id,
    owner_id: row.owner_id,
    file_name: row.file_name,
    content_type: row.content_type,
    size_bytes: row.size_bytes,
    source_url: row.source_url,
    analyzer_id: row.analyzer_id,
    status: row.status,
    created_at: row.created_at,
    fields,
  };
}

/** Delete one saved contract. The RLS policy limits this to the user's own. */
export async function deleteContract(id: string): Promise<void> {
  await getRayfinClient().data.Contract.delete({ id });
}
