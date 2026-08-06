import { describe, expect, it } from "vitest";
import {
  customAvatarUrl,
  detectProfileAvatarMime,
  isAppwriteResourceId,
  profileAvatarFileId,
} from "@/features/access-control/lib/avatar-image";

describe("avatar image helpers", () => {
  it("accepts valid Appwrite resource ids", () => {
    expect(isAppwriteResourceId("abc123")).toBe(true);
    expect(isAppwriteResourceId("../etc/passwd")).toBe(false);
    expect(isAppwriteResourceId("")).toBe(false);
  });

  it("detects image types from magic bytes only", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const webp = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const exe = Uint8Array.from([0x00, 0x01, 0x02, 0x03]);

    expect(detectProfileAvatarMime(jpeg)).toBe("image/jpeg");
    expect(detectProfileAvatarMime(png)).toBe("image/png");
    expect(detectProfileAvatarMime(webp)).toBe("image/webp");
    expect(detectProfileAvatarMime(exe)).toBeNull();
  });

  it("builds stable same-origin avatar urls", () => {
    expect(profileAvatarFileId("user123")).toBe("user123");
    expect(customAvatarUrl("user123")).toBe("/api/avatars/user123");
    expect(customAvatarUrl("user123", 99)).toBe("/api/avatars/user123?v=99");
  });
});
