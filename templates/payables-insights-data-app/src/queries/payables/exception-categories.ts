import type { VisualizationSpec } from "@microsoft/fabric-visuals";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import query from "./exception-categories.dax?raw";
import spec from "./exception-categories.json";
import {
    connection,
    COUNT_FORMAT,
    CURRENCY_FORMAT,
    HOURS_FORMAT,
} from "./shared";

const columnMetadata: ColumnMetadataMap = {
    "Exception Category[Category Name]": { name: "CategoryName", displayName: "Category" },
    "[OpenExceptions]": { name: "OpenExceptions", displayName: "Open", format: COUNT_FORMAT },
    "[Breached]": { name: "Breached", displayName: "Breached", format: COUNT_FORMAT },
    "[ValueAtRisk]": { name: "ValueAtRisk", displayName: "Value at risk", format: CURRENCY_FORMAT },
    "[AvgResolutionHours]": { name: "AvgResolutionHours", displayName: "Avg resolution", format: HOURS_FORMAT },
    "[Created]": { name: "Created", displayName: "Created", format: COUNT_FORMAT },
};

/** Open exception backlog by category, split by service-level state. */
export function exceptionCategories() {
    return { connection, query, columnMetadata, vegaLiteSpec: spec as VisualizationSpec };
}
