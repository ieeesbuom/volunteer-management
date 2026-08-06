#!/usr/bin/env node
/**
 * Revoke Appwrite user sessions older than the configured threshold.
 *
 * Usage:
 *   node scripts/appwrite/revoke-stale-sessions.mjs [--days 30] [--keep-per-user 2]
 */

import { createAdminContext, loadLocalEnv } from "./client.mjs";

loadLocalEnv();

const daysIndex = process.argv.indexOf("--days");
const keepIndex = process.argv.indexOf("--keep-per-user");
const maxAgeDays = daysIndex >= 0 ? Number(process.argv[daysIndex + 1]) : 30;
const keepPerUser = keepIndex >= 0 ? Number(process.argv[keepIndex + 1]) : 2;

if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
  throw new Error("--days must be a positive number");
}

if (!Number.isFinite(keepPerUser) || keepPerUser < 0) {
  throw new Error("--keep-per-user must be zero or greater");
}

const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
const { users } = createAdminContext();

let revoked = 0;
let examined = 0;

const userList = await users.list({ total: false });
for (const user of userList.users ?? []) {
  const sessions = await users.listSessions({ userId: user.$id, total: false });
  const sorted = [...(sessions.sessions ?? [])].sort(
    (left, right) => Date.parse(right.$createdAt) - Date.parse(left.$createdAt),
  );

  for (const [index, session] of sorted.entries()) {
    examined += 1;
    const createdAt = Date.parse(session.$createdAt);
    const isRecent = Number.isFinite(createdAt) && createdAt >= cutoffMs;
    const withinKeepSet = index < keepPerUser;

    if (isRecent || withinKeepSet) {
      continue;
    }

    await users.deleteSession({ userId: user.$id, sessionId: session.$id });
    revoked += 1;
  }
}

console.log(JSON.stringify({ examined, revoked, maxAgeDays, keepPerUser }, null, 2));
