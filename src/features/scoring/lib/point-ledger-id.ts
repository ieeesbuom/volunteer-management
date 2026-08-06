import { createHash } from "node:crypto";

export type PointLedgerSource = "grade" | "role";

export function pointLedgerRowId(userId: string, eventId: string, source: PointLedgerSource) {
  const seed = `${userId}:${eventId}:${source}`;

  return `pl_${createHash("sha1").update(seed).digest("hex").slice(0, 28)}`;
}

export function isDeterministicPointLedgerRowId(rowId: string) {
  return rowId.startsWith("pl_");
}
