import "server-only";

import { getServerEnv } from "@/lib/env";

export function getVerificationPepper() {
  const env = getServerEnv();
  return env.VERIFICATION_PEPPER ?? env.APPWRITE_API_KEY;
}
