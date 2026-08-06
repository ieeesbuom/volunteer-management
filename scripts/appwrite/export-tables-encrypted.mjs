#!/usr/bin/env node
/**
 * Encrypted-at-rest JSON export of all Appwrite tables (no PII enrichment; store offline securely).
 *
 * Usage:
 *   node scripts/appwrite/export-tables-encrypted.mjs --out ./backups/appwrite-export.json
 */

import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createAdminContext, loadLocalEnv } from "./client.mjs";

loadLocalEnv();

const outIndex = process.argv.indexOf("--out");
const outputPath =
  outIndex >= 0 ? path.resolve(process.argv[outIndex + 1]) : path.resolve("backups/appwrite-export.enc.json");

const passphrase = process.env.APPWRITE_BACKUP_PASSPHRASE?.trim();

if (!passphrase) {
  throw new Error("Set APPWRITE_BACKUP_PASSPHRASE before running encrypted exports.");
}

const { databaseId, tables, Query } = createAdminContext();

async function listTables() {
  const result = await tables.list({ total: false });

  return result.tables ?? [];
}

async function listAllRows(tableId) {
  const rows = [];
  let cursor = null;

  for (;;) {
    const queries = [Query.limit(100)];

    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const result = await tables.listRows(databaseId, tableId, queries);
    rows.push(...(result.rows ?? []));

    if ((result.rows ?? []).length < 100) {
      break;
    }

    cursor = result.rows[result.rows.length - 1].$id;
  }

  return rows;
}

const exportPayload = {
  exportedAt: new Date().toISOString(),
  databaseId,
  tables: {},
};

for (const table of await listTables()) {
  exportPayload.tables[table.$id] = await listAllRows(table.$id);
}

const plaintext = JSON.stringify(exportPayload);
const salt = randomBytes(16);
const iv = randomBytes(12);
const key = scryptSync(passphrase, salt, 32);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      version: 1,
      algorithm: "aes-256-gcm/scrypt",
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      digest: createHash("sha256").update(plaintext).digest("hex"),
      ciphertext: encrypted.toString("base64"),
    },
    null,
    2,
  ),
  { mode: 0o600 },
);

console.log(JSON.stringify({ outputPath, tableCount: Object.keys(exportPayload.tables).length }, null, 2));
