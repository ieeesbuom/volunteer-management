import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";

let adminClientInstance: SupabaseClient | null = null;

/**
 * Returns a Supabase client with the service role key.
 * This client bypasses Row Level Security (RLS) and is intended for
 * server-side data operations in Server Actions, Route Handlers, and background tasks.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const env = getServerEnv();

  if (!adminClientInstance) {
    adminClientInstance = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return adminClientInstance;
}

/**
 * Returns a cookie-aware Supabase client for the current request.
 * Reads and sets cookies using Next.js App Router cookies().
 * Use this to retrieve the currently authenticated user or session.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const env = getServerEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Can throw in Server Components where cookies are read-only.
          }
        },
      },
    },
  );
}
