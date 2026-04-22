/* eslint-disable @typescript-eslint/no-explicit-any */

import { formatDateTime } from "@/utils/components/format-date";
import { SITE_PATHS } from "@/lib/urls";

function countCodes(val: unknown): number {
  if (!val || typeof val !== "string") return 0;
  return val.split("|").filter(Boolean).length;
}

export function excelSafeValue(val: any, key?: string) {
  if (key === "investigator_sign_off") {
    return val ? "Signed" : "Unsigned";
  }

  if (val === true) return "Yes";
  if (val === false) return "No";

  if (
    val instanceof Date ||
    (typeof val === "string" && !isNaN(Date.parse(val)))
  ) {
    return formatDateTime(val);
  }

  if (typeof val === "object" && val !== null) {
    return JSON.stringify(val);
  }

  return val ?? "";
}

export function buildRowValues({
  rowData,
  keys,
  pathname,
}: {
  rowData: any;
  keys: string[];
  pathname?: string;
}) {
  return keys.map((key) => {
    let val = rowData[key];

    // computed shipment fields
    if (val === undefined) {
      if (key === "aliquot_sent_count") {
        val = countCodes(rowData.aliquot_id);
      }
      if (key === "aliquot_received_count") {
        val = countCodes(rowData.aliquot_received_codes);
      }
      if (key === "aliquot_missing_count") {
        val =
          countCodes(rowData.aliquot_id) -
          countCodes(rowData.aliquot_received_codes);
      }
    }

    // shipping arrays
    if (
      pathname?.includes(SITE_PATHS.SHIPMENT_TRACKING) &&
      Array.isArray(val)
    ) {
      return val.join("; ");
    }

    return excelSafeValue(val, key);
  });
}
