import { canVolunteer } from "@/features/access-control/lib/rules";
import { requireAuth } from "@/features/access-control/server/current-user";
import { downloadLavaFormFile } from "@/features/forms/server/lava-form-files";
import { isValidAppwriteId } from "@/features/forms/lib/lava-form-mappers";
import { ForbiddenError, jsonError, jsonRouteError, NotFoundError, ValidationError } from "@/server/errors";
import { enforceRateLimit, getClientIp, rateLimitKey, RATE_LIMITS } from "@/server/rate-limit";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth();
    if (!user.isAdmin && !canVolunteer(user.profile)) {
      throw new ForbiddenError("Verified UoM email is required before volunteering.");
    }

    enforceRateLimit(
      rateLimitKey("lava-form-file-read", getClientIp(request)),
      RATE_LIMITS.lavaFormFileReadPerIp,
    );

    const { fileId } = await context.params;
    if (!isValidAppwriteId(fileId)) {
      throw new ValidationError("Invalid file reference.");
    }

    const file = await downloadLavaFormFile(fileId);
    return new Response(new Uint8Array(file.buffer), {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
        "Content-Type": file.mimeType,
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return jsonError("File was not found.", 404);
    }

    return jsonRouteError(error, "Could not load form file.");
  }
}
