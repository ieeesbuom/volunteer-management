#!/usr/bin/env node
/**
 * Seed the Appwrite Auth `admin` label on the user matching ADMIN_EMAIL.
 * Additive / safe: preserves existing labels; does not remove ADMIN_EMAIL.
 *
 * Usage:
 *   node scripts/appwrite/seed-admin-label.mjs
 *   node scripts/appwrite/seed-admin-label.mjs --dry-run
 */

import { Query } from "node-appwrite";
import { createAdminContext, loadLocalEnv, requireEnv } from "./client.mjs";

loadLocalEnv();
requireEnv(["ADMIN_EMAIL"]);

const dryRun = process.argv.includes("--dry-run");
const adminEmail = String(process.env.ADMIN_EMAIL).trim().toLowerCase();
const { users } = createAdminContext();

let listed;
try {
  listed = await users.list({
    queries: [Query.equal("email", adminEmail), Query.limit(5)],
    total: false,
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to list users: ${message}`);
  console.error(
    "APPWRITE_API_KEY / APPWRITE_SETUP_API_KEY need users.read + users.write (re-run npm run appwrite:keys).",
  );
  console.error(
    "CLI fallback: npx appwrite client --endpoint <ENDPOINT> --project-id <PROJECT_ID>",
  );
  console.error(
    "then: npx appwrite users update-labels --user-id <ID> --labels admin",
  );
  process.exit(1);
}

const matches = listed.users ?? [];

if (matches.length === 0) {
  console.error(`No Appwrite user found with email ${adminEmail}`);
  console.error(
    "If users.list failed earlier with 401, your APPWRITE_API_KEY lacks users.read/users.write.",
  );
  console.error(
    "Fallback: npx appwrite client --endpoint <ENDPOINT> --project-id <PROJECT_ID> && npx appwrite users update-labels --user-id <ID> --labels admin",
  );
  process.exit(1);
}

if (matches.length > 1) {
  console.warn(`Warning: ${matches.length} users matched ADMIN_EMAIL; updating all.`);
}

const ADMIN_LABEL = "admin";
let updated = 0;

for (const user of matches) {
  const current = Array.isArray(user.labels) ? [...user.labels] : [];
  if (current.includes(ADMIN_LABEL)) {
    console.log(`OK  ${user.$id} ${user.email} already has admin label`);
    continue;
  }

  const next = [...current, ADMIN_LABEL];
  console.log(`${dryRun ? "DRY" : "SET"} ${user.$id} ${user.email}`);
  console.log(`     labels: ${JSON.stringify(current)} -> ${JSON.stringify(next)}`);

  if (!dryRun) {
    await users.updateLabels({ userId: user.$id, labels: next });
  }
  updated += 1;
}

console.log(dryRun ? `Dry run complete (${updated} would update).` : `Done (${updated} updated).`);
