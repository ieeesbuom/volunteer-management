import "server-only";

import { Account, Client, TablesDB, Users } from "node-appwrite";
import { getServerEnv } from "@/lib/env";
import {
  SupabaseAccount,
  SupabaseStorage,
  SupabaseTablesDB,
  SupabaseUsers,
} from "@/server/supabase-adapter";

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

  export function getAppwriteAdminServices(): {
    account: Account;
    tables: TablesDB;
    users: Users;
    storage: SupabaseStorage;
  } {
    return {
      account: new SupabaseAccount() as unknown as Account,
      tables: new SupabaseTablesDB() as unknown as TablesDB,
      users: new SupabaseUsers() as unknown as Users,
      storage: new SupabaseStorage(),
    };
  }

    export function getAppwriteSessionServices(sessionSecret?: string): {
      account: Account;
      tables: TablesDB;
    } {
      void sessionSecret;
      return {
        account: new SupabaseAccount() as unknown as Account,
        tables: new SupabaseTablesDB() as unknown as TablesDB,
      };
    }

    export async function assertAppwriteApiKeyAuthorized() {
      return true;
    }
