import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/appwrite", () => ({
  getAppwriteAdminServices: () => ({ storage: {} }),
}));

import { resolveAuthAvatarUrl } from "@/features/access-control/server/profile-avatar";

describe("profile avatar resolution and Google fallback", () => {
  const userId = "volunteer-123";
  const googleAvatar = "https://lh3.googleusercontent.com/a/volunteer-photo=s96-c";

  it("prioritizes custom uploaded avatar over Google avatar", () => {
    const resolved = resolveAuthAvatarUrl({
      avatarFileId: userId,
      googleAvatarUrl: googleAvatar,
      userId,
    });

    expect(resolved).toBe(`/api/avatars/${userId}`);
  });

  it("falls back to Google avatar when no custom avatar is uploaded", () => {
    const resolved = resolveAuthAvatarUrl({
      avatarFileId: undefined,
      googleAvatarUrl: googleAvatar,
      userId,
    });

    expect(resolved).toBe(googleAvatar);
  });

  it("falls back to Google avatar when custom avatar is cleared", () => {
    const resolved = resolveAuthAvatarUrl({
      avatarFileId: undefined,
      googleAvatarUrl: googleAvatar,
      userId,
    });

    expect(resolved).toBe(googleAvatar);
  });

  it("returns undefined when neither custom nor Google avatar exists", () => {
    const resolved = resolveAuthAvatarUrl({
      avatarFileId: undefined,
      googleAvatarUrl: undefined,
      userId,
    });

    expect(resolved).toBeUndefined();
  });
});
