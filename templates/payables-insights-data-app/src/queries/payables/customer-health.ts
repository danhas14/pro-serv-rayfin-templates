import type { ColumnMetadataMap } from "@/lib/to-data-table";
import query from "./customer-health.dax?raw";
import {
    connection,
    COUNT_FORMAT,
    CURRENCY_FORMAT,
    HOURS_FORMAT,
    PERCENT_FORMAT,
} from "./shared";

const columnMetadata: ColumnMetadataMap = {
    "Customer[Customer Name]": { name: "CustomerName", displayName: "Customer" },
    "Customer[Industry]": { name: "Industry", displayName: "Industry" },
    "Customer[Risk Level]": { name: "RiskLevel", displayName: "Risk" },
    "[PaymentValue]": { name: "PaymentValue", displayName: "Payment value", format: CURRENCY_FORMAT },
    "[Payments]": { name: "Payments", displayName: "Payments", format: COUNT_FORMAT },
    "[SuccessRate]": { name: "SuccessRate", displayName: "Success", format: PERCENT_FORMAT },
    "[StpRate]": { name: "StpRate", displayName: "STP", format: PERCENT_FORMAT },
    "[OpenExceptions]": { name: "OpenExceptions", displayName: "Open exc.", format: COUNT_FORMAT },
    "[AvgApprovalHours]": { name: "AvgApprovalHours", displayName: "Approval hrs", format: HOURS_FORMAT },
    "[RebateOpportunity]": { name: "RebateOpportunity", displayName: "Rebate opp.", format: CURRENCY_FORMAT },
};

/** Largest customers by payment value, with their operating quality. */
export function customerHealth() {
    return { connection, query, columnMetadata };
}
