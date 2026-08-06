import "server-only";

import sharp from "sharp";
import { Storage, type Models } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import {
  customAvatarUrl,
  detectProfileAvatarMime,
  extensionForAvatarMime,
  PROFILE_AVATAR_DIMENSION,
  PROFILE_AVATAR_MAX_BYTES,
  PROFILE_AVATAR_OUTPUT_MAX_BYTES,
  profileAvatarFileId,
  type ProfileAvatarMime,
} from "@/features/access-control/lib/avatar-image";
import { APPWRITE_BUCKETS, APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminClient, getAppwriteAdminServices } from "@/server/appwrite";
import { isAppwriteNotFound, ValidationError } from "@/server/errors";
import type { Profile } from "@/features/access-control/types";
import { getProfile, toProfile } from "@/features/access-control/server/profiles";

type AppRow = Models.Row & Record<string, unknown>;

type SanitizedAvatar = {
  buffer: Buffer;
  mime: ProfileAvatarMime;
  filename: string;
};

function getAdminStorage() {
  return new Storage(getAppwriteAdminClient());
}

/**
 * Validate and re-encode the upload so EXIF/polyglot payloads cannot survive.
 * Output is always a square WebP under a hard size cap.
 */
export async function sanitizeProfileAvatarUpload(input: Buffer): Promise<SanitizedAvatar> {
  if (input.byteLength === 0) {
    throw new ValidationError("Choose an image to upload.");
  }

  if (input.byteLength > PROFILE_AVATAR_MAX_BYTES) {
    throw new ValidationError("Profile photo must be 2 MB or smaller.");
  }

  const detected = detectProfileAvatarMime(new Uint8Array(input));

  if (!detected) {
    throw new ValidationError("Only JPEG, PNG, or WebP images are allowed.");
  }

  let processed: Buffer;

  try {
    processed = await sharp(input, {
      animated: false,
      failOn: "error",
      limitInputPixels: PROFILE_AVATAR_DIMENSION * PROFILE_AVATAR_DIMENSION * 16,
    })
      .rotate()
      .resize(PROFILE_AVATAR_DIMENSION, PROFILE_AVATAR_DIMENSION, {
        fit: "cover",
        position: "centre",
        withoutEnlargement: false,
      })
      .webp({
        effort: 4,
        quality: 82,
      })
      .toBuffer();
  } catch {
    throw new ValidationError("The file could not be processed as a valid image.");
  }

  if (processed.byteLength === 0 || processed.byteLength > PROFILE_AVATAR_OUTPUT_MAX_BYTES) {
    throw new ValidationError("Processed image is too large. Try a simpler photo.");
  }

  // Defense in depth: confirm sharp output is still a real WebP.
  if (detectProfileAvatarMime(new Uint8Array(processed)) !== "image/webp") {
    throw new ValidationError("Processed image failed validation.");
  }

  const mime: ProfileAvatarMime = "image/webp";

  return {
    buffer: processed,
    filename: `avatar.${extensionForAvatarMime(mime)}`,
    mime,
  };
}

async function deleteAvatarFile(fileId: string) {
  const storage = getAdminStorage();

  try {
    await storage.deleteFile({
      bucketId: APPWRITE_BUCKETS.profileAvatars,
      fileId,
    });
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }
  }
}

export async function uploadProfileAvatar({
  userId,
  bytes,
}: {
  userId: string;
  bytes: Buffer;
}): Promise<{ avatarUrl: string; profile: Profile }> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const storage = getAdminStorage();
  const sanitized = await sanitizeProfileAvatarUpload(bytes);
  const fileId = profileAvatarFileId(userId);

  await deleteAvatarFile(fileId);

  await storage.createFile({
    bucketId: APPWRITE_BUCKETS.profileAvatars,
    fileId,
    // Empty permissions: clients cannot read/write Appwrite storage directly.
    // Images are served only through our authenticated/proxy API route.
    file: InputFile.fromBuffer(sanitized.buffer, sanitized.filename),
    permissions: [],
  });

  const row = await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.profiles,
    userId,
    { avatarFileId: fileId },
  );

  const profile = toProfile(row as unknown as AppRow);

  return {
    avatarUrl: customAvatarUrl(userId, Date.now()),
    profile,
  };
}

export async function removeProfileAvatar(userId: string): Promise<{
  avatarUrl?: string;
  profile: Profile;
}> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const profile = await getProfile(userId);

  if (!profile) {
    throw new ValidationError("Profile not found.");
  }

  if (profile.avatarFileId) {
    await deleteAvatarFile(profile.avatarFileId);
  } else {
    // Clean orphaned deterministic file if profile row lost the pointer.
    await deleteAvatarFile(profileAvatarFileId(userId));
  }

  const row = await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.profiles,
    userId,
    { avatarFileId: null },
  );

  return {
    profile: toProfile(row as unknown as AppRow),
  };
}

export async function readProfileAvatarBytes(userId: string): Promise<{
  body: Buffer;
  contentType: ProfileAvatarMime;
  updatedAt?: string;
} | null> {
  const profile = await getProfile(userId);

  if (!profile?.avatarFileId || profile.avatarFileId !== profileAvatarFileId(userId)) {
    return null;
  }

  if (profile.status === "DISABLED") {
    return null;
  }

  const storage = getAdminStorage();

  try {
    const [meta, download] = await Promise.all([
      storage.getFile({
        bucketId: APPWRITE_BUCKETS.profileAvatars,
        fileId: profile.avatarFileId,
      }),
      storage.getFileDownload({
        bucketId: APPWRITE_BUCKETS.profileAvatars,
        fileId: profile.avatarFileId,
      }),
    ]);

    const body = Buffer.from(download);
    const detected = detectProfileAvatarMime(new Uint8Array(body));

    if (!detected) {
      return null;
    }

    return {
      body,
      contentType: detected,
      updatedAt: meta.$updatedAt,
    };
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export function resolveAuthAvatarUrl({
  avatarFileId,
  googleAvatarUrl,
  userId,
}: {
  avatarFileId?: string;
  googleAvatarUrl?: string;
  userId: string;
}): string | undefined {
  if (avatarFileId && avatarFileId === profileAvatarFileId(userId)) {
    return customAvatarUrl(userId);
  }

  return googleAvatarUrl;
}
