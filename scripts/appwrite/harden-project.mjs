#!/usr/bin/env node
/**
 * Apply Appwrite project hardening via the logged-in Appwrite CLI session.
 *
 * Usage:
 *   node scripts/appwrite/harden-project.mjs [--production-hostname app.example.com]
 */

import { loadLocalEnv } from "./client.mjs";
import { runAppwriteCliVoid } from "./cli.mjs";

loadLocalEnv();

const hostnameArgIndex = process.argv.indexOf("--production-hostname");
const productionHostname =
  hostnameArgIndex >= 0 ? process.argv[hostnameArgIndex + 1]?.trim() : process.env.APPWRITE_PRODUCTION_HOSTNAME?.trim();

const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim();

if (!projectId) {
  throw new Error("NEXT_PUBLIC_APPWRITE_PROJECT_ID is required.");
}

const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;
const SESSION_LIMIT = 5;

const DISABLED_AUTH_METHODS = [
  "email-password",
  "magic-url",
  "email-otp",
  "anonymous",
  "invites",
  "jwt",
  "phone",
];

const DISABLED_SERVICES = [
  "avatars",
  // storage stays enabled for server-managed profile avatars; buckets remain locked down
  "teams",
  "functions",
  "graphql",
  "messaging",
  "sites",
];

const DISABLED_PROTOCOLS = ["graphql", "websocket"];

for (const methodId of DISABLED_AUTH_METHODS) {
  runAppwriteCliVoid([
    "project",
    "update-auth-method",
    "--project-id",
    projectId,
    "--method-id",
    methodId,
    "--enabled",
    "false",
  ]);
  console.log(`Disabled auth method: ${methodId}`);
}

runAppwriteCliVoid([
  "project",
  "update-session-duration-policy",
  "--project-id",
  projectId,
  "--duration",
  String(SESSION_DURATION_SECONDS),
]);
runAppwriteCliVoid([
  "project",
  "update-session-limit-policy",
  "--project-id",
  projectId,
  "--total",
  String(SESSION_LIMIT),
]);
runAppwriteCliVoid([
  "project",
  "update-session-alert-policy",
  "--project-id",
  projectId,
  "--enabled",
  "true",
]);
console.log(`Session duration=${SESSION_DURATION_SECONDS}s, limit=${SESSION_LIMIT}, alerts=on`);

for (const serviceId of DISABLED_SERVICES) {
  try {
    runAppwriteCliVoid([
      "project",
      "update-service",
      "--project-id",
      projectId,
      "--service-id",
      serviceId,
      "--enabled",
      "false",
    ]);
    console.log(`Disabled service: ${serviceId}`);
  } catch (error) {
    console.warn(`Could not disable service ${serviceId}: ${error instanceof Error ? error.message : error}`);
  }
}

for (const protocolId of DISABLED_PROTOCOLS) {
  try {
    runAppwriteCliVoid([
      "project",
      "update-protocol",
      "--project-id",
      projectId,
      "--protocol-id",
      protocolId,
      "--enabled",
      "false",
    ]);
    console.log(`Disabled protocol: ${protocolId}`);
  } catch (error) {
    console.warn(`Could not disable protocol ${protocolId}: ${error instanceof Error ? error.message : error}`);
  }
}

if (productionHostname) {
  const platforms = runAppwriteCli([
    "project",
    "list-platforms",
    "--project-id",
    projectId,
    "--json",
  ]);
  const existing = platforms.platforms?.find(
    (platform) => platform.type === "web" && platform.hostname === productionHostname,
  );

  if (!existing) {
    runAppwriteCliVoid([
      "project",
      "create-platform",
      "--project-id",
      projectId,
      "--platform-id",
      `web_${productionHostname.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 24)}`,
      "--name",
      productionHostname,
      "--type",
      "web",
      "--hostname",
      productionHostname,
    ]);
    console.log(`Registered production web platform: ${productionHostname}`);
  } else {
    console.log(`Production web platform already registered: ${productionHostname}`);
  }
} else {
  console.log("Skipped production platform registration (set APPWRITE_PRODUCTION_HOSTNAME or --production-hostname).");
}

const legacyBucketId = "vm_files";

try {
  runAppwriteCliVoid([
    "storage",
    "update-bucket",
    "--bucket-id",
    legacyBucketId,
    "--name",
    "Volunteer Management Files (disabled)",
    "--file-security",
    "true",
    "--enabled",
    "false",
    "--maximum-file-size",
    "5000000",
    "--allowed-file-extensions",
    "pdf",
    "--allowed-file-extensions",
    "png",
    "--allowed-file-extensions",
    "jpg",
    "--allowed-file-extensions",
    "jpeg",
    "--encryption",
    "true",
    "--antivirus",
    "true",
  ]);
  console.log(`Restricted and disabled storage bucket: ${legacyBucketId}`);
} catch (error) {
  console.warn(
    `Bucket hardening skipped (${legacyBucketId}): ${error instanceof Error ? error.message : error}`,
  );
}

const conclusionReportBucketId = "conclusion_report_files";

function ensureConclusionReportBucket() {
  try {
    runAppwriteCliVoid([
      "storage",
      "update-bucket",
      "--bucket-id",
      conclusionReportBucketId,
      "--name",
      "Conclusion Report Files",
      "--file-security",
      "true",
      "--enabled",
      "true",
      "--maximum-file-size",
      "10485760",
      "--allowed-file-extensions",
      "pdf",
      "--compression",
      "none",
      "--encryption",
      "true",
      "--antivirus",
      "true",
    ]);
    console.log(`Hardened conclusion report bucket: ${conclusionReportBucketId}`);
  } catch {
    try {
      runAppwriteCliVoid([
        "storage",
        "create-bucket",
        "--bucket-id",
        conclusionReportBucketId,
        "--name",
        "Conclusion Report Files",
        "--file-security",
        "true",
        "--enabled",
        "true",
        "--maximum-file-size",
        "10485760",
        "--allowed-file-extensions",
        "pdf",
        "--compression",
        "none",
        "--encryption",
        "true",
        "--antivirus",
        "true",
      ]);
      console.log(`Created conclusion report bucket: ${conclusionReportBucketId}`);
    } catch (createError) {
      console.warn(
        `Bucket hardening skipped (${conclusionReportBucketId}): ${createError instanceof Error ? createError.message : createError}`,
      );
    }
  }
}

ensureConclusionReportBucket();

const lavaFormFilesBucketId = "lava_form_files";

function ensureLavaFormFilesBucket() {
  try {
    runAppwriteCliVoid([
      "storage",
      "update-bucket",
      "--bucket-id",
      lavaFormFilesBucketId,
      "--name",
      "Lava Form Files",
      "--file-security",
      "true",
      "--enabled",
      "true",
      "--maximum-file-size",
      "10485760",
      "--allowed-file-extensions",
      "jpg",
      "--allowed-file-extensions",
      "jpeg",
      "--allowed-file-extensions",
      "png",
      "--allowed-file-extensions",
      "webp",
      "--allowed-file-extensions",
      "gif",
      "--allowed-file-extensions",
      "pdf",
      "--allowed-file-extensions",
      "doc",
      "--allowed-file-extensions",
      "docx",
      "--allowed-file-extensions",
      "txt",
      "--allowed-file-extensions",
      "csv",
      "--allowed-file-extensions",
      "xlsx",
      "--compression",
      "none",
      "--encryption",
      "true",
      "--antivirus",
      "true",
    ]);
    console.log(`Hardened lava form files bucket: ${lavaFormFilesBucketId}`);
  } catch {
    try {
      runAppwriteCliVoid([
        "storage",
        "create-bucket",
        "--bucket-id",
        lavaFormFilesBucketId,
        "--name",
        "Lava Form Files",
        "--file-security",
        "true",
        "--enabled",
        "true",
        "--maximum-file-size",
        "10485760",
        "--allowed-file-extensions",
        "jpg",
        "--allowed-file-extensions",
        "jpeg",
        "--allowed-file-extensions",
        "png",
        "--allowed-file-extensions",
        "webp",
        "--allowed-file-extensions",
        "gif",
        "--allowed-file-extensions",
        "pdf",
        "--allowed-file-extensions",
        "doc",
        "--allowed-file-extensions",
        "docx",
        "--allowed-file-extensions",
        "txt",
        "--allowed-file-extensions",
        "csv",
        "--allowed-file-extensions",
        "xlsx",
        "--compression",
        "none",
        "--encryption",
        "true",
        "--antivirus",
        "true",
      ]);
      console.log(`Created lava form files bucket: ${lavaFormFilesBucketId}`);
    } catch (createError) {
      console.warn(
        `Bucket hardening skipped (${lavaFormFilesBucketId}): ${createError instanceof Error ? createError.message : createError}`,
      );
    }
  }
}

ensureLavaFormFilesBucket();

const avatarBucketId = "profile_avatars";

try {
  runAppwriteCliVoid([
    "storage",
    "update-bucket",
    "--bucket-id",
    avatarBucketId,
    "--name",
    "Profile Avatars",
    "--file-security",
    "true",
    "--enabled",
    "true",
    "--maximum-file-size",
    "2097152",
    "--allowed-file-extensions",
    "jpg",
    "--allowed-file-extensions",
    "jpeg",
    "--allowed-file-extensions",
    "png",
    "--allowed-file-extensions",
    "webp",
    "--compression",
    "none",
    "--encryption",
    "true",
    "--antivirus",
    "true",
    "--transformations",
    "true",
  ]);
  console.log(
    `Hardened profile avatar bucket (server-only permissions): ${avatarBucketId}`,
  );
} catch (error) {
  console.warn(
    `Bucket hardening skipped (${avatarBucketId}): ${error instanceof Error ? error.message : error}`,
  );
}

console.log("Appwrite project hardening complete.");
