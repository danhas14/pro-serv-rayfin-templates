/**
 * What-if projection for the exception desk.
 *
 * The model is a deterministic single-queue simulation: each day a number of
 * exceptions arrive, the desk resolves up to its daily capacity, and whatever
 * is left carries into the next day. Everything it needs is measured from the
 * semantic model — nothing here invents a baseline.
 */

export interface ForecastBasis {
    /** Open exceptions at the start of the projection. */
    openBacklog: number;
    /** Open exceptions already past their service-level target. */
    breachedNow: number;
    arrivalsPerDay: number;
    resolutionsPerDay: number;
    paymentValuePerDay: number;
    paymentsPerDay: number;
    /** 0–1 ratio. */
    stpRate: number;
    /** 0–1 ratio. */
    cardAdoption: number;
    /** Annualised-at-current-rate rebate left on the table over the window. */
    rebateOpportunity: number;
    avgResolutionHours: number;
    avgExceptionValue: number;
    /** Days the basis was measured over. */
    windowDays: number;
}

export interface ForecastLevers {
    /** Percentage change to the arrival rate, e.g. -20 means 20% fewer. */
    arrivalChangePct: number;
    /** Multiplier applied to the desk's daily resolution capacity. */
    capacityMultiplier: number;
    /** Percentage points added to the straight-through rate. */
    stpUpliftPoints: number;
    /** Percentage points added to virtual-card adoption. */
    cardUpliftPoints: number;
    /** Projection horizon in days. */
    horizonDays: number;
}

export const DEFAULT_LEVERS: ForecastLevers = {
    arrivalChangePct: 0,
    capacityMultiplier: 1,
    stpUpliftPoints: 0,
    cardUpliftPoints: 0,
    horizonDays: 60,
};

export interface ForecastDay {
    day: number;
    baselineBacklog: number;
    projectedBacklog: number;
}

export interface ForecastResult {
    series: ForecastDay[];
    /** Backlog at the end of the horizon under the levers. */
    endingBacklog: number;
    /** Backlog at the end of the horizon with no changes. */
    baselineEndingBacklog: number;
    backlogDelta: number;
    /** Day the backlog first reaches zero, or null if it never does. */
    daysToClear: number | null;
    /** Projected breaches at the horizon, scaled from today's breach share. */
    projectedBreaches: number;
    baselineProjectedBreaches: number;
    /** Exception value still open at the horizon. */
    projectedValueAtRisk: number;
    /** Payments that avoid a manual touch over the horizon. */
    manualTouchesAvoided: number;
    /** Extra rebate captured over the horizon from card enrolment. */
    rebateCaptured: number;
    /** Effective arrivals per day after the arrival lever. */
    effectiveArrivalsPerDay: number;
    /** Effective resolutions per day after the capacity lever. */
    effectiveCapacityPerDay: number;
}

function simulate(
    startBacklog: number,
    arrivalsPerDay: number,
    capacityPerDay: number,
    horizonDays: number,
): number[] {
    const out: number[] = [];
    let backlog = startBacklog;

    for (let day = 1; day <= horizonDays; day += 1) {
        const inflow = backlog + arrivalsPerDay;
        backlog = Math.max(0, inflow - capacityPerDay);
        out.push(backlog);
    }

    return out;
}

export function projectForecast(
    basis: ForecastBasis,
    levers: ForecastLevers,
): ForecastResult {
    const horizon = Math.max(1, Math.round(levers.horizonDays));

    const effectiveArrivalsPerDay =
        basis.arrivalsPerDay * (1 + levers.arrivalChangePct / 100);
    const effectiveCapacityPerDay = basis.resolutionsPerDay * levers.capacityMultiplier;

    const baseline = simulate(
        basis.openBacklog,
        basis.arrivalsPerDay,
        basis.resolutionsPerDay,
        horizon,
    );
    const projected = simulate(
        basis.openBacklog,
        effectiveArrivalsPerDay,
        effectiveCapacityPerDay,
        horizon,
    );

    const series: ForecastDay[] = projected.map((value, index) => ({
        day: index + 1,
        baselineBacklog: Math.round(baseline[index] * 10) / 10,
        projectedBacklog: Math.round(value * 10) / 10,
    }));

    const endingBacklog = projected[projected.length - 1] ?? basis.openBacklog;
    const baselineEndingBacklog = baseline[baseline.length - 1] ?? basis.openBacklog;

    const clearIndex = projected.findIndex((value) => value <= 0.5);
    const daysToClear = clearIndex >= 0 ? clearIndex + 1 : null;

    // Today's breach share of the backlog is held constant and applied forward.
    const breachShare =
        basis.openBacklog > 0 ? basis.breachedNow / basis.openBacklog : 0;

    const manualTouchesAvoided =
        basis.paymentsPerDay * horizon * (levers.stpUpliftPoints / 100);

    // Card-eligible spend currently on another rail earns the configured 1.35%.
    const rebateRatePerDay =
        basis.windowDays > 0 ? basis.rebateOpportunity / basis.windowDays : 0;
    const cardShareOfOpportunity =
        levers.cardUpliftPoints > 0
            ? Math.min(1, levers.cardUpliftPoints / Math.max(1, (1 - basis.cardAdoption) * 100))
            : 0;
    const rebateCaptured = rebateRatePerDay * horizon * cardShareOfOpportunity;

    return {
        series,
        endingBacklog,
        baselineEndingBacklog,
        backlogDelta: endingBacklog - baselineEndingBacklog,
        daysToClear,
        projectedBreaches: endingBacklog * breachShare,
        baselineProjectedBreaches: baselineEndingBacklog * breachShare,
        projectedValueAtRisk: endingBacklog * basis.avgExceptionValue,
        manualTouchesAvoided,
        rebateCaptured,
        effectiveArrivalsPerDay,
        effectiveCapacityPerDay,
    };
}
