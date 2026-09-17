const currency0 = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
});

const compactCurrency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
});

const count0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function formatCurrency(value: number | undefined | null): string {
    if (value == null || Number.isNaN(value)) return "—";
    return currency0.format(value);
}

export function formatCompactCurrency(value: number | undefined | null): string {
    if (value == null || Number.isNaN(value)) return "—";
    return Math.abs(value) < 10_000 ? currency0.format(value) : compactCurrency.format(value);
}

export function formatCount(value: number | undefined | null): string {
    if (value == null || Number.isNaN(value)) return "—";
    return count0.format(value);
}

export function formatDecimal(value: number | undefined | null): string {
    if (value == null || Number.isNaN(value)) return "—";
    return decimal1.format(value);
}

/** Formats a 0–1 ratio as a percentage. */
export function formatRate(value: number | undefined | null, digits = 1): string {
    if (value == null || Number.isNaN(value)) return "—";
    return `${(value * 100).toFixed(digits)}%`;
}

/** Formats a percentage-point delta with an explicit sign. */
export function formatPointDelta(value: number, digits = 1): string {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(digits)} pts`;
}

export function formatHours(value: number | undefined | null): string {
    if (value == null || Number.isNaN(value)) return "—";
    if (value < 24) return `${decimal1.format(value)}h`;
    return `${decimal1.format(value / 24)}d`;
}
