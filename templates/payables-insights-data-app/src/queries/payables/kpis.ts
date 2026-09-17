import type { ColumnMetadataMap } from "@/lib/to-data-table";
import baseQuery from "./kpis.dax?raw";
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
    "[PaymentValue]": { name: "PaymentValue", displayName: "Payment value", format: CURRENCY_FORMAT },
    "[PaymentCount]": { name: "PaymentCount", displayName: "Payments", format: COUNT_FORMAT },
    "[SuccessRate]": { name: "SuccessRate", displayName: "Success rate", format: PERCENT_FORMAT },
    "[StpRate]": { name: "StpRate", displayName: "Straight-through rate", format: PERCENT_FORMAT },
    "[AvgProcessingHours]": { name: "AvgProcessingHours", displayName: "Avg processing", format: HOURS_FORMAT },
    "[RebateOpportunity]": { name: "RebateOpportunity", displayName: "Rebate opportunity", format: CURRENCY_FORMAT },
    "[CardAdoption]": { name: "CardAdoption", displayName: "Card adoption", format: PERCENT_FORMAT },
    "[CrossBorderValue]": { name: "CrossBorderValue", displayName: "Cross-border value", format: CURRENCY_FORMAT },
    "[ExceptionsCreated]": { name: "ExceptionsCreated", displayName: "Exceptions created", format: COUNT_FORMAT },
    "[ExceptionsResolved]": { name: "ExceptionsResolved", displayName: "Exceptions resolved", format: COUNT_FORMAT },
    "[OpenExceptions]": { name: "OpenExceptions", displayName: "Open exceptions", format: COUNT_FORMAT },
    "[HighPriorityOpen]": { name: "HighPriorityOpen", displayName: "High priority open", format: COUNT_FORMAT },
    "[SlaBreached]": { name: "SlaBreached", displayName: "SLA breached", format: COUNT_FORMAT },
    "[SlaAttainment]": { name: "SlaAttainment", displayName: "SLA attainment", format: PERCENT_FORMAT },
    "[AvgResolutionHours]": { name: "AvgResolutionHours", displayName: "Avg resolution", format: HOURS_FORMAT },
    "[ValueAtRisk]": { name: "ValueAtRisk", displayName: "Value at risk", format: CURRENCY_FORMAT },
    "[AvgDailyArrivals]": { name: "AvgDailyArrivals", displayName: "Arrivals / day", format: HOURS_FORMAT },
    "[AvgDailyResolutions]": { name: "AvgDailyResolutions", displayName: "Resolutions / day", format: HOURS_FORMAT },
};

/** Headline operating figures for the selected trailing window. */
export function payablesKpis(params?: WindowParams) {
    return {
        connection,
        query: applyWindow(baseQuery, params?.days),
        columnMetadata,
    };
}
