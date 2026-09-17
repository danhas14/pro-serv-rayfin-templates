import type { VisualizationSpec } from "@microsoft/fabric-visuals";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import query from "./sla-by-priority.dax?raw";
import spec from "./sla-by-priority.json";
import {
    connection,
    COUNT_FORMAT,
    CURRENCY_FORMAT,
    HOURS_FORMAT,
    PERCENT_FORMAT,
} from "./shared";

const columnMetadata: ColumnMetadataMap = {
    "Exception[Priority]": { name: "Priority", displayName: "Priority" },
    "[OpenExceptions]": { name: "OpenExceptions", displayName: "Open", format: COUNT_FORMAT },
    "[Breached]": { name: "Breached", displayName: "Breached", format: COUNT_FORMAT },
    "[Attainment]": { name: "Attainment", displayName: "Attainment", format: PERCENT_FORMAT },
    "[AvgResolutionHours]": { name: "AvgResolutionHours", displayName: "Avg resolution", format: HOURS_FORMAT },
    "[ValueAtRisk]": { name: "ValueAtRisk", displayName: "Value at risk", format: CURRENCY_FORMAT },
};

/** Service-level attainment split by exception priority. */
export function slaByPriority() {
    return { connection, query, columnMetadata, vegaLiteSpec: spec as VisualizationSpec };
}
