import { NextResponse } from "next/server";
import { createGoogleOAuthUrl } from "@/features/access-control/server/oauth";
import { enforceRateLimit, getClientIp, rateLimitKey, RATE_LIMITS } from "@/server/rate-limit";
import { getPublicAppOrigin } from "@/server/public-origin";
import { applyOAuthLoginNonceCookie, createOAuthLoginNonce } from "@/server/session";

export async function GET(request: Request) {
  const origin = getPublicAppOrigin(request);
  const url = new URL(request.url);

  if (url.searchParams.get("debug") === "1") {
    try {
      const authUrl = await createGoogleOAuthUrl(origin);
      return NextResponse.json({
        status: "ok",
        origin,
        authUrl,
        environment: {
          hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
          hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          hasAdminEmail: Boolean(process.env.ADMIN_EMAIL),
          adminEmail: process.env.ADMIN_EMAIL,
          hasAppUrl: Boolean(process.env.APP_URL),
          appUrl: process.env.APP_URL,
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          status: "error",
          origin,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          environment: {
            hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
            hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
            hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
            hasAdminEmail: Boolean(process.env.ADMIN_EMAIL),
            adminEmail: process.env.ADMIN_EMAIL,
            hasAppUrl: Boolean(process.env.APP_URL),
            appUrl: process.env.APP_URL,
          },
        },
        { status: 500 },
      );
    }
  }

  try {
    enforceRateLimit(
      rateLimitKey("auth-google", getClientIp(request)),
      RATE_LIMITS.authGooglePerIp,
    );
    const authUrl = await createGoogleOAuthUrl(origin);
    const response = NextResponse.redirect(authUrl);
    applyOAuthLoginNonceCookie(response, createOAuthLoginNonce());
    return response;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown OAuth start failure";
    logAuthStartFailure(error);
    const targetUrl = new URL("/login", origin);
    targetUrl.searchParams.set("error", "oauth_start_failed");
    targetUrl.searchParams.set("reason", reason);
    return NextResponse.redirect(targetUrl);
  }
}

function logAuthStartFailure(error: unknown) {
  const details =
    error instanceof Error
      ? {
          message: error.message,
          name: error.name,
          status: "code" in error ? error.code : undefined,
          type: "type" in error ? error.type : undefined,
        }
      : { message: "Unknown OAuth start failure" };

  console.error("[auth/google] Unable to start Google login", details);
}
