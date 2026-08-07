#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const appwriteBin = path.join(process.cwd(), "node_modules", ".bin", "appwrite");
const output = execFileSync(appwriteBin, ["project", "list-keys", "--show-secrets", "--json"], {
  encoding: "utf8",
});
const jsonStart = output.indexOf("{");
const keysPayload = JSON.parse(output.slice(jsonStart));
const runtime = keysPayload.keys.find((key) => key.name === "volunteer-management-runtime");
const setup = keysPayload.keys.find((key) => key.name === "volunteer-management-setup");

if (!runtime || !setup) {
  throw new Error("Expected runtime and setup keys to exist. Run npm run appwrite:keys first.");
}

function upsertEnvKeys(envPath) {
  const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const out = [];
  const seen = new Set();

  for (const line of lines) {
    if (!line || line.startsWith("#") || !line.includes("=")) {
      out.push(line);
      continue;
    }

    const index = line.indexOf("=");
    const key = line.slice(0, index);

    if (key === "APPWRITE_API_KEY") {
      out.push(`APPWRITE_API_KEY=${runtime.secret}`);
      seen.add(key);
      continue;
    }

    if (key === "APPWRITE_SETUP_API_KEY") {
      out.push(`APPWRITE_SETUP_API_KEY=${setup.secret}`);
      seen.add(key);
      continue;
    }

    out.push(line);
  }

  if (!seen.has("APPWRITE_API_KEY")) {
    out.push(`APPWRITE_API_KEY=${runtime.secret}`);
  }

  if (!seen.has("APPWRITE_SETUP_API_KEY")) {
    out.push(`APPWRITE_SETUP_API_KEY=${setup.secret}`);
  }

  writeFileSync(envPath, `${out.filter((line, index, arr) => !(line === "" && arr[index - 1] === "")).join("\n").replace(/\n*$/, "\n")}`, {
    mode: 0o600,
  });
}

const envPaths = [".env", ".env.local"].map((file) => path.join(process.cwd(), file));
const existingEnvPaths = envPaths.filter((envPath) => existsSync(envPath));

if (existingEnvPaths.length === 0) {
  upsertEnvKeys(path.join(process.cwd(), ".env"));
} else {
  for (const envPath of existingEnvPaths) {
    upsertEnvKeys(envPath);
  }
}

writeFileSync(
  path.join(process.cwd(), ".appwrite-key-rotation.json"),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      runtime: { id: runtime.$id, name: runtime.name, secret: runtime.secret },
      setup: { id: setup.$id, name: setup.name, secret: setup.secret },
    },
    null,
    2,
  ),
  { mode: 0o600 },
);

console.log("Synced APPWRITE_API_KEY and APPWRITE_SETUP_API_KEY from Appwrite CLI.");
console.log(`Updated: ${(existingEnvPaths.length ? existingEnvPaths : [path.join(process.cwd(), ".env")]).join(", ")}`);
