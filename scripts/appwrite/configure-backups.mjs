#!/usr/bin/env node
/**
 * Configure Appwrite backup policy when the plan supports Backups API.
 *
 * Usage:
 *   node scripts/appwrite/configure-backups.mjs [--apply]
 */

import { createAdminContext, loadLocalEnv } from "./client.mjs";

loadLocalEnv();

const apply = process.argv.includes("--apply");
const { client, databaseId } = createAdminContext();
const { Backups } = await import("node-appwrite");

const policyId = "vm_daily_tables_backup";
const desired = {
  policyId,
  name: "Volunteer Management daily tables backup",
  services: ["tablesdb"],
  resourceId: databaseId,
  retention: 30,
  schedule: "0 3 * * *",
  enabled: true,
};

try {
  const backups = new Backups(client);
  const existing = await backups.listPolicies();
  const found = existing.policies?.find((policy) => policy.$id === policyId || policy.name === policyId);

  if (found) {
    console.log(JSON.stringify({ apply, status: "exists", policyId: found.$id, enabled: found.enabled }, null, 2));
    process.exit(0);
  }

  if (!apply) {
    console.log(JSON.stringify({ apply, status: "dry_run", desired }, null, 2));
    console.error("Dry run only. Re-run with --apply to create the backup policy.");
    process.exit(0);
  }

  const created = await backups.createPolicy(desired);
  console.log(JSON.stringify({ apply, status: "created", policyId: created.$id }, null, 2));
} catch (error) {
  console.log(
    JSON.stringify(
      {
        apply,
        status: "unsupported",
        message:
          error instanceof Error ? error.message : "Backup API unavailable on current plan. Use encrypted table exports instead.",
        fallback: "node scripts/appwrite/export-tables-encrypted.mjs",
      },
      null,
      2,
    ),
  );
}
