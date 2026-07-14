import type { FormConnection } from "@/features/forms/types";

export const FORM_AUDIENCE_TIERS = [
  "public",
  "volunteers_only",
  "event_team_only",
  "chairs_only",
] as const;

export type FormAudienceTier = (typeof FORM_AUDIENCE_TIERS)[number];

export type FormAudienceMetadata = {
  audience: FormAudienceTier;
  closeAt?: string;
  openAt?: string;
  targetCommitteeId?: string;
};

export function getFormAudienceMetadata(connection: FormConnection): FormAudienceMetadata {
  const meta = connection.metadata as Record<string, unknown> | undefined;
  const audienceRaw = typeof meta?.audience === "string" ? meta.audience : "public";
  const audience: FormAudienceTier =
    audienceRaw === "volunteers_only" ||
    audienceRaw === "event_team_only" ||
    audienceRaw === "chairs_only"
      ? audienceRaw
      : "public";

  const targetCommitteeId =
    typeof meta?.targetCommitteeId === "string" && meta.targetCommitteeId
      ? meta.targetCommitteeId
      : undefined;

  const openAt = typeof meta?.openAt === "string" ? meta.openAt : undefined;
  const closeAt = typeof meta?.closeAt === "string" ? meta.closeAt : undefined;

  return {
    audience,
    closeAt,
    openAt,
    targetCommitteeId,
  };
}

export function isFormVisibleToUser({
  canManage = false,
  connection,
  currentUserId,
  userRoleAssignments = [],
}: {
  canManage?: boolean;
  connection: FormConnection;
  currentUserId?: string;
  userRoleAssignments?: Array<{
    committeeId?: string;
    committeeName?: string;
    userId: string;
  }>;
}): boolean {
  if (canManage) {
    return true;
  }

  const { audience, targetCommitteeId } = getFormAudienceMetadata(connection);

  if (audience === "public") {
    return true;
  }

  if (audience === "volunteers_only") {
    return Boolean(currentUserId);
  }

  if (audience === "chairs_only") {
    return canManage;
  }

  if (audience === "event_team_only") {
    if (!currentUserId) {
      return false;
    }

    const myAssignments = userRoleAssignments.filter((a) => a.userId === currentUserId);
    if (myAssignments.length === 0) {
      return false;
    }

    if (targetCommitteeId) {
      return myAssignments.some(
        (a) =>
          a.committeeId === targetCommitteeId ||
          a.committeeName === targetCommitteeId ||
          a.committeeName?.toLowerCase() === targetCommitteeId.toLowerCase(),
      );
    }

    return true;
  }

  return true;
}

export function isEligibleForGlobalDashboard(connection: FormConnection): boolean {
  if (
    connection.status !== "active" ||
    connection.purpose !== "registration" ||
    !connection.formUrl
  ) {
    return false;
  }

  const { audience, targetCommitteeId } = getFormAudienceMetadata(connection);
  return (audience === "public" || audience === "volunteers_only") && !targetCommitteeId;
}

export function formatAudienceBadge(
  audience: FormAudienceTier,
  targetCommitteeId?: string,
  committeesMap?: Map<string, string>,
): {
  label: string;
  tone: "neutral" | "primary" | "success" | "warning" | "danger";
} {
  if (audience === "chairs_only") {
    return { label: "Chairs & Admins Only", tone: "warning" };
  }

  if (audience === "event_team_only") {
    if (targetCommitteeId) {
      const committeeName = committeesMap?.get(targetCommitteeId) ?? targetCommitteeId;
      return { label: `Target: ${committeeName}`, tone: "primary" };
    }
    return { label: "Event Team Only", tone: "primary" };
  }

  if (audience === "volunteers_only") {
    return { label: "Logged-in Volunteers", tone: "success" };
  }

  return { label: "Public", tone: "neutral" };
}
