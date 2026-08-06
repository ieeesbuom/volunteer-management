import { createHash } from "node:crypto";

/** Stable setting key stored in the system_settings.key column (not used as row ID). */
export function uomEmailClaimSettingKey(normalizedUomEmail: string) {
  return `uom_email_claim:${normalizedUomEmail}`;
}

/** Appwrite-safe deterministic row ID for a verified UoM email claim. */
export function uomEmailClaimRowId(normalizedUomEmail: string) {
  const digest = createHash("sha1").update(normalizedUomEmail).digest("hex").slice(0, 28);

  return `uec_${digest}`;
}
