// hooks/utc-to-localdatetime.ts

export const formatDateTimeCell = (value?: string | null) => {
  if (!value) return "";

  // Convert Postgres ISO
  const iso = value.replace(" ", "T").split(".")[0];
  const date = new Date(iso);

  if (isNaN(date.getTime())) return "";

  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // 24h format
  });
};
