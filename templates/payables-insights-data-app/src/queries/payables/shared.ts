/** Connection alias from fabric.yaml. */
export const connection = "payables";

export const CURRENCY_FORMAT = "$#,0";
export const CURRENCY_FORMAT_2DP = "$#,0.00";
export const PERCENT_FORMAT = "0.0%";
export const COUNT_FORMAT = "#,0";
export const HOURS_FORMAT = "#,0.0";

export interface WindowParams {
    /** Trailing window in days, anchored on the most recent payment date. */
    days?: number;
}

export const DEFAULT_WINDOW_DAYS = 90;

/**
 * Replace the `__WINDOW_DAYS__` token in a .dax file.
 *
 * The window is anchored on the latest payment date rather than TODAY() so the
 * demo dataset keeps reporting a populated window however long it sits unused.
 */
export function applyWindow(query: string, days?: number): string {
    const span = Math.max(1, Math.floor(days ?? DEFAULT_WINDOW_DAYS));
    return query.replaceAll("__WINDOW_DAYS__", String(span));
}
