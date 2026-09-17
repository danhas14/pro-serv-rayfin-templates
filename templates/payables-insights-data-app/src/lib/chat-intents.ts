import type { VisualizationSpec } from "@microsoft/fabric-visuals";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import {
    formatCompactCurrency,
    formatCount,
    formatDecimal,
    formatHours,
    formatRate,
} from "@/lib/format";
import { customerHealth } from "@/queries/payables/customer-health";
import { exceptionCategories } from "@/queries/payables/exception-categories";
import { exceptionFlow } from "@/queries/payables/exception-flow";
import { payablesKpis } from "@/queries/payables/kpis";
import { methodMix } from "@/queries/payables/method-mix";
import { paymentTrend } from "@/queries/payables/payment-trend";
import { slaByPriority } from "@/queries/payables/sla-by-priority";
import { vendorRisk } from "@/queries/payables/vendor-risk";

export interface ResolvedIntent {
    id: string;
    /** Headline shown above the answer. */
    title: string;
    connection: string;
    query: string;
    columnMetadata: ColumnMetadataMap;
    /** Omit to render a grid. */
    vegaLiteSpec?: VisualizationSpec;
    /** Builds the plain-language answer once the query returns. */
    narrate: (table: DataTable) => string;
    height: number;
}

interface Intent {
    id: string;
    /** Keywords scored against the question. */
    keywords: string[];
    /** Shown as a suggested prompt. */
    prompt: string;
    resolve: (windowDays: number) => ResolvedIntent;
}

/** Reads a cell from the first row by cleaned column name. */
function cell(table: DataTable, name: string): unknown {
    const index = table.columns.findIndex((column) => column.name === name);
    if (index < 0) return undefined;
    return table.rows[0]?.[index];
}

function num(table: DataTable, name: string): number | undefined {
    const value = cell(table, name);
    return typeof value === "number" ? value : undefined;
}

/** Reads a whole column, newest row first. */
function column(table: DataTable, name: string): unknown[] {
    const index = table.columns.findIndex((c) => c.name === name);
    if (index < 0) return [];
    return table.rows.map((row) => row[index]);
}

const INTENTS: Intent[] = [
    {
        id: "payment-volume",
        prompt: "How much did we pay out, and how many payments?",
        keywords: [
            "how much", "payment value", "volume", "total", "paid", "spend",
            "payments", "throughput", "value",
        ],
        resolve: (windowDays) => {
            const q = payablesKpis({ days: windowDays });
            return {
                id: "payment-volume",
                title: "Payment volume",
                height: 0,
                ...q,
                narrate: (table) => {
                    const value = num(table, "PaymentValue");
                    const count = num(table, "PaymentCount");
                    const success = num(table, "SuccessRate");
                    const perDay = count != null ? count / windowDays : undefined;
                    return `Over the last ${windowDays} days you processed ${formatCompactCurrency(value)} across ${formatCount(count)} payments — about ${formatDecimal(perDay)} a day. ${formatRate(success)} of them settled or are still settling.`;
                },
            };
        },
    },
    {
        id: "stp",
        prompt: "Which payment method has the best straight-through rate?",
        keywords: [
            "straight-through", "straight through", "stp", "manual", "touch",
            "automation", "automated", "efficiency", "method", "rail",
        ],
        resolve: (windowDays) => {
            const q = methodMix({ days: windowDays });
            return {
                id: "stp",
                title: "Straight-through processing by rail",
                height: 260,
                ...q,
                narrate: (table) => {
                    const methods = column(table, "PaymentMethod") as string[];
                    const rates = column(table, "StpRate") as number[];
                    const hours = column(table, "AvgHours") as number[];
                    if (methods.length === 0) return "No payments in this window.";
                    let bestIndex = 0;
                    let worstIndex = 0;
                    rates.forEach((rate, index) => {
                        if (rate > rates[bestIndex]) bestIndex = index;
                        if (rate < rates[worstIndex]) worstIndex = index;
                    });
                    return `${methods[bestIndex]} has the strongest straight-through rate at ${formatRate(rates[bestIndex])}, settling in about ${formatHours(hours[bestIndex])}. ${methods[worstIndex]} is weakest at ${formatRate(rates[worstIndex])} and takes ${formatHours(hours[worstIndex])} — that rail is where the manual effort concentrates.`;
                },
            };
        },
    },
    {
        id: "backlog",
        prompt: "What is the exception backlog made of?",
        keywords: [
            "backlog", "exception", "exceptions", "category", "categories",
            "queue", "open", "outstanding", "made of", "breakdown",
        ],
        resolve: () => {
            const q = exceptionCategories();
            return {
                id: "backlog",
                title: "Open exceptions by category",
                height: 300,
                ...q,
                narrate: (table) => {
                    const names = column(table, "CategoryName") as string[];
                    const open = column(table, "OpenExceptions") as number[];
                    const breached = column(table, "Breached") as number[];
                    const risk = column(table, "ValueAtRisk") as number[];
                    if (names.length === 0) return "The exception queue is empty.";
                    const total = open.reduce((sum, value) => sum + (value ?? 0), 0);
                    return `There are ${formatCount(total)} open exceptions. The largest group is "${names[0]}" with ${formatCount(open[0])} open, of which ${formatCount(breached[0])} are already past target, holding ${formatCompactCurrency(risk[0])} of payment value.`;
                },
            };
        },
    },
    {
        id: "vendors",
        prompt: "Which vendors cause the most exceptions?",
        keywords: [
            "vendor", "vendors", "supplier", "suppliers", "worst", "problem",
            "failing", "bank details", "cause",
        ],
        resolve: () => {
            const q = vendorRisk();
            return {
                id: "vendors",
                title: "Vendors generating the most exceptions",
                height: 320,
                ...q,
                narrate: (table) => {
                    const names = column(table, "VendorName") as string[];
                    const created = column(table, "Created") as number[];
                    const details = column(table, "BankDetails") as string[];
                    const success = column(table, "SuccessRate") as number[];
                    if (names.length === 0) return "No vendor has raised an exception.";
                    const bad = names
                        .map((name, index) => ({ name, details: details[index] }))
                        .filter((row) => row.details !== "verified")
                        .slice(0, 3);
                    const detailNote = bad.length
                        ? ` ${bad.map((row) => `${row.name} (${row.details})`).join(", ")} all have unverified payment instructions, which is the common thread.`
                        : "";
                    return `${names[0]} tops the list with ${formatCount(created[0])} exceptions and a ${formatRate(success[0])} payment success rate.${detailNote}`;
                },
            };
        },
    },
    {
        id: "customers",
        prompt: "Who are our largest customers and how healthy are they?",
        keywords: [
            "customer", "customers", "client", "clients", "largest", "biggest",
            "health", "approval", "account",
        ],
        resolve: () => {
            const q = customerHealth();
            return {
                id: "customers",
                title: "Largest customers by payment value",
                height: 320,
                ...q,
                narrate: (table) => {
                    const names = column(table, "CustomerName") as string[];
                    const value = column(table, "PaymentValue") as number[];
                    const approval = column(table, "AvgApprovalHours") as number[];
                    if (names.length === 0) return "No customer activity in the model.";
                    let slowest = 0;
                    approval.forEach((hours, index) => {
                        if ((hours ?? 0) > (approval[slowest] ?? 0)) slowest = index;
                    });
                    return `${names[0]} is the largest at ${formatCompactCurrency(value[0])}. The slowest approver in this group is ${names[slowest]} at ${formatHours(approval[slowest])} per invoice — that delay is what pushes work into the exception queue.`;
                },
            };
        },
    },
    {
        id: "sla",
        prompt: "How are we tracking against service-level targets?",
        keywords: [
            "sla", "service level", "service-level", "target", "breach",
            "breached", "late", "overdue", "attainment", "priority",
        ],
        resolve: () => {
            const q = slaByPriority();
            return {
                id: "sla",
                title: "Service-level attainment by priority",
                height: 280,
                ...q,
                narrate: (table) => {
                    const priorities = column(table, "Priority") as string[];
                    const open = column(table, "OpenExceptions") as number[];
                    const breached = column(table, "Breached") as number[];
                    if (priorities.length === 0) return "Nothing is open against a target.";
                    const totalOpen = open.reduce((sum, value) => sum + (value ?? 0), 0);
                    const totalBreached = breached.reduce((sum, value) => sum + (value ?? 0), 0);
                    let worst = 0;
                    breached.forEach((value, index) => {
                        if ((value ?? 0) > (breached[worst] ?? 0)) worst = index;
                    });
                    return `${formatCount(totalBreached)} of ${formatCount(totalOpen)} open exceptions are past target — attainment of ${formatRate(1 - totalBreached / Math.max(1, totalOpen))}. The worst band is ${priorities[worst]} with ${formatCount(breached[worst])} breached.`;
                },
            };
        },
    },
    {
        id: "rebate",
        prompt: "How much virtual-card rebate are we leaving on the table?",
        keywords: [
            "rebate", "card", "virtual card", "enrolment", "enrollment",
            "money", "leaving", "opportunity", "savings",
        ],
        resolve: (windowDays) => {
            const q = payablesKpis({ days: windowDays });
            return {
                id: "rebate",
                title: "Virtual-card rebate opportunity",
                height: 0,
                ...q,
                narrate: (table) => {
                    const rebate = num(table, "RebateOpportunity");
                    const adoption = num(table, "CardAdoption");
                    const annualised = rebate != null ? (rebate / windowDays) * 365 : undefined;
                    return `Card adoption is ${formatRate(adoption)}. Card-eligible spend currently on other rails represents ${formatCompactCurrency(rebate)} of rebate over ${windowDays} days — roughly ${formatCompactCurrency(annualised)} annualised at the configured 1.35% rate.`;
                },
            };
        },
    },
    {
        id: "trend",
        prompt: "Show me the payment trend over time",
        keywords: ["trend", "over time", "daily", "chart", "history", "timeline", "growth"],
        resolve: (windowDays) => {
            const q = paymentTrend({ days: windowDays });
            return {
                id: "trend",
                title: "Daily payment value",
                height: 280,
                ...q,
                narrate: (table) => {
                    const values = column(table, "PaymentValue") as number[];
                    const clean = values.filter((v): v is number => typeof v === "number");
                    if (clean.length === 0) return "No payments in this window.";
                    const half = Math.floor(clean.length / 2);
                    const first = clean.slice(0, half).reduce((a, b) => a + b, 0) / Math.max(1, half);
                    const second = clean.slice(half).reduce((a, b) => a + b, 0) / Math.max(1, clean.length - half);
                    const direction = second >= first ? "up" : "down";
                    const delta = first > 0 ? Math.abs((second - first) / first) * 100 : 0;
                    return `Daily payment value averaged ${formatCompactCurrency(second)} in the most recent half of the window, ${direction} ${delta.toFixed(0)}% on the first half (${formatCompactCurrency(first)}).`;
                },
            };
        },
    },
    {
        id: "flow",
        prompt: "Are we resolving exceptions faster than they arrive?",
        keywords: [
            "arrive", "arrivals", "resolving", "resolved", "keeping up",
            "faster", "created", "flow", "capacity", "growing",
        ],
        resolve: (windowDays) => {
            const q = exceptionFlow({ days: windowDays });
            return {
                id: "flow",
                title: "Exceptions created versus resolved",
                height: 280,
                ...q,
                narrate: (table) => {
                    const created = (column(table, "Created") as number[]).filter(
                        (v): v is number => typeof v === "number",
                    );
                    const resolved = (column(table, "Resolved") as number[]).filter(
                        (v): v is number => typeof v === "number",
                    );
                    const totalCreated = created.reduce((a, b) => a + b, 0);
                    const totalResolved = resolved.reduce((a, b) => a + b, 0);
                    const gap = totalCreated - totalResolved;
                    if (gap > 0) {
                        return `No — ${formatCount(totalCreated)} exceptions arrived and only ${formatCount(totalResolved)} were resolved, so the backlog grew by ${formatCount(gap)} over ${windowDays} days. At that rate the desk needs roughly ${formatDecimal(gap / windowDays)} more resolutions a day just to hold steady.`;
                    }
                    return `Yes — ${formatCount(totalResolved)} resolved against ${formatCount(totalCreated)} arrivals, reducing the backlog by ${formatCount(-gap)} over ${windowDays} days.`;
                },
            };
        },
    },
];

export const SUGGESTED_PROMPTS = INTENTS.map((intent) => intent.prompt);

/**
 * Rule-based intent matching.
 *
 * Deliberately not a language model: each question is scored against a keyword
 * catalogue and mapped to a real DAX query, so an answer is either grounded in
 * the semantic model or explicitly declined.
 */
export function matchIntent(question: string, windowDays: number): ResolvedIntent | null {
    const text = question.toLowerCase();
    if (text.trim().length === 0) return null;

    let best: { intent: Intent; score: number } | null = null;

    for (const intent of INTENTS) {
        let score = 0;
        for (const keyword of intent.keywords) {
            if (text.includes(keyword)) score += keyword.includes(" ") ? 3 : 1;
        }
        if (score > 0 && (!best || score > best.score)) best = { intent, score };
    }

    return best ? best.intent.resolve(windowDays) : null;
}
