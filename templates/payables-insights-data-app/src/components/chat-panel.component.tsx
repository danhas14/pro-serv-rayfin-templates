import { VegaVisual, useCssTheme } from "@microsoft/fabric-visuals";
import { DataGrid } from "@microsoft/fabric-datagrid";
import { Code2, Info, Send, Sparkles, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PanelError, PanelSkeleton } from "@/components/panel.component";
import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";
import { toDataTable } from "@/lib/to-data-table";
import { matchIntent, SUGGESTED_PROMPTS, type ResolvedIntent } from "@/lib/chat-intents";

interface Turn {
    id: number;
    question: string;
    intent: ResolvedIntent | null;
}

/** Runs the matched intent's DAX and renders the grounded answer. */
function Answer({ intent }: { intent: ResolvedIntent }) {
    const theme = useCssTheme();
    const [showQuery, setShowQuery] = useState(false);
    const { data, isLoading, error } = useSemanticModelQuery({
        connection: intent.connection,
        query: intent.query,
    });

    if (isLoading) return <PanelSkeleton height={120} />;
    if (error) return <PanelError message={error.message} />;
    if (data?.status === "error") return <PanelError message={data.error.message} />;
    if (data?.status !== "success") return <PanelSkeleton height={120} />;

    const table = toDataTable(data.table, intent.columnMetadata);

    return (
        <div className="flex flex-col gap-400">
            <p className="text-[length:var(--text-300)] leading-300 text-card-foreground">
                {intent.narrate(table)}
            </p>

            {intent.height > 0 && table.rows.length > 0 ? (
                intent.vegaLiteSpec ? (
                    <VegaVisual
                        spec={intent.vegaLiteSpec}
                        data={table}
                        theme={theme}
                        style={{ height: intent.height }}
                    />
                ) : (
                    <div style={{ height: intent.height }}>
                        <DataGrid data={table} theme={theme} />
                    </div>
                )
            ) : null}

            <div>
                <button
                    type="button"
                    onClick={() => setShowQuery((value) => !value)}
                    className="inline-flex items-center gap-200 rounded-full border border-border px-400 py-200-nudge text-[length:var(--text-100)] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-expanded={showQuery}
                >
                    <Code2 className="icon-size-100" aria-hidden="true" />
                    {showQuery ? "Hide the DAX" : "Show the DAX behind this answer"}
                </button>
                {showQuery ? (
                    <pre className="mt-300 max-h-[220px] overflow-auto rounded-xl border border-border bg-muted p-400 text-[length:var(--text-100)] leading-200 text-muted-foreground">
                        <code>{intent.query.trim()}</code>
                    </pre>
                ) : null}
            </div>
        </div>
    );
}

/**
 * Chat-style question box over the semantic model.
 *
 * Question interpretation is a keyword catalogue rather than a language model,
 * so every answer either runs a real DAX query or says it cannot answer. The
 * banner says so explicitly — this is a simulation of the interaction, not of
 * the data.
 */
export function ChatPanel({ windowDays }: { windowDays: number }) {
    const [draft, setDraft] = useState("");
    const [turns, setTurns] = useState<Turn[]>([]);
    const nextId = useRef(1);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [turns]);

    function ask(question: string) {
        const trimmed = question.trim();
        if (!trimmed) return;
        setTurns((current) => [
            ...current,
            { id: nextId.current++, question: trimmed, intent: matchIntent(trimmed, windowDays) },
        ]);
        setDraft("");
    }

    return (
        <div className="flex flex-col gap-500">
            <div className="flex items-start gap-300 rounded-2xl border border-border bg-accent/40 p-400 text-[length:var(--text-200)] leading-300 text-muted-foreground">
                <Info className="icon-size-200 shrink-0 text-primary" aria-hidden="true" />
                <p>
                    <span className="font-semibold text-card-foreground">
                        Simulated question answering.
                    </span>{" "}
                    Questions are matched to a fixed catalogue of intents by keyword — there is no
                    language model here. Every answer runs a real DAX query against the Payables
                    Pulse semantic model, and you can inspect the query behind each one.
                </p>
            </div>

            <div className="flex flex-col gap-400">
                {turns.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-500">
                        <p className="text-[length:var(--text-200)] text-muted-foreground">
                            Try one of these:
                        </p>
                        <div className="mt-400 flex flex-wrap gap-300">
                            {SUGGESTED_PROMPTS.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    onClick={() => ask(prompt)}
                                    className="rounded-full border border-border bg-card px-400 py-200-nudge text-left text-[length:var(--text-200)] text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}

                {turns.map((turn) => (
                    <div key={turn.id} className="flex flex-col gap-300">
                        <div className="flex items-start gap-300 self-end rounded-2xl bg-primary px-500 py-400 text-primary-foreground">
                            <span className="text-[length:var(--text-300)] leading-300">
                                {turn.question}
                            </span>
                            <User className="icon-size-200 shrink-0 opacity-70" aria-hidden="true" />
                        </div>

                        <div className="flex items-start gap-300 rounded-2xl border border-border bg-card p-500">
                            <span className="inline-flex icon-size-400 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                                <Sparkles className="icon-size-200" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                                {turn.intent ? (
                                    <>
                                        <h3 className="mb-300 font-heading text-[length:var(--text-300)] font-semibold text-card-foreground">
                                            {turn.intent.title}
                                        </h3>
                                        <Answer intent={turn.intent} />
                                    </>
                                ) : (
                                    <div className="flex flex-col gap-300">
                                        <p className="text-[length:var(--text-300)] leading-300 text-card-foreground">
                                            I can&apos;t answer that one. Intent matching here is a
                                            fixed keyword catalogue, so I only answer questions I
                                            have a query for.
                                        </p>
                                        <div className="flex flex-wrap gap-200">
                                            {SUGGESTED_PROMPTS.slice(0, 4).map((prompt) => (
                                                <button
                                                    key={prompt}
                                                    type="button"
                                                    onClick={() => ask(prompt)}
                                                    className="rounded-full border border-border px-400 py-200-nudge text-[length:var(--text-100)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                                >
                                                    {prompt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    ask(draft);
                }}
                className="flex items-center gap-300 rounded-2xl border border-border bg-card p-300"
            >
                <label htmlFor="chat-input" className="sr-only">
                    Ask a question about payment operations
                </label>
                <input
                    id="chat-input"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Ask about volume, exceptions, vendors, service levels or rebate…"
                    className="min-w-0 flex-1 bg-transparent px-300 py-200 text-[length:var(--text-300)] text-card-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="inline-flex items-center gap-200 rounded-full bg-primary px-500 py-300 text-[length:var(--text-200)] font-semibold text-primary-foreground transition-opacity disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                    <Send className="icon-size-100" aria-hidden="true" />
                    Ask
                </button>
            </form>
        </div>
    );
}
