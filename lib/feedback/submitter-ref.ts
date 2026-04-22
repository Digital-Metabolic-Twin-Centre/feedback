import { createHash } from "node:crypto";

export function deriveSubmitterRef(email: string): string {
  const normalized = email.trim().toLowerCase();
  const digest = createHash("md5").update(normalized).digest("hex");
  return `usr_${digest.slice(0, 12)}`;
}
