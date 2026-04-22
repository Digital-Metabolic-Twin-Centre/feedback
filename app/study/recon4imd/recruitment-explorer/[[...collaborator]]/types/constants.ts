export const SHOW_ALL_HEALTHCARE_PROVIDERS = "Show All Healthcare Providers";

export function parseCollaborators(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (typeof input !== "string") {
    return [];
  }

  const normalized = input.replace(/[{}]/g, "");
  if (!normalized.trim()) {
    return [];
  }

  return normalized
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
