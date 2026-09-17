import type { VisualizationSpec } from "@microsoft/fabric-visuals";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import baseQuery from "./exception-flow.dax?raw";
import spec from "./exception-flow.json";
import { applyWindow, connection, COUNT_FORMAT, type WindowParams } from "./shared";

const columnMetadata: ColumnMetadataMap = {
    "Date[Date]": { name: "FlowDate", displayName: "Date" },
    "[Created]": { name: "Created", displayName: "Created", format: COUNT_FORMAT },
    "[Resolved]": { name: "Resolved", displayName: "Resolved", format: COUNT_FORMAT },
    "[Backlog]": { name: "Backlog", displayName: "Open backlog", format: COUNT_FORMAT },
};

/** Daily exception arrivals against resolutions, plus the running backlog. */
export function exceptionFlow(params?: WindowParams) {
    return {
        connection,
        query: applyWindow(baseQuery, params?.days),
        columnMetadata,
        vegaLiteSpec: spec as VisualizationSpec,
    };
}
