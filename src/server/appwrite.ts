import "server-only";

import { Account, Client, Query, TablesDB, Users } from "node-appwrite";
import { getServerEnv } from "@/lib/env";
import { isAppwriteUnauthorized } from "@/server/errors";

export function getAppwriteBaseClient() {
  const env = getServerEnv();

  return new Client()
    .setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);
}

export function getAppwriteAdminClient() {
  const env = getServerEnv();

  return getAppwriteBaseClient().setKey(env.APPWRITE_API_KEY);
}

export function getAppwriteSessionClient(sessionSecret: string) {
  return getAppwriteBaseClient().setSession(sessionSecret);
}

export function getAppwriteAdminServices() {
  const client = getAppwriteAdminClient();

  return {
    account: new Account(client),
    tables: new TablesDB(client),
    users: new Users(client),
  };
}

export function getAppwriteSessionServices(sessionSecret: string) {
  const client = getAppwriteSessionClient(sessionSecret);

  return {
    account: new Account(client),
    tables: new TablesDB(client),
  };
}

/**
 * Cheap admin call to confirm APPWRITE_API_KEY is accepted before OAuth.
 * Throws with a stable message when the key is revoked or under-scoped.
 */
export async function assertAppwriteApiKeyAuthorized() {
  const { users } = getAppwriteAdminServices();

  try {
    await users.list([Query.limit(1)]);
  } catch (error) {
    if (isAppwriteUnauthorized(error)) {
      throw new Error("APPWRITE_API_KEY_UNAUTHORIZED");
    }

    throw error;
  }
}
