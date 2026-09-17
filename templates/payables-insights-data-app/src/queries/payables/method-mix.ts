import type { VisualizationSpec } from "@microsoft/fabric-visuals";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import baseQuery from "./method-mix.dax?raw";
import spec from "./method-mix.json";
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
    "Payment[Payment Method]": { name: "PaymentMethod", displayName: "Payment method" },
    "[Value]": { name: "Value", displayName: "Payment value", format: CURRENCY_FORMAT },
    "[Payments]": { name: "Payments", displayName: "Payments", format: COUNT_FORMAT },
    "[SuccessRate]": { name: "SuccessRate", displayName: "Success rate", format: PERCENT_FORMAT },
    "[StpRate]": { name: "StpRate", displayName: "STP rate", format: PERCENT_FORMAT },
    "[AvgHours]": { name: "AvgHours", displayName: "Avg processing", format: HOURS_FORMAT },
};

/** Payment value and quality by rail. */
export function methodMix(params?: WindowParams) {
    return {
        connection,
        query: applyWindow(baseQuery, params?.days),
        columnMetadata,
        vegaLiteSpec: spec as VisualizationSpec,
    };
}
