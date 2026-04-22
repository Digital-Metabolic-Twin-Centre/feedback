import { formatDateTime } from "@/utils/components/format-date";

// Count pipe-separated codes in a string (e.g. "A|B|C" → 3)
function countCodes(val: unknown): number {
  if (!val || typeof val !== "string") return 0;
  return val.split("|").filter(Boolean).length;
}
// import { SITE_PATHS } from "@/lib/urls";

export function buildRowValues(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any,
  keys: string[],
  pathname?: string,
  forCSV = false
) {
  return keys.map((key) => {
    let val = row[key];

    // computed shipment fields
    if (val === undefined) {
      if (key === "aliquot_sent_count")
        val = countCodes(row.aliquot_id);
      if (key === "aliquot_received_count")
        val = countCodes(row.aliquot_received_codes);
      if (key === "aliquot_missing_count")
        val =
          countCodes(row.aliquot_id) -
          countCodes(row.aliquot_received_codes);
    }

    if (key === "investigator_sign_off") {
      return val ? "Signed" : "Unsigned";
    }

    // if (
    //   pathname?.includes(SITE_PATHS.SHIPMENT_TRACKING) &&
    //   Array.isArray(val)
    // ) {
    //   val = val.join("; ");
    // }

    if (Array.isArray(val)) {
      val = val.join("; ");
    }

    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      val = JSON.stringify(val);
    }

    if (val instanceof Date) {
      val = formatDateTime(val);
    }

    // Only match strict ISO date formats
    if (
      typeof val === "string" &&
      /^\d{4}-\d{2}-\d{2}/.test(val)
    ) {
      val = formatDateTime(val);
    }

    if (forCSV && typeof val === "string") {
      return `"${val.replace(/"/g, '""')}"`;
    }

    if (val === true) return "Yes";
    if (val === false) return "No";

    return val ?? "";
  });
}
