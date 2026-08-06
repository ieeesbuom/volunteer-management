import { NextResponse } from "next/server";
import { isAppwriteResourceId } from "@/features/access-control/lib/avatar-image";
import { readProfileAvatarBytes } from "@/features/access-control/server/profile-avatar";
import { enforceRateLimit, getClientIp, rateLimitKey, RATE_LIMITS } from "@/server/rate-limit";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    enforceRateLimit(
      rateLimitKey("profile-avatar-read", getClientIp(request)),
      RATE_LIMITS.profileAvatarReadPerIp,
    );

    const { userId } = await context.params;

    if (!isAppwriteResourceId(userId)) {
      return new NextResponse(null, { status: 404 });
    }

    const avatar = await readProfileAvatarBytes(userId);

    if (!avatar) {
      return new NextResponse(null, { status: 404 });
    }

    const etag = `"${userId}-${avatar.updatedAt ?? avatar.body.byteLength}"`;
    const ifNoneMatch = request.headers.get("if-none-match");

    // Revalidate with ETag so replacements appear immediately without long stale caches.
    const cacheControl = "public, max-age=0, must-revalidate";

    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        headers: {
          ETag: etag,
          "Cache-Control": cacheControl,
        },
        status: 304,
      });
    }

    return new NextResponse(new Uint8Array(avatar.body), {
      headers: {
        "Cache-Control": cacheControl,
        "Content-Type": avatar.contentType,
        "Content-Length": String(avatar.body.byteLength),
        "X-Content-Type-Options": "nosniff",
        ETag: etag,
      },
      status: 200,
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
