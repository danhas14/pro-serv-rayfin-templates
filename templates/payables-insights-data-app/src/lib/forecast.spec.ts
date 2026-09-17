import { describe, expect, it } from "vitest";
import { DEFAULT_LEVERS, projectForecast, type ForecastBasis } from "@/lib/forecast";

/** Mirrors the shape the semantic model returns for the demo dataset. */
const basis: ForecastBasis = {
    windowDays: 90,
    openBacklog: 76,
    breachedNow: 48,
    arrivalsPerDay: 3.36,
    resolutionsPerDay: 2.51,
    paymentValuePerDay: 580_728,
    paymentsPerDay: 14,
    stpRate: 0.679,
    cardAdoption: 0.133,
    rebateOpportunity: 248_558,
    avgResolutionHours: 18.8,
    avgExceptionValue: 57_102,
};

describe("projectForecast", () => {
    it("grows the backlog when arrivals outpace capacity", () => {
        const result = projectForecast(basis, { ...DEFAULT_LEVERS, horizonDays: 60 });
        expect(result.endingBacklog).toBeGreaterThan(basis.openBacklog);
        expect(result.daysToClear).toBeNull();
    });

    it("clears the backlog when capacity is raised enough", () => {
        const result = projectForecast(basis, {
            ...DEFAULT_LEVERS,
            capacityMultiplier: 3,
            horizonDays: 90,
        });
        expect(result.daysToClear).not.toBeNull();
        expect(result.endingBacklog).toBe(0);
    });

    it("never projects a negative backlog", () => {
        const result = projectForecast(basis, {
            ...DEFAULT_LEVERS,
            capacityMultiplier: 3,
            arrivalChangePct: -60,
            horizonDays: 120,
        });
        for (const point of result.series) {
            expect(point.projectedBacklog).toBeGreaterThanOrEqual(0);
        }
    });

    it("leaves the baseline untouched by the levers", () => {
        const a = projectForecast(basis, { ...DEFAULT_LEVERS, horizonDays: 45 });
        const b = projectForecast(basis, {
            ...DEFAULT_LEVERS,
            capacityMultiplier: 2,
            horizonDays: 45,
        });
        expect(b.baselineEndingBacklog).toBeCloseTo(a.baselineEndingBacklog, 5);
        expect(b.endingBacklog).toBeLessThan(a.endingBacklog);
    });

    it("reduces arrivals when the arrival lever is negative", () => {
        const result = projectForecast(basis, {
            ...DEFAULT_LEVERS,
            arrivalChangePct: -50,
        });
        expect(result.effectiveArrivalsPerDay).toBeCloseTo(basis.arrivalsPerDay * 0.5, 5);
    });

    it("returns one series point per horizon day", () => {
        const result = projectForecast(basis, { ...DEFAULT_LEVERS, horizonDays: 37 });
        expect(result.series).toHaveLength(37);
        expect(result.series[0].day).toBe(1);
        expect(result.series[36].day).toBe(37);
    });

    it("captures no rebate and avoids no touches when levers are neutral", () => {
        const result = projectForecast(basis, DEFAULT_LEVERS);
        expect(result.rebateCaptured).toBe(0);
        expect(result.manualTouchesAvoided).toBe(0);
    });

    it("scales rebate capture with the card uplift", () => {
        const small = projectForecast(basis, { ...DEFAULT_LEVERS, cardUpliftPoints: 10 });
        const large = projectForecast(basis, { ...DEFAULT_LEVERS, cardUpliftPoints: 30 });
        expect(large.rebateCaptured).toBeGreaterThan(small.rebateCaptured);
    });

    it("scales avoided manual touches with the straight-through uplift", () => {
        const result = projectForecast(basis, {
            ...DEFAULT_LEVERS,
            stpUpliftPoints: 10,
            horizonDays: 30,
        });
        expect(result.manualTouchesAvoided).toBeCloseTo(14 * 30 * 0.1, 5);
    });

    it("projects fewer breaches when the backlog shrinks", () => {
        const result = projectForecast(basis, {
            ...DEFAULT_LEVERS,
            capacityMultiplier: 2,
            horizonDays: 60,
        });
        expect(result.projectedBreaches).toBeLessThan(result.baselineProjectedBreaches);
    });
});
