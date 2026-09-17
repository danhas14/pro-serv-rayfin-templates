import type { ColumnMetadataMap } from "@/lib/to-data-table";
import baseQuery from "./forecast-basis.dax?raw";
import {
    applyWindow,
    connection,
    COUNT_FORMAT,
    CURRENCY_FORMAT,
    HOURS_FORMAT,
    PERCENT_FORMAT,
    type WindowParams,
} from "./shared";

const columnMetadata: ColumnMetadataMap = {
    "[WindowDays]": { name: "WindowDays", displayName: "Window days", format: COUNT_FORMAT },
    "[OpenBacklog]": { name: "OpenBacklog", displayName: "Open backlog", format: COUNT_FORMAT },
    "[BreachedNow]": { name: "BreachedNow", displayName: "Breached", format: COUNT_FORMAT },
    "[ArrivalsPerDay]": { name: "ArrivalsPerDay", displayName: "Arrivals / day", format: HOURS_FORMAT },
    "[ResolutionsPerDay]": { name: "ResolutionsPerDay", displayName: "Resolutions / day", format: HOURS_FORMAT },
    "[PaymentValuePerDay]": { name: "PaymentValuePerDay", displayName: "Value / day", format: CURRENCY_FORMAT },
    "[PaymentsPerDay]": { name: "PaymentsPerDay", displayName: "Payments / day", format: HOURS_FORMAT },
    "[StpRate]": { name: "StpRate", displayName: "STP rate", format: PERCENT_FORMAT },
    "[CardAdoption]": { name: "CardAdoption", displayName: "Card adoption", format: PERCENT_FORMAT },
    "[RebateOpportunity]": { name: "RebateOpportunity", displayName: "Rebate opportunity", format: CURRENCY_FORMAT },
    "[AvgResolutionHours]": { name: "AvgResolutionHours", displayName: "Avg resolution", format: HOURS_FORMAT },
    "[AvgExceptionValue]": { name: "AvgExceptionValue", displayName: "Avg exception value", format: CURRENCY_FORMAT },
};

/** Observed run rates the what-if projection starts from. */
export function forecastBasis(params?: WindowParams) {
    return {
        connection,
        query: applyWindow(baseQuery, params?.days),
        columnMetadata,
    };
}
