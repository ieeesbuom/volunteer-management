import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const envFiles = [".env.local", ".env"];

export function loadLocalEnv(cwd = process.cwd()) {
  for (const envFile of envFiles) {
    const envPath = path.join(cwd, envFile);

    if (!existsSync(envPath)) {
      continue;
    }

    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [rawKey, ...valueParts] = trimmed.split("=");
      const key = rawKey.trim();
      const value = valueParts.join("=").trim();

      if (!process.env[key]) {
        process.env[key] = value.replace(/^["']|["']$/g, "");
      }
    }
  }
}

export function requireEnv(keys) {
  const missing = keys.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required env values: ${missing.join(", ")}`);
  }
}

export function createAppwriteClient(Client) {
  requireEnv([
    "NEXT_PUBLIC_APPWRITE_ENDPOINT",
    "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
    "APPWRITE_API_KEY",
  ]);

  return new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
}

export function adminApiKey() {
  return process.env.APPWRITE_SETUP_API_KEY?.trim() || process.env.APPWRITE_API_KEY?.trim();
}
