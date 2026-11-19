import { NextResponse } from "next/server";
import { APPWRITE_SESSION_COOKIE } from "@/lib/appwrite/constants";
import { getAppwriteSessionServices } from "@/server/appwrite";
import { getPublicAppOrigin } from "@/server/public-origin";
import { getSessionSecret } from "@/server/session";
import { getSupabaseServerClient } from "@/server/supabase";

const clearCookieOptions = {
  httpOnly: true,
  maxAge: 0,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export async function POST(request: Request) {
  return logout(request);
}

async function logout(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Non-fatal if session already invalidated
  }

  const sessionSecret = await getSessionSecret();

  if (sessionSecret) {
    try {
      const { account } = getAppwriteSessionServices(sessionSecret);
      await account.deleteSession("current");
    } catch {
      // Session may already be invalid; clearing the local cookie is still correct.
    }
  }

  const response = NextResponse.redirect(new URL("/login", getPublicAppOrigin(request)), 303);
  response.cookies.set(APPWRITE_SESSION_COOKIE, "", clearCookieOptions);

  return response;
}
