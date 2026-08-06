import "server-only";

import type { Models } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { parseSafeJsonObject } from "@/lib/validation/safe-json";
import { dashboardLayoutSchema } from "@/features/dashboard/validation";
import type { DashboardLayout, StoredDashboardLayout } from "@/features/dashboard/types";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { isAppwriteNotFound } from "@/server/errors";

type AppRow = Models.Row & Record<string, unknown>;

export type DashboardLayoutRepository = {
  getByUserId(userId: string): Promise<StoredDashboardLayout | null>;
  upsert(input: { userId: string; layout: DashboardLayout }): Promise<StoredDashboardLayout>;
};

function toStoredDashboardLayout(row: AppRow): StoredDashboardLayout {
  const raw = parseSafeJsonObject(row.layoutJson);
  const layout = dashboardLayoutSchema.parse(raw);

  return {
    userId: String(row.userId),
    layout,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export function createAppwriteDashboardLayoutRepository(): DashboardLayoutRepository {
  return {
    async getByUserId(userId) {
      const env = getServerEnv();
      const { tables } = getAppwriteAdminServices();

      try {
        const row = await tables.getRow<AppRow>(
          env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          APPWRITE_TABLES.dashboardLayouts,
          userId,
        );

        return toStoredDashboardLayout(row);
      } catch (error) {
        if (isAppwriteNotFound(error)) {
          return null;
        }

        throw error;
      }
    },

    async upsert({ userId, layout }) {
      const env = getServerEnv();
      const { tables } = getAppwriteAdminServices();
      const now = new Date().toISOString();
      const layoutJson = JSON.stringify(layout);
      const payload = {
        layoutJson,
        updatedAt: now,
        userId,
      };

      try {
        const row = await tables.updateRow<AppRow>(
          env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          APPWRITE_TABLES.dashboardLayouts,
          userId,
          payload,
        );

        return toStoredDashboardLayout(row);
      } catch (error) {
        if (!isAppwriteNotFound(error)) {
          throw error;
        }

        const row = await tables.createRow<AppRow>(
          env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          APPWRITE_TABLES.dashboardLayouts,
          userId,
          {
            ...payload,
            createdAt: now,
          },
        );

        return toStoredDashboardLayout(row);
      }
    },
  };
}
