import type { VisualizationSpec } from "@microsoft/fabric-visuals";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import baseQuery from "./payment-trend.dax?raw";
import spec from "./payment-trend.json";
import {
    applyWindow,
    connection,
    COUNT_FORMAT,
    CURRENCY_FORMAT,
    type WindowParams,
} from "./shared";

const columnMetadata: ColumnMetadataMap = {
    "Date[Date]": { name: "PaymentDate", displayName: "Date" },
    "[PaymentValue]": { name: "PaymentValue", displayName: "Payment value", format: CURRENCY_FORMAT },
    "[PaymentCount]": { name: "PaymentCount", displayName: "Payments", format: COUNT_FORMAT },
    "[Rolling30]": { name: "Rolling30", displayName: "Rolling 30 days", format: CURRENCY_FORMAT },
};

/** Daily payment value across the selected window. */
export function paymentTrend(params?: WindowParams) {
    return {
        connection,
        query: applyWindow(baseQuery, params?.days),
        columnMetadata,
        vegaLiteSpec: spec as VisualizationSpec,
    };
}
