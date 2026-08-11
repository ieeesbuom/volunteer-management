import { NextResponse } from "next/server";
import { requireAuth } from "@/features/access-control/server/current-user";
import {
  removeProfileAvatar,
  resolveAuthAvatarUrl,
  uploadProfileAvatar,
} from "@/features/access-control/server/profile-avatar";
import { ensureGoogleAvatarUrl, readAvatarUrlFromPrefs } from "@/features/access-control/server/google-avatar";
import { PROFILE_AVATAR_MAX_BYTES } from "@/features/access-control/lib/avatar-image";
import { getAppwriteSessionServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { jsonRouteError, ValidationError } from "@/server/errors";
import { enforceRateLimit, rateLimitKey, RATE_LIMITS } from "@/server/rate-limit";
import { getSessionSecret } from "@/server/session";

export const runtime = "nodejs";

async function resolveGoogleFallback(userId: string): Promise<string | undefined> {
  const sessionSecret = await getSessionSecret();

  if (!sessionSecret) {
    return undefined;
  }

  const { account } = getAppwriteSessionServices(sessionSecret);
  const appwriteUser = await account.get();

  if (appwriteUser.$id !== userId) {
    return undefined;
  }

  const cached = readAvatarUrlFromPrefs(appwriteUser.prefs);
  return cached ?? ensureGoogleAvatarUrl(account);
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    enforceRateLimit(
      rateLimitKey("profile-avatar-write", user.authUser.id),
      RATE_LIMITS.profileAvatarWritePerUser,
      "Too many profile photo updates. Please try again later.",
    );

    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw new ValidationError("Upload the photo as multipart form data.");
    }

    const formData = await request.formData();
    const file = formData.get("avatar");

    if (!(file instanceof File)) {
      throw new ValidationError("Choose an image to upload.");
    }

    // Reject oversized payloads before buffering into memory.
    if (typeof file.size === "number" && file.size > PROFILE_AVATAR_MAX_BYTES) {
      throw new ValidationError("Profile photo must be 2 MB or smaller.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await uploadProfileAvatar({
      bytes,
      userId: user.authUser.id,
    });

    try {
      await writeAuditLog({
        action: "PROFILE_AVATAR_UPDATED",
        actorUserId: user.authUser.id,
        metadata: { fileId: result.profile.avatarFileId },
        targetId: user.authUser.id,
        targetType: "profile",
      });
    } catch (auditError) {
      console.error("Profile avatar audit log failed", auditError);
    }

    return NextResponse.json({
      avatarUrl: result.avatarUrl,
      profile: result.profile,
    });
  } catch (error) {
    return jsonRouteError(error, "Profile photo upload failed.");
  }
}

export async function DELETE() {
  try {
    const user = await requireAuth();
    enforceRateLimit(
      rateLimitKey("profile-avatar-write", user.authUser.id),
      RATE_LIMITS.profileAvatarWritePerUser,
      "Too many profile photo updates. Please try again later.",
    );

    const result = await removeProfileAvatar(user.authUser.id);
    const googleAvatarUrl = await resolveGoogleFallback(user.authUser.id);

    try {
      await writeAuditLog({
        action: "PROFILE_AVATAR_REMOVED",
        actorUserId: user.authUser.id,
        metadata: {},
        targetId: user.authUser.id,
        targetType: "profile",
      });
    } catch (auditError) {
      console.error("Profile avatar audit log failed", auditError);
    }

    return NextResponse.json({
      avatarUrl: resolveAuthAvatarUrl({
        avatarFileId: result.profile.avatarFileId,
        googleAvatarUrl,
        userId: user.authUser.id,
      }),
      profile: result.profile,
    });
  } catch (error) {
    return jsonRouteError(error, "Could not remove profile photo.");
  }
}
