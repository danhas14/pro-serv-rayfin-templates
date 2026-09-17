import { useState } from "react";
import { BarChart3, MessageSquare, Moon, SlidersHorizontal, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useThemeContext } from "@/hooks/theme.context";
import { ChatPanel } from "@/components/chat-panel.component";
import { KpiBand } from "@/components/kpi-band.component";
import { QueryPanel } from "@/components/query-panel.component";
import { WhatIfPanel } from "@/components/what-if.component";
import { customerHealth } from "@/queries/payables/customer-health";
import { exceptionCategories } from "@/queries/payables/exception-categories";
import { exceptionFlow } from "@/queries/payables/exception-flow";
import { methodMix } from "@/queries/payables/method-mix";
import { paymentTrend } from "@/queries/payables/payment-trend";
import { slaByPriority } from "@/queries/payables/sla-by-priority";
import { vendorRisk } from "@/queries/payables/vendor-risk";

type View = "overview" | "ask" | "whatif";

const VIEWS: { id: View; label: string; icon: LucideIcon }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "ask", label: "Ask the data", icon: MessageSquare },
    { id: "whatif", label: "What-if", icon: SlidersHorizontal },
];

const WINDOWS = [30, 60, 90];

function Overview({ windowDays }: { windowDays: number }) {
    return (
        <div className="flex flex-col gap-500">
            <KpiBand windowDays={windowDays} />

            <div className="grid grid-cols-1 gap-400 xl:grid-cols-3">
                <QueryPanel
                    className="xl:col-span-2"
                    eyebrow="Throughput"
                    title="Daily payment value"
                    description={`Value initiated each day over the last ${windowDays} days.`}
                    height={300}
                    {...paymentTrend({ days: windowDays })}
                />
                <QueryPanel
                    eyebrow="Rails"
                    title="Value by payment method"
                    description="Where the money moves."
                    height={300}
                    {...methodMix({ days: windowDays })}
                />
            </div>

            <div className="grid grid-cols-1 gap-400 xl:grid-cols-3">
                <QueryPanel
                    className="xl:col-span-2"
                    eyebrow="Exception desk"
                    title="Created versus resolved"
                    description="A resolved line below the created line means the backlog is growing."
                    height={300}
                    {...exceptionFlow({ days: windowDays })}
                />
                <QueryPanel
                    eyebrow="Service levels"
                    title="Attainment by priority"
                    description="Open exceptions split by service-level state."
                    height={300}
                    {...slaByPriority()}
                />
            </div>

            <div className="grid grid-cols-1 gap-400 xl:grid-cols-3">
                <QueryPanel
                    eyebrow="Backlog"
                    title="Open exceptions by category"
                    description="Where the queue is concentrated."
                    height={340}
                    {...exceptionCategories()}
                />
                <QueryPanel
                    eyebrow="Vendors"
                    title="Exception leaders"
                    description="Vendors generating the most exceptions."
                    height={340}
                    {...vendorRisk()}
                />
                <QueryPanel
                    eyebrow="Customers"
                    title="Largest by payment value"
                    description="Volume against operating quality."
                    height={340}
                    {...customerHealth()}
                />
            </div>
        </div>
    );
}

function App() {
    const { isDark, toggleTheme } = useThemeContext();
    const [view, setView] = useState<View>("overview");
    const [windowDays, setWindowDays] = useState(90);

    return (
        <div className="min-h-full bg-background">
            <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-600 px-500 py-600">
                <header className="flex flex-col gap-500 border-b border-border pb-500 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-col gap-200">
                        <span className="font-base text-[length:var(--text-100)] font-semibold uppercase tracking-[0.18em] text-primary">
                            Payables Pulse
                        </span>
                        <h1 className="font-heading text-[length:var(--text-hero-700)] font-bold leading-hero-700 text-foreground">
                            Payment Operations Insights
                        </h1>
                        <p className="max-w-[62ch] text-[length:var(--text-300)] leading-300 text-muted-foreground">
                            Reporting, question answering and scenario planning over the Payables
                            Pulse semantic model. All figures come from synthetic demonstration
                            data.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-400">
                        {view !== "ask" ? (
                            <div className="flex flex-col gap-200">
                                <span className="text-[length:var(--text-100)] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                    Window
                                </span>
                                <div className="flex rounded-full border border-border p-100">
                                    {WINDOWS.map((days) => (
                                        <button
                                            key={days}
                                            type="button"
                                            onClick={() => setWindowDays(days)}
                                            aria-pressed={windowDays === days}
                                            className={
                                                windowDays === days
                                                    ? "rounded-full bg-primary px-400 py-200-nudge text-[length:var(--text-200)] font-semibold text-primary-foreground"
                                                    : "rounded-full px-400 py-200-nudge text-[length:var(--text-200)] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                                            }
                                        >
                                            {days}d
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <button
                            type="button"
                            onClick={toggleTheme}
                            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                            className="inline-flex items-center gap-200 rounded-full border border-border bg-card px-400 py-200-nudge text-[length:var(--text-200)] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                            {isDark ? (
                                <Sun className="icon-size-200" aria-hidden="true" />
                            ) : (
                                <Moon className="icon-size-200" aria-hidden="true" />
                            )}
                            {isDark ? "Light" : "Dark"}
                        </button>
                    </div>
                </header>

                <nav aria-label="Views" className="flex flex-wrap gap-200">
                    {VIEWS.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            onClick={() => setView(entry.id)}
                            aria-current={view === entry.id ? "page" : undefined}
                            className={
                                view === entry.id
                                    ? "inline-flex items-center gap-200 rounded-full bg-primary px-500 py-300 text-[length:var(--text-200)] font-semibold text-primary-foreground"
                                    : "inline-flex items-center gap-200 rounded-full border border-border px-500 py-300 text-[length:var(--text-200)] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            }
                        >
                            <entry.icon className="icon-size-200" aria-hidden="true" />
                            {entry.label}
                        </button>
                    ))}
                </nav>

                <main>
                    {view === "overview" ? <Overview windowDays={windowDays} /> : null}
                    {view === "ask" ? <ChatPanel windowDays={windowDays} /> : null}
                    {view === "whatif" ? <WhatIfPanel windowDays={windowDays} /> : null}
                </main>
            </div>
        </div>
    );
}

export default App;
