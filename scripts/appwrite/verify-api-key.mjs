#!/usr/bin/env node
/**
 * Verify APPWRITE_API_KEY can perform the scopes required for Google login.
 *
 * Usage:
 *   node scripts/appwrite/verify-api-key.mjs
 */

import { Query } from "node-appwrite";
import { createAdminContext, loadLocalEnv } from "./client.mjs";

loadLocalEnv();

const { users, tables, databaseId } = createAdminContext();

async function check(name, fn) {
  try {
    await fn();
    console.log(`OK   ${name}`);
    return true;
  } catch (error) {
    console.log(
      `FAIL ${name}: ${error?.type ?? error?.name ?? "error"} ${error?.code ?? ""} ${error?.message ?? error}`,
    );
    return false;
  }
}

const results = [];
results.push(await check("users.read (users.list)", () => users.list([Query.limit(1)])));
results.push(
  await check("rows.read (profiles list)", () =>
    tables.listRows(databaseId, "profiles", [Query.limit(1)]),
  ),
);

if (!results.every(Boolean)) {
  console.error("");
  console.error("APPWRITE_API_KEY is unauthorized or under-scoped.");
  console.error("Create a runtime key with scopes:");
  console.error("  sessions.write, rows.read, rows.write, users.read, files.read, files.write");
  console.error("Then set APPWRITE_API_KEY in .env and restart the app.");
  console.error("Or: npx appwrite login && npm run appwrite:keys && npm run appwrite:keys:sync-env");
  process.exit(1);
}

console.log("");
console.log("APPWRITE_API_KEY is accepted for required admin scopes.");
