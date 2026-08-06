import { adminApiKey, loadLocalEnv, requireEnv } from "./load-env.mjs";

loadLocalEnv();

process.env.FORCE_NODE_FETCH ??= "1";

const { Client, Project, Storage, TablesDB, Users, Query } = await import("node-appwrite");

export function createAdminContext() {
  requireEnv([
    "NEXT_PUBLIC_APPWRITE_ENDPOINT",
    "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
    "NEXT_PUBLIC_APPWRITE_DATABASE_ID",
  ]);

  const apiKey = adminApiKey();

  if (!apiKey) {
    throw new Error("APPWRITE_API_KEY or APPWRITE_SETUP_API_KEY is required.");
  }

  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(apiKey);

  return {
    client,
    databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    project: new Project(client),
    storage: new Storage(client),
    tables: new TablesDB(client),
    users: new Users(client),
    Query,
  };
}

export { adminApiKey, loadLocalEnv, requireEnv };
