import { z } from "zod";

const optionalEmail = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().email().optional(),
);

const optionalNumber = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const optionalBooleanString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .enum(["true", "false"])
    .optional()
    .transform((option) => option === "true"),
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl.default("https://placeholder.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString.default("placeholder-anon-key"),
  SUPABASE_SERVICE_ROLE_KEY: optionalString.default("placeholder-service-role-key"),
  NEXT_PUBLIC_APPWRITE_ENDPOINT: optionalUrl.default("https://cloud.appwrite.io/v1"),
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: optionalString.default("placeholder"),
  NEXT_PUBLIC_APPWRITE_DATABASE_ID: optionalString.default("placeholder"),
  APPWRITE_API_KEY: optionalString.default("placeholder"),
  APPWRITE_SETUP_API_KEY: optionalString,
  ADMIN_EMAIL: z.string().email(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalNumber,
  SMTP_SECURE: optionalBooleanString,
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM_EMAIL: optionalEmail,
  SMTP_FROM_NAME: optionalString,
  INTERNAL_JOB_TOKEN: optionalString,
  VERIFICATION_PEPPER: optionalString,
  NOTIFICATION_EMAILS_ENABLED: optionalBooleanString,
  APP_URL: optionalUrl,
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl.default("https://placeholder.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString.default("placeholder-anon-key"),
  NEXT_PUBLIC_APPWRITE_ENDPOINT: optionalUrl.default("https://cloud.appwrite.io/v1"),
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: optionalString.default("placeholder"),
  NEXT_PUBLIC_APPWRITE_DATABASE_ID: optionalString.default("placeholder"),
});

export function getServerEnv() {
  return serverEnvSchema.parse(process.env);
}

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APPWRITE_ENDPOINT: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
    NEXT_PUBLIC_APPWRITE_PROJECT_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
  });
}
