import "server-only";

import { getSupabaseServerClient } from "@/server/supabase";

export async function createGoogleOAuthUrl(origin: string) {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/api/auth/callback`,
        scopes: "email profile",
      },
    });

    if (error || !data?.url) {
      throw new Error(error?.message ?? "Failed to initialize Google OAuth.");
    }

    return data.url;
  }

  export async function createSessionFromOAuthToken({
    secret,
    userId,
  }: {
    secret: string;
    userId: string;
  }) {
    return {
      secret,
      userId,
      expire: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    };
  }
