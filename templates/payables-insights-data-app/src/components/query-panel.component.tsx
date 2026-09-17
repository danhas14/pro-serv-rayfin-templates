import { VegaVisual, useCssTheme } from "@microsoft/fabric-visuals";
import type { VisualizationSpec } from "@microsoft/fabric-visuals";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { DataGrid } from "@microsoft/fabric-datagrid";
import { Panel, PanelEmpty, PanelError, PanelSkeleton } from "@/components/panel.component";
import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";
import { toDataTable, type ColumnMetadataMap } from "@/lib/to-data-table";

interface QueryPanelProps {
    eyebrow: string;
    title: string;
    description?: string;
    height: number;
    className?: string;
    connection: string;
    query: string;
    columnMetadata: ColumnMetadataMap;
    /** Omit to render the result as a grid instead of a chart. */
    vegaLiteSpec?: VisualizationSpec;
}

/**
 * Runs a DAX query and renders the result as either a Vega-Lite visual or a
 * data grid, handling the loading, empty and error states in one place.
 */
export function QueryPanel({
    eyebrow,
    title,
    description,
    height,
    className,
    connection,
    query,
    columnMetadata,
    vegaLiteSpec,
}: QueryPanelProps) {
    const theme = useCssTheme();
    const { data, isLoading, error } = useSemanticModelQuery({ connection, query });

    function renderBody() {
        if (isLoading) return <PanelSkeleton height={height} />;
        if (data?.status === "error") return <PanelError message={data.error.message} />;
        if (error) return <PanelError message={error.message} />;
        if (data?.status !== "success") return <PanelSkeleton height={height} />;
        if (data.table.rows.length === 0) return <PanelEmpty height={height} />;

        const dataTable = toDataTable(data.table, columnMetadata);

        if (!vegaLiteSpec) {
            return (
                <div style={{ height }}>
                    <DataGrid data={dataTable} theme={theme} />
                </div>
            );
        }

        return <VegaVisual spec={vegaLiteSpec} data={dataTable} theme={theme} style={{ height }} />;
    }

    return (
        <Panel eyebrow={eyebrow} title={title} description={description} className={className}>
            {renderBody()}
        </Panel>
    );
}

/** Renders a locally computed table — used by the what-if projection. */
export function LocalChartPanel({
    eyebrow,
    title,
    description,
    height,
    className,
    spec,
    data,
}: {
    eyebrow: string;
    title: string;
    description?: string;
    height: number;
    className?: string;
    spec: VisualizationSpec;
    data: DataTable;
}) {
    const theme = useCssTheme();

    return (
        <Panel eyebrow={eyebrow} title={title} description={description} className={className}>
            <VegaVisual spec={spec} data={data} theme={theme} style={{ height }} />
        </Panel>
    );
}
