import { useRef, useState, type FormEvent } from 'react';

import type { ContractSummary } from '@/services/contractStore';
import { MAX_UPLOAD_BYTES } from '@/types/contract';

interface ContractIntakeProps {
  contracts: ContractSummary[];
  selectedId: string | null;
  busy: boolean;
  error: string | null;
  onAnalyzeFile: (file: File) => Promise<void>;
  onAnalyzeUrl: (url: string) => Promise<void>;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

/** Accepted document types, mirroring what the analyzer supports. */
const ACCEPT =
  '.pdf,.docx,.doc,.txt,.md,.html,.htm,.png,.jpg,.jpeg,.tif,.tiff,.bmp';

const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));

export function ContractIntake({
  contracts,
  selectedId,
  busy,
  error,
  onAnalyzeFile,
  onAnalyzeUrl,
  onSelect,
  onDelete,
}: ContractIntakeProps) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [sizeError, setSizeError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const canSubmit =
    !busy && !sizeError && (file !== null || url.trim().length > 0);

  /**
   * Reject an oversized file here rather than letting it fail server-side. The
   * platform returns a bare 413 that carries no message we can show, so the
   * user would otherwise sit through a long upload for a generic error.
   */
  const handleFileChange = (selected: File | null) => {
    setFile(selected);
    if (selected && selected.size > MAX_UPLOAD_BYTES) {
      setSizeError(
        `"${selected.name}" is ${(selected.size / 1048576).toFixed(1)} MB, ` +
          `over the ${MAX_UPLOAD_MB} MB upload limit. Use the document ` +
          `reference URL below instead \u2014 the analyzer fetches the file ` +
          `directly and accepts much larger documents.`
      );
    } else {
      setSizeError(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    if (file) {
      await onAnalyzeFile(file);
    } else {
      await onAnalyzeUrl(url.trim());
    }

    setFile(null);
    setUrl('');
    setSizeError(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <section className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-6 lg:min-h-0">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold text-white">Contract Intake</h2>
        <p className="mt-1 text-sm text-slate-400">
          Upload a PDF/DOCX, run the analyzer, and persist the extracted fields.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 shrink-0 space-y-4">
        <div>
          <label
            htmlFor="contract-file"
            className="block text-sm text-slate-300"
          >
            Contract file{' '}
            <span className="text-slate-500">(up to {MAX_UPLOAD_MB} MB)</span>
          </label>
          <input
            id="contract-file"
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            disabled={busy || url.trim().length > 0}
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-sm file:text-slate-200 disabled:opacity-50"
          />
          {sizeError && (
            <p
              role="alert"
              className="mt-2 rounded-lg border border-amber-900 bg-amber-950/40 px-3 py-2 text-sm text-amber-200"
            >
              {sizeError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="contract-url" className="block text-sm text-slate-300">
            Or document reference URL
          </label>
          <input
            id="contract-url"
            type="url"
            inputMode="url"
            placeholder="https://..."
            value={url}
            disabled={busy || file !== null}
            onChange={(e) => setUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Analyzing...' : 'Analyze and Save'}
        </button>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300"
          >
            {error}
          </p>
        )}
      </form>

      <h3 className="mt-7 shrink-0 text-xs font-semibold tracking-wider text-slate-400 uppercase">
        Saved contracts
      </h3>

      {contracts.length === 0 ? (
        <p className="mt-3 shrink-0 text-sm text-slate-500">
          Nothing saved yet. Analyze a contract to get started.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 overflow-y-auto lg:min-h-0 lg:flex-1">
          {contracts.map((contract) => {
            const isSelected = contract.id === selectedId;
            return (
              <li key={contract.id}>
                <div
                  className={`rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? 'border-teal-600 bg-teal-950/30'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(contract.id)}
                    className="block w-full text-left"
                  >
                    <span className="block truncate text-sm font-medium text-slate-100">
                      {contract.file_name}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {new Date(contract.created_at).toISOString()}
                    </span>
                  </button>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onDelete(contract.id)}
                      disabled={busy}
                      className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-950 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
