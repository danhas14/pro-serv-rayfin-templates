import {
  isConfidenceValue,
  type ExtractedField,
  type ExtractedFields,
} from '@/types/contract';
import type { ContractDetail } from '@/services/contractStore';

interface ExtractedFieldsPanelProps {
  contract: ContractDetail | null;
  loading: boolean;
}

/**
 * Render one extracted field as display text.
 *
 * Everything here goes through React text nodes — never `dangerouslySetInnerHTML`
 * — because the values come from an uploaded document and must be treated as
 * untrusted content.
 */
function renderValue(field: ExtractedField): string {
  if (field === null || field === undefined) return '—';
  if (typeof field === 'string') return field || '—';
  if (typeof field === 'number' || typeof field === 'boolean') {
    return String(field);
  }
  if (Array.isArray(field)) {
    return field.length === 0
      ? '—'
      : field.map((item) => renderValue(item)).join('; ');
  }
  if (isConfidenceValue(field)) {
    const value = field.value;
    if (value === null || value === undefined || value === '') {
      return `no value, confidence: ${field.confidence}`;
    }
    return `${String(value)} (confidence: ${field.confidence})`;
  }
  const entries = Object.entries(field);
  if (entries.length === 0) return '—';
  return entries
    .map(([key, nested]) => `${key}: ${renderValue(nested)}`)
    .join('; ');
}

function fieldRows(fields: ExtractedFields) {
  return Object.entries(fields).map(([name, value]) => ({
    name,
    display: renderValue(value),
  }));
}

export function ExtractedFieldsPanel({
  contract,
  loading,
}: ExtractedFieldsPanelProps) {
  return (
    <section className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-6 lg:min-h-0">
      <h2 className="shrink-0 text-lg font-semibold text-white">
        Extracted Fields
      </h2>

      {loading && (
        <p className="mt-4 text-sm text-slate-400">Loading contract...</p>
      )}

      {!loading && !contract && (
        <p className="mt-4 text-sm text-slate-500">
          Analyze a contract, or pick one from the saved list, to see what the
          analyzer extracted.
        </p>
      )}

      {!loading && contract && (
        <>
          <dl className="mt-4 grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <dt className="text-xs tracking-wider text-slate-500 uppercase">
                Contract ID
              </dt>
              <dd className="mt-1 font-mono text-sm break-all text-slate-200">
                {contract.id}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <dt className="text-xs tracking-wider text-slate-500 uppercase">
                Created by
              </dt>
              <dd className="mt-1 font-mono text-sm break-all text-slate-200">
                {contract.owner_id}
              </dd>
            </div>
          </dl>

          {/* The scrolling region. A long contract can produce dozens of
              fields; keeping them here means the panel never grows the page. */}
          <div className="mt-4 overflow-y-auto rounded-lg border border-slate-800 lg:min-h-0 lg:flex-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-800 text-slate-300">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Field
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {fieldRows(contract.fields).map((row, index) => (
                  <tr
                    key={row.name}
                    className={
                      index % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-900/40'
                    }
                  >
                    <th
                      scope="row"
                      className="px-3 py-2 align-top font-normal text-teal-300"
                    >
                      {row.name}
                    </th>
                    <td className="px-3 py-2 align-top break-words text-slate-200">
                      {row.display}
                    </td>
                  </tr>
                ))}
                {Object.keys(contract.fields).length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="bg-slate-950/40 px-3 py-4 text-slate-500"
                    >
                      The analyzer returned no fields for this document.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
