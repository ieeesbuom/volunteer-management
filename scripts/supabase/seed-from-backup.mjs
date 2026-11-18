#!/usr/bin/env node
/**
 * Seed clean production dataset into Supabase.
 * Connects via Supabase Service Role key (admin) and seeds:
 *  - Sadeepa Herath (admin)
 *  - Ishan Hansaka (admin)
 *  - ieeeuom sb19 (admin bootstrap)
 *  - Active IEEE term 2025/26
 *  - Active system settings & UoM email claims
 *
 * Usage:
 *   node scripts/supabase/seed-from-backup.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Load environment variables from .env or .env.local
const envFiles = [".env.local", ".env"];
for (const envFile of envFiles) {
  const envPath = path.join(process.cwd(), envFile);
  if (!existsSync(envPath)) continue;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [rawKey, ...valueParts] = trimmed.split("=");
    const key = rawKey.trim();
    const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("==================================================");
  console.log("SEEDING PRODUCTION DATA TO SUPABASE");
  console.log("==================================================");

  // 1. Seed Profiles
  console.log("\n[1/4] Seeding Profiles...");
  const profilesToSeed = [
    {
      id: "6a1d96a258cf64a83736",
      authUserId: "6a1d96a258cf64a83736",
      googleEmail: "sadeepahearth@gmail.com",
      name: "Sadeepa Herath",
      uomEmail: "herathphsn.24@uom.lk",
      uomVerified: true,
      uomVerifiedAt: new Date().toISOString(),
      status: "ACTIVE",
      lastLoginAt: new Date().toISOString(),
    },
    {
      id: "6a1fbeab79b0056a56e0",
      authUserId: "6a1fbeab79b0056a56e0",
      googleEmail: "ishanhansakasilva@gmail.com",
      name: "Ishan Hansaka",
      uomEmail: "silvahih.22@uom.lk",
      uomVerified: true,
      uomVerifiedAt: "2026-07-05T05:26:27.762Z",
      status: "ACTIVE",
      lastLoginAt: new Date().toISOString(),
    },
    {
      id: "6ab7d199731f510ece32",
      authUserId: "6ab7d199731f510ece32",
      googleEmail: "ieeeuomsb19@gmail.com",
      name: "ieeeuom sb19",
      uomEmail: null,
      uomVerified: false,
      uomVerifiedAt: null,
      status: "ACTIVE",
      lastLoginAt: new Date().toISOString(),
    },
  ];

  for (const prof of profilesToSeed) {
    const { error } = await supabase.from("profiles").upsert(prof, { onConflict: "id" });
    if (error) {
      console.error(`Failed to upsert profile ${prof.googleEmail}:`, error.message);
    } else {
      console.log(`✓ Profile ready: ${prof.name} (${prof.googleEmail})`);
    }
  }

  // 2. Seed IEEE Terms
  console.log("\n[2/4] Seeding IEEE Terms...");
  const term = {
    id: "6a241c3d002fc18f3321",
    label: "2025/26",
    startDate: "2025-10-01",
    endDate: "2026-09-30",
    active: true,
    status: "ACTIVE",
    notes: "Active IEEE Term for SB UoM",
    createdBy: "6a1d96a258cf64a83736",
    updatedBy: "6a1d96a258cf64a83736",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { error: termError } = await supabase.from("ieee_terms").upsert(term, { onConflict: "id" });
  if (termError) {
    console.error("Failed to upsert IEEE term:", termError.message);
  } else {
    console.log(`✓ Active IEEE term ready: ${term.label} (${term.id})`);
  }

  // 3. Seed System Settings
  console.log("\n[3/4] Seeding System Settings...");
  const settings = [
    {
      id: "set_active_term",
      key: "active_term_id",
      value: "6a241c3d002fc18f3321",
      updatedBy: "system",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "set_active_ieee_term",
      key: "active_ieee_term_id",
      value: "6a241c3d002fc18f3321",
      updatedBy: "system",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "uec_herathphsn",
      key: "uom_email_claim:herathphsn.24@uom.lk",
      value: JSON.stringify({
        userId: "6a1d96a258cf64a83736",
        normalizedUomEmail: "herathphsn.24@uom.lk",
      }),
      updatedBy: "system",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "uec_silvahih",
      key: "uom_email_claim:silvahih.22@uom.lk",
      value: JSON.stringify({
        userId: "6a1fbeab79b0056a56e0",
        normalizedUomEmail: "silvahih.22@uom.lk",
      }),
      updatedBy: "system",
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const s of settings) {
    const { error: sError } = await supabase.from("system_settings").upsert(s, { onConflict: "id" });
    if (sError) {
      console.error(`Failed to upsert system setting ${s.key}:`, sError.message);
    } else {
      console.log(`✓ System setting ready: ${s.key} = ${s.value}`);
    }
  }

  // 4. Ensure Storage Buckets exist
  console.log("\n[4/4] Verifying Storage Buckets...");
  const buckets = ["profile_avatars", "conclusion_report_files", "lava_form_files"];
  for (const b of buckets) {
    const { error: bError } = await supabase.storage.createBucket(b, {
      public: b === "profile_avatars",
    });
    if (bError && !bError.message.includes("already exists")) {
      console.warn(`Notice on bucket ${b}:`, bError.message);
    } else {
      console.log(`✓ Storage bucket ready: ${b}`);
    }
  }

  console.log("\n==================================================");
  console.log("SUPABASE SEEDING COMPLETED SUCCESSFULLY");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
