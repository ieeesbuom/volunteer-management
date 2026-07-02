export const APP_NAME = "Volunteer Management";
export const ORGANIZATION_NAME = "IEEE Student Branch University of Moratuwa";
export const UOM_EMAIL_DOMAIN = "uom.lk";

export const EVENT_STATUSES = [
  "DRAFT",
  "PLANNING",
  "PUBLISHED",
  "ONGOING",
  "PENDING_CONCLUSION",
  "CLOSED",
] as const;

/** Canonical IEEE year terms from Core System Settings. */
export const IEEE_TERMS = [
  "25/26",
  "26/27",
  "27/28",
  "28/29",
  "29/30",
  "30/31",
  "31/32",
  "32/33",
  "33/34",
  "34/35",
  "35/36",
] as const;

export const EVENT_YEAR_MIN = 2000;
export const EVENT_YEAR_MAX = 2100;

export const SB_ROLES = ["ExCom", "SB Lead", "SB Member"] as const;

export const EVENT_ROLES = [
  "Chair",
  "Vice Chair",
  "Committee Lead",
  "Committee Member",
] as const;

export const SCORING_ROLES = EVENT_ROLES;

export const ROLE_BASE_POINTS = {
  Chair: 60,
  "Vice Chair": 40,
  "Committee Lead": 25,
  "Committee Member": 10,
} as const;

export function isUomEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const parts = normalized.split("@");

  return parts.length === 2 && Boolean(parts[0]) && !/\s/.test(parts[0]) && parts[1] === UOM_EMAIL_DOMAIN;
}
