import "server-only";

import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { isAppwriteNotFound } from "@/server/errors";
import { writeAuditLog } from "@/server/audit";
import { canVolunteer } from "@/features/access-control/lib/rules";
import {
  getActiveEventRoleAssignments,
  getActiveSbRoles,
  listActiveEventRoleAssignments,
} from "@/features/access-control/server/roles";
import { getProfile, listProfiles } from "@/features/access-control/server/profiles";
import {
  canShowVolunteerProfile,
  canViewPrivateVolunteerProfile,
  toPublicVolunteerProfileDetails,
} from "@/features/volunteers/lib/profile-visibility";
import type { SessionUser } from "@/features/access-control/types";
import type {
  VolunteerDirectoryItem,
  VolunteerProfileDetails,
  VolunteerProfileSummary,
} from "@/features/volunteers/types";
import type { VolunteerProfileDetailsInput } from "@/features/volunteers/lib/profile-details";

type AppRow = Record<string, unknown> & { $id: string };

async function safeVolunteerAuditLog(input: Parameters<typeof writeAuditLog>[0]) {
  try {
    await writeAuditLog(input);
  } catch (error) {
    console.error("Volunteer audit log failed", error);
  }
}

function toVolunteerProfileDetails(row: AppRow): VolunteerProfileDetails {
  return {
    $id: row.$id,
    batchYear: typeof row.batchYear === "string" ? row.batchYear : "",
    bio: typeof row.bio === "string" && row.bio ? row.bio : undefined,
    createdAt: String(row.createdAt),
    department: typeof row.department === "string" ? row.department : "",
    faculty: typeof row.faculty === "string" ? row.faculty : "",
    headline: typeof row.headline === "string" && row.headline ? row.headline : undefined,
    linkedinUrl:
      typeof row.linkedinUrl === "string" && row.linkedinUrl ? row.linkedinUrl : undefined,
    skills: typeof row.skills === "string" && row.skills ? row.skills : undefined,
    updatedAt: String(row.updatedAt),
    universityIndex: typeof row.universityIndex === "string" ? row.universityIndex : "",
    userId: String(row.userId),
  };
}

export async function getVolunteerProfileDetails(userId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  try {
    const row = await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.profileDetails,
      userId,
    );

    return toVolunteerProfileDetails(row as AppRow);
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function upsertMyVolunteerProfileDetails({
  details,
  user,
}: {
  details: VolunteerProfileDetailsInput;
  user: SessionUser;
}) {
  if (!canVolunteer(user.profile)) {
    throw new Error("Verified UoM email is required before volunteering.");
  }

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();
  const existing = await getVolunteerProfileDetails(user.authUser.id);
  const payload = {
    batchYear: details.batchYear,
    bio: details.bio,
    department: details.department,
    faculty: details.faculty,
    headline: details.headline,
    linkedinUrl: details.linkedinUrl,
    skills: details.skills,
    updatedAt: now,
    universityIndex: details.universityIndex,
    userId: user.authUser.id,
  };

  const row = existing
    ? await tables.updateRow(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.profileDetails,
        user.authUser.id,
        payload,
      )
    : await tables.createRow(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.profileDetails,
        user.authUser.id,
        {
          ...payload,
          createdAt: now,
        },
      );

  await safeVolunteerAuditLog({
    action: "VOLUNTEER_PROFILE_UPDATED",
    actorUserId: user.authUser.id,
    metadata: { changedFields: Object.keys(details) },
    targetId: user.authUser.id,
    targetType: "volunteer_profile",
  });

  return toVolunteerProfileDetails(row as AppRow);
}

export async function getVolunteerProfileSummary(
  userId: string,
  {
    viewer,
  }: {
    viewer?: SessionUser | null;
  } = {},
): Promise<VolunteerProfileSummary | null> {
  const profile = await getProfile(userId);

  if (!profile || !canShowVolunteerProfile(profile)) {
    return null;
  }

  const isPrivateView = canViewPrivateVolunteerProfile({
    profileUserId: profile.authUserId,
    viewer,
  });
  const [details, sbRoles, eventRoles] = await Promise.all([
    getVolunteerProfileDetails(userId),
    getVolunteerSummarySbRoles(userId),
    getVolunteerSummaryEventRoles(userId),
  ]);

  const mappedEventRoles = eventRoles.map((role) => ({
    committeeName: role.committeeName,
    eventId: role.eventId,
    eventTitle: role.eventTitle,
    role: role.role,
  }));

  return {
    details: isPrivateView ? details : toPublicVolunteerProfileDetails(details),
    // Event contributions are shared on public profiles; emails/academic IDs stay private.
    eventRoles: mappedEventRoles,
    googleEmail: isPrivateView ? profile.googleEmail : undefined,
    isPrivateView,
    name: profile.name,
    sbRoles: isPrivateView ? sbRoles : [],
    uomEmail: isPrivateView ? profile.uomEmail : undefined,
    userId,
  };
}

async function getVolunteerSummarySbRoles(userId: string) {
  try {
    return await getActiveSbRoles(userId);
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return [];
    }

    throw error;
  }
}

async function getVolunteerSummaryEventRoles(userId: string) {
  try {
    return await getActiveEventRoleAssignments(userId);
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return [];
    }

    throw error;
  }
}

function normalizeSearchValue(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export async function listVerifiedVolunteers({
  limit = 50,
  offset = 0,
  term = "",
}: {
  limit?: number;
  offset?: number;
  term?: string;
} = {}): Promise<{ items: VolunteerDirectoryItem[]; total: number }> {
  const pageSize = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);
  const pageOffset = Math.max(Math.trunc(offset) || 0, 0);
  const query = normalizeSearchValue(term);

  const [profiles, assignments] = await Promise.all([
    listProfiles(),
    listActiveEventRoleAssignments(),
  ]);

  const eventCounts = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    if (!assignment.active) {
      continue;
    }
    const current = eventCounts.get(assignment.userId) ?? new Set<string>();
    current.add(assignment.eventId);
    eventCounts.set(assignment.userId, current);
  }

  const matched = profiles.filter(canShowVolunteerProfile).filter((profile) => {
    if (!query) {
      return true;
    }

    const haystack = [profile.name, profile.googleEmail, profile.uomEmail]
      .map(normalizeSearchValue)
      .join(" ");

    return haystack.includes(query);
  });

  matched.sort((a, b) => {
    const aName = normalizeSearchValue(a.name) || normalizeSearchValue(a.googleEmail);
    const bName = normalizeSearchValue(b.name) || normalizeSearchValue(b.googleEmail);
    return aName.localeCompare(bName);
  });

  const total = matched.length;
  const page = matched.slice(pageOffset, pageOffset + pageSize);
  const details = await Promise.all(
    page.map((profile) => getVolunteerProfileDetails(profile.authUserId)),
  );

  const items: VolunteerDirectoryItem[] = page.map((profile, index) => {
    const detail = details[index];
    return {
      userId: profile.authUserId,
      name: profile.name?.trim() || profile.googleEmail || "Verified volunteer",
      headline: detail?.headline,
      skills: detail?.skills,
      eventCount: eventCounts.get(profile.authUserId)?.size ?? 0,
    };
  });

  return { items, total };
}
