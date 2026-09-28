import { useState, type FormEvent } from 'react';

import type { QaTurn } from '@/types/contract';

interface ContractQaPanelProps {
  /** Null until a contract is analyzed or selected. Disables the form. */
  contractId: string | null;
  turns: QaTurn[];
  onAsk: (question: string) => Promise<void>;
}

export function ContractQaPanel({
  contractId,
  turns,
  onAsk,
}: ContractQaPanelProps) {
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  const canAsk = Boolean(contractId) && !asking && question.trim().length > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canAsk) return;

    const pending = question.trim();
    setQuestion('');
    setAsking(true);
    try {
      await onAsk(pending);
    } finally {
      setAsking(false);
    }
  };

  return (
    <section className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-6 lg:min-h-0">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold text-white">Contract Q&amp;A</h2>
        <p className="mt-1 text-sm text-slate-400">
          Ask questions grounded strictly in the extracted contract JSON.
        </p>
      </div>

      {/* Only this area scrolls, so the question box below stays on screen no
          matter how long the conversation gets. */}
      <div className="mt-4 min-h-64 flex-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-4 lg:min-h-0">
        {turns.length === 0 ? (
          <p className="text-sm text-slate-500">
            {contractId
              ? 'No questions yet. Ask about terms, dates, obligations, or parties.'
              : 'Analyze or select a contract first.'}
          </p>
        ) : (
          <ol className="space-y-4">
            {turns.map((turn) => (
              <li key={turn.id}>
                <p className="text-sm font-medium text-teal-300">
                  {turn.question}
                </p>
                {turn.pending && (
                  <p className="mt-1 text-sm text-slate-500">Thinking...</p>
                )}
                {turn.error && (
                  <p className="mt-1 text-sm text-red-400">{turn.error}</p>
                )}
                {turn.answer && (
                  <p className="mt-1 text-sm whitespace-pre-wrap text-slate-200">
                    {turn.answer}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex shrink-0 gap-2">
        <label htmlFor="contract-question" className="sr-only">
          Question about this contract
        </label>
        <input
          id="contract-question"
          type="text"
          maxLength={2000}
          placeholder="Ask a question about this contract..."
          value={question}
          disabled={!contractId || asking}
          onChange={(e) => setQuestion(e.target.value)}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canAsk}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {asking ? '...' : 'Ask'}
        </button>
      </form>
    </section>
  );
}
