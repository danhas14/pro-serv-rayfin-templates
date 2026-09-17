import {
    AlertTriangle,
    Banknote,
    Clock,
    Gauge,
    ShieldAlert,
    Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { PanelError } from "@/components/panel.component";
import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";
import { toDataTable } from "@/lib/to-data-table";
import {
    formatCompactCurrency,
    formatCount,
    formatHours,
    formatRate,
} from "@/lib/format";
import { payablesKpis } from "@/queries/payables/kpis";

/** Reads a numeric cell from the first row by cleaned column name. */
export function readNumber(table: DataTable, name: string): number | undefined {
    const index = table.columns.findIndex((column) => column.name === name);
    if (index < 0) return undefined;
    const value = table.rows[0]?.[index];
    return typeof value === "number" ? value : undefined;
}

function StatTile({
    icon: Icon,
    label,
    value,
    caption,
    isLoading,
    tone = "default",
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    caption?: string;
    isLoading: boolean;
    tone?: "default" | "warning";
}) {
    return (
        <div className="flex flex-col justify-between gap-400 rounded-2xl border border-border bg-card p-500">
            <span
                className={
                    tone === "warning"
                        ? "inline-flex icon-size-400 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                        : "inline-flex icon-size-400 items-center justify-center rounded-full bg-accent text-accent-foreground"
                }
            >
                <Icon className="icon-size-200" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-100">
                <span
                    className="font-numeric text-[length:var(--text-600)] font-semibold leading-600 text-card-foreground"
                    aria-busy={isLoading}
                >
                    {isLoading ? "—" : value}
                </span>
                <span className="text-[length:var(--text-200)] leading-200 text-muted-foreground">
                    {label}
                </span>
                {caption ? (
                    <span className="text-[length:var(--text-100)] leading-200 text-muted-foreground">
                        {caption}
                    </span>
                ) : null}
            </div>
        </div>
    );
}

/** Headline operating figures for the selected window. */
export function KpiBand({ windowDays }: { windowDays: number }) {
    const { connection, query, columnMetadata } = payablesKpis({ days: windowDays });
    const { data, isLoading, error } = useSemanticModelQuery({ connection, query });

    if (data?.status === "error") return <PanelError message={data.error.message} />;
    if (error) return <PanelError message={error.message} />;

    const table = data?.status === "success" ? toDataTable(data.table, columnMetadata) : undefined;
    const pending = isLoading || !table;
    const read = (name: string) => (table ? readNumber(table, name) : undefined);

    const paymentValue = read("PaymentValue");
    const paymentCount = read("PaymentCount");
    const stpRate = read("StpRate");
    const openExceptions = read("OpenExceptions");
    const breached = read("SlaBreached");
    const avgResolution = read("AvgResolutionHours");
    const rebate = read("RebateOpportunity");

    return (
        <div className="grid grid-cols-1 gap-400 sm:grid-cols-2 xl:grid-cols-5">
            <div className="flex flex-col justify-between gap-500 rounded-2xl bg-primary p-600 text-primary-foreground sm:col-span-2">
                <span className="font-base text-[length:var(--text-100)] font-semibold uppercase tracking-[0.14em] opacity-80">
                    Payment value
                </span>
                <div className="flex flex-col gap-100">
                    <span
                        className="font-numeric text-[length:var(--text-hero-800)] font-bold leading-hero-800"
                        aria-busy={pending}
                    >
                        {pending ? "—" : formatCompactCurrency(paymentValue)}
                    </span>
                    <span className="text-[length:var(--text-200)] leading-200 opacity-80">
                        {pending
                            ? `Trailing ${windowDays} days`
                            : `${formatCount(paymentCount)} payments over ${windowDays} days`}
                    </span>
                </div>
            </div>

            <StatTile
                icon={Gauge}
                label="Straight-through rate"
                caption="Settled with no manual touch"
                value={formatRate(stpRate)}
                isLoading={pending}
            />
            <StatTile
                icon={AlertTriangle}
                label="Open exceptions"
                caption={`${formatCount(breached)} past their target`}
                value={formatCount(openExceptions)}
                isLoading={pending}
                tone={breached != null && breached > 0 ? "warning" : "default"}
            />
            <StatTile
                icon={Clock}
                label="Average resolution"
                caption="Raised to resolved"
                value={formatHours(avgResolution)}
                isLoading={pending}
            />
            <StatTile
                icon={Banknote}
                label="Payments per day"
                caption="Across every rail"
                value={paymentCount == null ? "—" : formatCount(paymentCount / windowDays)}
                isLoading={pending}
            />
            <StatTile
                icon={Sparkles}
                label="Rebate opportunity"
                caption="Card-eligible spend on other rails"
                value={formatCompactCurrency(rebate)}
                isLoading={pending}
            />
            <StatTile
                icon={ShieldAlert}
                label="Breached exceptions"
                caption="Open and past target"
                value={formatCount(breached)}
                isLoading={pending}
                tone={breached != null && breached > 0 ? "warning" : "default"}
            />
        </div>
    );
}
