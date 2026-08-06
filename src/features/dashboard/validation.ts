import { z } from "zod";
import { DASHBOARD_WIDGET_TYPES } from "@/features/dashboard/lib/widget-types";

const GRID_COLS = 12;
const MAX_ITEMS = 24;
const MAX_COORD = 100;
const MAX_SIZE = 12;

export const dashboardLayoutItemSchema = z.object({
  instanceId: z.string().min(1).max(64),
  widgetType: z.enum(DASHBOARD_WIDGET_TYPES),
  x: z.number().int().min(0).max(MAX_COORD),
  y: z.number().int().min(0).max(MAX_COORD),
  w: z.number().int().min(1).max(MAX_SIZE),
  h: z.number().int().min(1).max(MAX_SIZE),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const dashboardLayoutSchema = z
  .object({
    version: z.literal(1),
    items: z.array(dashboardLayoutItemSchema).max(MAX_ITEMS),
  })
  .superRefine((layout, ctx) => {
    const ids = new Set<string>();

    for (const [index, item] of layout.items.entries()) {
      if (item.x + item.w > GRID_COLS) {
        ctx.addIssue({
          code: "custom",
          message: `Widget at index ${index} extends past the grid (${GRID_COLS} columns).`,
          path: ["items", index, "w"],
        });
      }

      if (ids.has(item.instanceId)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate instanceId: ${item.instanceId}`,
          path: ["items", index, "instanceId"],
        });
      }

      ids.add(item.instanceId);
    }
  });

export type DashboardLayoutInput = z.infer<typeof dashboardLayoutSchema>;
