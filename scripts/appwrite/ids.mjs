import { createHash } from "node:crypto";

export function uomEmailClaimSettingKey(normalizedUomEmail) {
  return `uom_email_claim:${normalizedUomEmail}`;
}

export function uomEmailClaimRowId(normalizedUomEmail) {
  return `uec_${createHash("sha1").update(normalizedUomEmail).digest("hex").slice(0, 28)}`;
}

export function pointLedgerRowId(userId, eventId, source) {
  const seed = `${userId}:${eventId}:${source}`;

  return `pl_${createHash("sha1").update(seed).digest("hex").slice(0, 28)}`;
}

export function normalizeUomEmail(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function hashUserId(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
