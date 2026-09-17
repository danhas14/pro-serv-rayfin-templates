import type { ColumnMetadataMap } from "@/lib/to-data-table";
import query from "./vendor-risk.dax?raw";
import {
    connection,
    COUNT_FORMAT,
    CURRENCY_FORMAT,
    HOURS_FORMAT,
    PERCENT_FORMAT,
} from "./shared";

const columnMetadata: ColumnMetadataMap = {
    "Vendor[Vendor Name]": { name: "VendorName", displayName: "Vendor" },
    "Vendor[Country]": { name: "Country", displayName: "Country" },
    "Vendor[Bank Details Status]": { name: "BankDetails", displayName: "Bank details" },
    "[OpenExceptions]": { name: "OpenExceptions", displayName: "Open exc.", format: COUNT_FORMAT },
    "[Created]": { name: "Created", displayName: "Exceptions", format: COUNT_FORMAT },
    "[PaymentValue]": { name: "PaymentValue", displayName: "Payment value", format: CURRENCY_FORMAT },
    "[SuccessRate]": { name: "SuccessRate", displayName: "Success", format: PERCENT_FORMAT },
    "[AvgProcessingHours]": { name: "AvgProcessingHours", displayName: "Processing hrs", format: HOURS_FORMAT },
};

/** Vendors generating the most exceptions. */
export function vendorRisk() {
    return { connection, query, columnMetadata };
}
