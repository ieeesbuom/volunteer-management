export const PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_AVATAR_OUTPUT_MAX_BYTES = 512 * 1024;
export const PROFILE_AVATAR_DIMENSION = 512;

export const PROFILE_AVATAR_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProfileAvatarMime = (typeof PROFILE_AVATAR_ALLOWED_MIME)[number];

export function isAppwriteResourceId(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(value);
}

export function profileAvatarFileId(userId: string): string {
  if (!isAppwriteResourceId(userId)) {
    throw new Error("Invalid user id.");
  }

  return userId;
}

export function customAvatarUrl(userId: string, cacheBust?: string | number): string {
  const base = `/api/avatars/${encodeURIComponent(userId)}`;
  return cacheBust === undefined ? base : `${base}?v=${encodeURIComponent(String(cacheBust))}`;
}

function bytesStartWith(buffer: Uint8Array, signature: number[]): boolean {
  if (buffer.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => buffer[index] === byte);
}

/** Detect image type from magic bytes only — never trust client Content-Type or filename. */
export function detectProfileAvatarMime(buffer: Uint8Array): ProfileAvatarMime | null {
  if (bytesStartWith(buffer, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (
    bytesStartWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "image/png";
  }

  // RIFF....WEBP
  if (
    buffer.length >= 12 &&
    bytesStartWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function extensionForAvatarMime(mime: ProfileAvatarMime): "jpg" | "png" | "webp" {
  if (mime === "image/jpeg") {
    return "jpg";
  }

  if (mime === "image/png") {
    return "png";
  }

  return "webp";
}
