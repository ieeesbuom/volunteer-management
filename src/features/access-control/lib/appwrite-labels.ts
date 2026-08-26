import { isAdminEmail } from "@/features/access-control/lib/rules";
import type { SbRole } from "@/features/access-control/types";
import { SB_ROLES } from "@/lib/config";

/** Global system-admin claim on the Appwrite Auth user. */
export const ADMIN_LABEL = "admin";

const SB_LABEL_PREFIX = "sb";

/**
 * Appwrite labels must be alphanumeric (max 36 chars).
 * Encode SB roles as `sb` + role with spaces removed, e.g. `sbViceChairperson`.
 */
export function sbRoleToLabel(role: SbRole): string {
  return `${SB_LABEL_PREFIX}${role.replace(/\s+/g, "")}`;
}

const LABEL_TO_SB_ROLE: Map<string, SbRole> = new Map(
  SB_ROLES.map((role) => [sbRoleToLabel(role), role]),
);

export function labelToSbRole(label: string): SbRole | null {
  return LABEL_TO_SB_ROLE.get(label) ?? null;
}

export function isManagedAuthLabel(label: string): boolean {
  return label === ADMIN_LABEL || LABEL_TO_SB_ROLE.has(label);
}

export function isAdminLabel(labels: readonly string[] | null | undefined): boolean {
  return Boolean(labels?.includes(ADMIN_LABEL));
}

/** SB roles derived only from Appwrite labels (ignores event:* and unknown labels). */
export function sbRolesFromLabels(labels: readonly string[] | null | undefined): SbRole[] {
  if (!labels?.length) {
    return [];
  }

  const roles: SbRole[] = [];
  for (const label of labels) {
    const role = labelToSbRole(label);
    if (role && !roles.includes(role)) {
      roles.push(role);
    }
  }
  return roles;
}

/**
 * OR-merge: keep every table role and every label-derived role.
 * Missing labels must not remove table-backed access.
 */
export function mergeSbRoles(
  tableRoles: readonly SbRole[],
  labels: readonly string[] | null | undefined,
): SbRole[] {
  const merged = [...tableRoles];
  for (const role of sbRolesFromLabels(labels)) {
    if (!merged.includes(role)) {
      merged.push(role);
    }
  }
  return merged;
}

/**
 * Build the next labels array for a user.
 * Preserves unknown labels; only rewrites `admin` and managed `sb*` labels.
 */
export function buildSyncedLabels({
  currentLabels,
  isAdmin,
  sbRoles,
}: {
  currentLabels: readonly string[];
  isAdmin: boolean;
  sbRoles: readonly SbRole[];
}): string[] {
  const preserved = currentLabels.filter((label) => !isManagedAuthLabel(label));
  const next = [...preserved];

  if (isAdmin) {
    next.push(ADMIN_LABEL);
  }

  for (const role of sbRoles) {
    const label = sbRoleToLabel(role);
    if (!next.includes(label)) {
      next.push(label);
    }
  }

  return next;
}

export function resolveIsAdmin({
  email,
  adminEmail,
  labels,
}: {
  email: string;
  adminEmail: string;
  labels: readonly string[] | null | undefined;
}): boolean {
  return isAdminEmail(email, adminEmail) || isAdminLabel(labels);
}
