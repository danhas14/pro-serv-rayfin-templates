import { useMemo, useState } from "react";
import type { VisualizationSpec } from "@microsoft/fabric-visuals";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import { LocalChartPanel } from "@/components/query-panel.component";
import { Panel, PanelError, PanelSkeleton } from "@/components/panel.component";
import { readNumber } from "@/components/kpi-band.component";
import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";
import { toDataTable } from "@/lib/to-data-table";
import {
    DEFAULT_LEVERS,
    projectForecast,
    type ForecastBasis,
    type ForecastLevers,
} from "@/lib/forecast";
import {
    formatCompactCurrency,
    formatCount,
    formatDecimal,
    formatPointDelta,
} from "@/lib/format";
import { forecastBasis } from "@/queries/payables/forecast-basis";

const BACKLOG_SPEC: VisualizationSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    description: "Projected exception backlog against the current run rate",
    transform: [
        { fold: ["Projected", "Current run rate"], as: ["Scenario", "Backlog"] },
    ],
    mark: { type: "line", strokeWidth: 2 },
    encoding: {
        x: { field: "Day", type: "quantitative", title: "Days from today" },
        y: { field: "Backlog", type: "quantitative", title: "Open exceptions" },
        color: {
            field: "Scenario",
            type: "nominal",
            title: null,
            scale: { domain: ["Current run rate", "Projected"] },
        },
        strokeDash: {
            field: "Scenario",
            type: "nominal",
            legend: null,
            scale: { domain: ["Current run rate", "Projected"], range: [[4, 4], [1, 0]] },
        },
        tooltip: [
            { field: "Day", type: "quantitative", title: "Day" },
            { field: "Scenario", type: "nominal", title: "Scenario" },
            { field: "Backlog", type: "quantitative", title: "Backlog" },
        ],
    },
} as VisualizationSpec;

interface SliderProps {
    label: string;
    hint: string;
    value: number;
    min: number;
    max: number;
    step: number;
    format: (value: number) => string;
    onChange: (value: number) => void;
}

function Slider({ label, hint, value, min, max, step, format, onChange }: SliderProps) {
    const id = `lever-${label.replace(/\s+/g, "-").toLowerCase()}`;
    return (
        <div className="flex flex-col gap-200">
            <div className="flex items-baseline justify-between gap-300">
                <label
                    htmlFor={id}
                    className="text-[length:var(--text-200)] font-semibold text-card-foreground"
                >
                    {label}
                </label>
                <span className="font-numeric text-[length:var(--text-300)] font-semibold text-primary">
                    {format(value)}
                </span>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                className="w-full accent-[var(--color-primary)]"
            />
            <p className="text-[length:var(--text-100)] leading-200 text-muted-foreground">{hint}</p>
        </div>
    );
}

function Outcome({
    label,
    value,
    delta,
    caption,
    improving,
}: {
    label: string;
    value: string;
    delta?: string;
    caption: string;
    improving?: boolean;
}) {
    return (
        <div className="flex flex-col gap-100 rounded-2xl border border-border bg-card p-500">
            <span className="text-[length:var(--text-200)] text-muted-foreground">{label}</span>
            <span className="font-numeric text-[length:var(--text-600)] font-semibold leading-600 text-card-foreground">
                {value}
            </span>
            {delta ? (
                <span
                    className={
                        improving
                            ? "inline-flex items-center gap-100 text-[length:var(--text-200)] font-semibold text-primary"
                            : "inline-flex items-center gap-100 text-[length:var(--text-200)] font-semibold text-destructive"
                    }
                >
                    {improving ? (
                        <TrendingDown className="icon-size-100" aria-hidden="true" />
                    ) : (
                        <TrendingUp className="icon-size-100" aria-hidden="true" />
                    )}
                    {delta}
                </span>
            ) : null}
            <span className="text-[length:var(--text-100)] leading-200 text-muted-foreground">
                {caption}
            </span>
        </div>
    );
}

/**
 * What-if projection over the exception desk.
 *
 * The starting point is measured from the semantic model; the levers and the
 * queue simulation run in the browser, so moving a slider re-projects without
 * another query.
 */
export function WhatIfPanel({ windowDays }: { windowDays: number }) {
    const [levers, setLevers] = useState<ForecastLevers>(DEFAULT_LEVERS);
    const { connection, query, columnMetadata } = forecastBasis({ days: windowDays });
    const { data, isLoading, error } = useSemanticModelQuery({ connection, query });

    const basis: ForecastBasis | undefined = useMemo(() => {
        if (data?.status !== "success") return undefined;
        const table = toDataTable(data.table, columnMetadata);
        const read = (name: string) => readNumber(table, name) ?? 0;
        return {
            windowDays: read("WindowDays") || windowDays,
            openBacklog: read("OpenBacklog"),
            breachedNow: read("BreachedNow"),
            arrivalsPerDay: read("ArrivalsPerDay"),
            resolutionsPerDay: read("ResolutionsPerDay"),
            paymentValuePerDay: read("PaymentValuePerDay"),
            paymentsPerDay: read("PaymentsPerDay"),
            stpRate: read("StpRate"),
            cardAdoption: read("CardAdoption"),
            rebateOpportunity: read("RebateOpportunity"),
            avgResolutionHours: read("AvgResolutionHours"),
            avgExceptionValue: read("AvgExceptionValue"),
        };
    }, [data, columnMetadata, windowDays]);

    const result = useMemo(
        () => (basis ? projectForecast(basis, levers) : undefined),
        [basis, levers],
    );

    if (error) return <PanelError message={error.message} />;
    if (data?.status === "error") return <PanelError message={data.error.message} />;
    if (isLoading || !basis || !result) return <PanelSkeleton height={420} />;

    const chartData: DataTable = {
        columns: [
            { name: "Day" },
            { name: "Current run rate" },
            { name: "Projected" },
        ],
        rows: result.series.map((point) => [
            point.day,
            point.baselineBacklog,
            point.projectedBacklog,
        ]),
    };

    const isDefault =
        levers.arrivalChangePct === DEFAULT_LEVERS.arrivalChangePct &&
        levers.capacityMultiplier === DEFAULT_LEVERS.capacityMultiplier &&
        levers.stpUpliftPoints === DEFAULT_LEVERS.stpUpliftPoints &&
        levers.cardUpliftPoints === DEFAULT_LEVERS.cardUpliftPoints;

    return (
        <div className="flex flex-col gap-500">
            <div className="rounded-2xl border border-border bg-accent/40 p-400 text-[length:var(--text-200)] leading-300 text-muted-foreground">
                Today the desk receives{" "}
                <strong className="text-card-foreground">
                    {formatDecimal(basis.arrivalsPerDay)} exceptions a day
                </strong>{" "}
                and clears{" "}
                <strong className="text-card-foreground">
                    {formatDecimal(basis.resolutionsPerDay)}
                </strong>
                , against an open backlog of{" "}
                <strong className="text-card-foreground">
                    {formatCount(basis.openBacklog)}
                </strong>
                . Those run rates are measured from the semantic model over the last{" "}
                {basis.windowDays} days; the sliders project them forward.
            </div>

            <div className="grid grid-cols-1 gap-400 xl:grid-cols-3">
                <Panel
                    eyebrow="Scenario"
                    title="Levers"
                    description="Move a slider to re-project instantly."
                    action={
                        <button
                            type="button"
                            onClick={() => setLevers(DEFAULT_LEVERS)}
                            disabled={isDefault}
                            className="inline-flex items-center gap-200 rounded-full border border-border px-400 py-200-nudge text-[length:var(--text-100)] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                            <RotateCcw className="icon-size-100" aria-hidden="true" />
                            Reset
                        </button>
                    }
                >
                    <div className="flex flex-col gap-500">
                        <Slider
                            label="Exception arrival rate"
                            hint={`Upstream prevention or a data-quality push. Now ${formatDecimal(basis.arrivalsPerDay)}/day → ${formatDecimal(result.effectiveArrivalsPerDay)}/day.`}
                            value={levers.arrivalChangePct}
                            min={-60}
                            max={60}
                            step={5}
                            format={(value) => `${value > 0 ? "+" : ""}${value}%`}
                            onChange={(value) =>
                                setLevers((current) => ({ ...current, arrivalChangePct: value }))
                            }
                        />
                        <Slider
                            label="Desk capacity"
                            hint={`Specialists or automation on the queue. Now ${formatDecimal(basis.resolutionsPerDay)}/day → ${formatDecimal(result.effectiveCapacityPerDay)}/day.`}
                            value={levers.capacityMultiplier}
                            min={0.5}
                            max={3}
                            step={0.1}
                            format={(value) => `${value.toFixed(1)}×`}
                            onChange={(value) =>
                                setLevers((current) => ({ ...current, capacityMultiplier: value }))
                            }
                        />
                        <Slider
                            label="Straight-through uplift"
                            hint="Percentage points added to the straight-through rate."
                            value={levers.stpUpliftPoints}
                            min={0}
                            max={25}
                            step={1}
                            format={(value) => formatPointDelta(value, 0)}
                            onChange={(value) =>
                                setLevers((current) => ({ ...current, stpUpliftPoints: value }))
                            }
                        />
                        <Slider
                            label="Virtual-card adoption uplift"
                            hint="Percentage points of eligible spend moved onto card."
                            value={levers.cardUpliftPoints}
                            min={0}
                            max={40}
                            step={1}
                            format={(value) => formatPointDelta(value, 0)}
                            onChange={(value) =>
                                setLevers((current) => ({ ...current, cardUpliftPoints: value }))
                            }
                        />
                        <Slider
                            label="Horizon"
                            hint="How far forward to project."
                            value={levers.horizonDays}
                            min={14}
                            max={180}
                            step={1}
                            format={(value) => `${value} days`}
                            onChange={(value) =>
                                setLevers((current) => ({ ...current, horizonDays: value }))
                            }
                        />
                    </div>
                </Panel>

                <LocalChartPanel
                    className="xl:col-span-2"
                    eyebrow="Projection"
                    title="Exception backlog"
                    description="Solid line is your scenario; dashed is the current run rate held flat."
                    height={380}
                    spec={BACKLOG_SPEC}
                    data={chartData}
                />
            </div>

            <div className="grid grid-cols-1 gap-400 sm:grid-cols-2 xl:grid-cols-4">
                <Outcome
                    label={`Backlog at day ${levers.horizonDays}`}
                    value={formatCount(result.endingBacklog)}
                    delta={
                        Math.abs(result.backlogDelta) < 0.5
                            ? undefined
                            : `${result.backlogDelta > 0 ? "+" : ""}${formatCount(result.backlogDelta)} vs run rate`
                    }
                    improving={result.backlogDelta < 0}
                    caption={`Current run rate reaches ${formatCount(result.baselineEndingBacklog)}.`}
                />
                <Outcome
                    label="Backlog cleared"
                    value={result.daysToClear ? `Day ${result.daysToClear}` : "Not within horizon"}
                    caption={
                        result.daysToClear
                            ? "First day the queue reaches zero."
                            : "Capacity never overtakes arrivals at these settings."
                    }
                />
                <Outcome
                    label="Value at risk"
                    value={formatCompactCurrency(result.projectedValueAtRisk)}
                    caption={`Open exception value at day ${levers.horizonDays}, at today's average of ${formatCompactCurrency(basis.avgExceptionValue)} each.`}
                />
                <Outcome
                    label="Rebate captured"
                    value={formatCompactCurrency(result.rebateCaptured)}
                    caption={`From card enrolment over ${levers.horizonDays} days. ${formatCount(result.manualTouchesAvoided)} manual touches avoided.`}
                />
            </div>

            <p className="text-[length:var(--text-100)] leading-200 text-muted-foreground">
                The projection is a deterministic queue simulation: each day arrivals are added,
                the desk clears up to its capacity, and the remainder carries forward. Breach and
                value figures hold today&apos;s mix constant, so treat them as directional planning
                figures rather than a forecast with confidence intervals.
            </p>
        </div>
    );
}
