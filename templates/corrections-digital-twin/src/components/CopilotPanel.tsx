import { useEffect, useRef, useState, type FormEvent } from 'react';

import { FACILITY } from '@/data/twin';
import { useTwin } from '@/hooks/TwinContext';
import { cx } from '@/lib/format';
import {
  SUGGESTED_QUESTIONS,
  answerQuestion,
  type AssistantAnswer,
  type AssistantBlock,
  type Tone,
} from '@/lib/copilot';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text?: string;
  answer?: AssistantAnswer;
}

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-haze-100',
  good: 'text-status-normal',
  warn: 'text-status-elevated',
  bad: 'text-status-critical',
};

const WELCOME: AssistantAnswer = {
  headline: `Operations Assistant is grounded on the ${FACILITY.code} semantic model.`,
  blocks: [
    {
      kind: 'text',
      text: 'Ask about inmate populations, incidents, staffing, capacity trends or facility operations. Every answer is computed live from the twin — no figures are pre-written.',
    },
  ],
  focus: [],
  source: 'Operations Assistant',
};

function BlockView({ block }: { block: AssistantBlock }) {
  switch (block.kind) {
    case 'text':
      return (
        <p className="text-[13px] leading-relaxed text-haze-300">{block.text}</p>
      );

    case 'bullets':
      return (
        <ul className="space-y-1.5">
          {block.items.map((item) => (
            <li
              key={item}
              className="flex gap-2 text-[13px] leading-relaxed text-haze-300"
            >
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-fabric-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case 'metrics':
      return (
        <div className="flex flex-wrap gap-2">
          {block.items.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-ink-700 bg-ink-900/70 px-2.5 py-1.5"
            >
              <p className="text-[10px] uppercase tracking-wide text-haze-500">
                {item.label}
              </p>
              <p
                className={cx(
                  'tabular mt-0.5 text-sm font-semibold',
                  TONE_TEXT[item.tone ?? 'neutral']
                )}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      );

    case 'table':
      return (
        <div className="overflow-x-auto rounded-lg border border-ink-700">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-ink-900/80">
                {block.columns.map((column, i) => (
                  <th
                    key={column}
                    className={cx(
                      'px-2.5 py-1.5 font-medium text-haze-500 whitespace-nowrap',
                      i === 0 ? 'text-left' : 'text-right'
                    )}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr
                  key={row.cells.join('|')}
                  className="border-t border-ink-700/70"
                >
                  {row.cells.map((cell, i) => (
                    <td
                      key={`${row.cells[0]}-${i}`}
                      className={cx(
                        'px-2.5 py-1.5 whitespace-nowrap',
                        i === 0 && 'text-left font-medium text-haze-200',
                        i > 0 && 'tabular text-right',
                        i > 0 &&
                          (i === row.cells.length - 1
                            ? TONE_TEXT[row.tone ?? 'neutral']
                            : 'text-haze-300')
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
}

export function CopilotPanel({
  onFocusBuildings,
}: {
  onFocusBuildings: (ids: string[]) => void;
}) {
  const twin = useTwin();
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'assistant', answer: WELCOME },
  ]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, thinking]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || thinking) return;

    setMessages((prev) => [
      ...prev,
      { id: nextId.current++, role: 'user', text: trimmed },
    ]);
    setDraft('');
    setThinking(true);

    // Brief deliberate latency so the assistant reads as a reasoning step
    // rather than an instant lookup.
    const timer = window.setTimeout(() => {
      const answer = answerQuestion(twin, trimmed);
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: 'assistant', answer },
      ]);
      onFocusBuildings(answer.focus);
      setThinking(false);
    }, 480);
    timers.current.push(timer);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(draft);
  };

  return (
    <div className="ops-panel flex h-full min-h-[620px] flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-ink-700/70 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-fabric-500 to-fabric-700 text-white">
            <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
              <path d="M8 1 9.6 5.1 14 6.2l-3.2 3 .8 4.4L8 11.5 4.4 13.6l.8-4.4L2 6.2l4.4-1.1L8 1Z" />
            </svg>
          </span>
          <div>
            <h2 className="text-sm font-semibold text-haze-100">
              Operations Assistant
            </h2>
            <p className="text-xs text-haze-400">
              Grounded on the {FACILITY.code} semantic model
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-800 px-2.5 py-1 text-[11px] text-haze-300">
          <span
            className="size-1.5 rounded-full bg-status-normal"
            style={{ animation: 'ops-pulse 2s ease-in-out infinite' }}
          />
          Online
        </span>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm border border-fabric-500/35 bg-fabric-500/15 px-3.5 py-2 text-[13px] text-haze-100">
                {message.text}
              </p>
            </div>
          ) : (
            <article
              key={message.id}
              className="space-y-2.5"
              style={{ animation: 'ops-rise 220ms ease-out' }}
            >
              <p className="text-[13px] font-semibold text-haze-100">
                {message.answer?.headline}
              </p>
              {message.answer?.blocks.map((block, i) => (
                <BlockView key={i} block={block} />
              ))}
              {message.answer &&
                message.answer.source !== 'Operations Assistant' && (
                  <p className="flex items-center gap-1.5 text-[10px] text-haze-500">
                    <svg viewBox="0 0 16 16" className="size-3" fill="currentColor">
                      <path d="M3 2h7l3 3v9H3V2Zm1 1v10h8V6H9.5V3H4Z" />
                    </svg>
                    {message.answer.source}
                  </p>
                )}
            </article>
          )
        )}

        {thinking && (
          <div className="flex items-center gap-2 text-[13px] text-haze-400">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 rounded-full bg-fabric-400"
                style={{
                  animation: 'ops-pulse 1s ease-in-out infinite',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
            Analysing the twin…
          </div>
        )}
      </div>

      <div className="border-t border-ink-700/70 px-5 py-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((question) => (
            <button
              key={question}
              onClick={() => ask(question)}
              disabled={thinking}
              className="rounded-full border border-ink-600 bg-ink-900/70 px-2.5 py-1 text-[11px] text-haze-400 transition-colors hover:border-fabric-500/40 hover:bg-fabric-500/10 hover:text-fabric-300 disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about population, incidents, staffing or capacity…"
            aria-label="Ask the Operations Assistant"
            className="min-w-0 flex-1 rounded-xl border border-ink-600 bg-ink-950/80 px-3.5 py-2.5 text-[13px] text-haze-100 placeholder:text-haze-500 focus:border-fabric-500/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={thinking || !draft.trim()}
            className="flex size-[42px] shrink-0 items-center justify-center rounded-xl bg-fabric-600 text-white transition-colors hover:bg-fabric-500 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send question"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
              <path d="M1.7 14.3 15 8 1.7 1.7 1.7 6.6 10 8l-8.3 1.4v4.9Z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
