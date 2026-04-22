/**
 * Formats a date/time value for display in the user's local timezone.
 * Handles SQL timestamps (`YYYY-MM-DD HH:mm:ss.sss`) as UTC.
 */


/**
 * Formats a date/time value for display in the user's local timezone.
 * Handles SQL timestamps (`YYYY-MM-DD HH:mm:ss.sss`) as UTC.
 *
 * @param value - date/time value (string or Date)
 * @returns formatted date/time string
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatDateTime(value: any): string {
  if (!value) return "";

  const raw = String(value).trim();

  // Detect SQL-style datetime without timezone (e.g. "2025-09-30 10:34:08.389")
  let date: Date;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)) {
    // Replace space with T and append Z to mark it as UTC
    date = new Date(raw.replace(" ", "T") + "Z");
  } else {
    date = new Date(raw);
  }

  if (isNaN(date.getTime())) return raw; // not a valid date

  // Check if this represents midnight in the LOCAL timezone
  const localHours = date.getHours();
  const localMinutes = date.getMinutes();
  const localSeconds = date.getSeconds();
  const localMillis = date.getMilliseconds();

  const isDateOnly =
    localHours === 0 &&
    localMinutes === 0 &&
    localSeconds === 0 &&
    localMillis === 0;

  if (isDateOnly) {
    return date.toLocaleDateString(navigator.language);
  }

  // Full datetime, show in local timezone
  return date.toLocaleString(navigator.language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}



/**
 * Converts a Date object to a YYYY-MM-DD string in the local timezone.
 * @param d Date object
 * @returns YYYY-MM-DD string
 */

function toYMDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // local calendar date, no TZ
}

export function normalizeDates(updates: Record<string, unknown>) {
  for (const [key, val] of Object.entries(updates)) {
    if (val == null) continue;

    // Only target *_date or date_* (but not *_at timestamps)
    if ((key.endsWith("_date") || key.startsWith("date_")) && !key.endsWith("_at")) {
      const s = String(val);

      // If it's already a date-only string, keep it
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        updates[key] = s;
        continue;
      }

      // Otherwise, parse and take the LOCAL date components (avoid toISOString)
      const d = val instanceof Date ? val : new Date(s);
      if (!isNaN(d.getTime())) {
        updates[key] = toYMDLocal(d);
      } else {
        // optional: decide how to handle bad inputs
        // updates[key] = null; // or throw/skip
      }
    }
  }
  return updates;
}