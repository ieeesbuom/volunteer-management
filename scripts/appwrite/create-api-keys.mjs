#!/usr/bin/env node
/**
 * Split Appwrite API keys into least-privilege runtime and setup keys.
 * Uses the logged-in Appwrite CLI session (requires keys.read/write on the console account).
 *
 * Usage:
 *   node scripts/appwrite/create-api-keys.mjs [--revoke-legacy]
 */

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./client.mjs";
import { runAppwriteCli } from "./cli.mjs";

loadLocalEnv();

const revokeLegacy = process.argv.includes("--revoke-legacy");
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim();

if (!projectId) {
  throw new Error("NEXT_PUBLIC_APPWRITE_PROJECT_ID is required.");
}

function runAppwrite(args) {
  return runAppwriteCli(args);
}

const RUNTIME_SCOPES = [
  "sessions.write",
  "rows.read",
  "rows.write",
  "users.read",
  // Profile avatar uploads/serving via server SDK (bucket stays client-locked)
  "files.read",
  "files.write",
];
const SETUP_SCOPES = [
  "databases.read",
  "databases.write",
  "tables.read",
  "tables.write",
  "columns.read",
  "columns.write",
  "indexes.read",
  "indexes.write",
  "rows.read",
  "rows.write",
  "users.read",
  "sessions.write",
  "files.read",
  "files.write",
  "buckets.read",
  "buckets.write",
  "keys.read",
  "keys.write",
];

const setupExpire = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
const runtimeKeyId = `vm_runtime_${createHash("sha1").update("runtime").digest("hex").slice(0, 16)}`;
const setupKeyId = `vm_setup_${createHash("sha1").update("setup").digest("hex").slice(0, 16)}`;

const existing = runAppwrite(["project", "list-keys", "--project-id", projectId, "--json"]);
const legacyKey = existing.keys?.find((key) => key.name === "developer-1-setup");

for (const key of existing.keys ?? []) {
  if (key.name === "volunteer-management-runtime" || key.name === "volunteer-management-setup") {
    runAppwrite(["project", "delete-key", "--project-id", projectId, "--key-id", key.$id, "--json"]);
  }
}

const runtime = runAppwrite([
  "project",
  "create-key",
  "--project-id",
  projectId,
  "--key-id",
  runtimeKeyId,
  "--name",
  "volunteer-management-runtime",
  ...RUNTIME_SCOPES.flatMap((scope) => ["--scopes", scope]),
  "--show-secrets",
  "--json",
]);

const setup = runAppwrite([
  "project",
  "create-key",
  "--project-id",
  projectId,
  "--key-id",
  setupKeyId,
  "--name",
  "volunteer-management-setup",
  ...SETUP_SCOPES.flatMap((scope) => ["--scopes", scope]),
  "--expire",
  setupExpire,
  "--show-secrets",
  "--json",
]);

const outputPath = path.join(process.cwd(), ".appwrite-key-rotation.json");
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      runtime: {
        id: runtime.$id,
        name: runtime.name,
        scopes: RUNTIME_SCOPES,
        secret: runtime.secret,
      },
      setup: {
        id: setup.$id,
        name: setup.name,
        scopes: SETUP_SCOPES,
        expire: setupExpire,
        secret: setup.secret,
      },
      legacyKeyId: legacyKey?.$id ?? null,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);

console.log("Created runtime and setup API keys.");
console.log(`Secrets written to ${outputPath} (gitignored).`);
console.log("Update APPWRITE_API_KEY with the runtime secret before revoking the legacy key.");
console.log("Store APPWRITE_SETUP_API_KEY locally for setup/migration scripts only.");
console.log("");
console.log("Enable MFA on your Appwrite console account (Console → Account → Security).");

if (revokeLegacy && legacyKey?.$id) {
  runAppwrite(["project", "delete-key", "--project-id", projectId, "--key-id", legacyKey.$id, "--json"]);
  console.log(`Revoked legacy key ${legacyKey.name}.`);
} else if (legacyKey?.$id) {
  console.log(`Legacy key "${legacyKey.name}" is still active. Re-run with --revoke-legacy after updating APPWRITE_API_KEY.`);
}
