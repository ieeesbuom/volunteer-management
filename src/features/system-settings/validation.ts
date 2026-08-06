import { z } from "zod";
import { EVENT_ROLES, SB_ROLES } from "@/lib/config";
import {
  EVENT_ROLE_POWERS,
  SB_ROLE_POWERS,
} from "@/features/system-settings/lib/rules";

const sbRoleSchema = z.enum(SB_ROLES);
const eventRoleSchema = z.enum(EVENT_ROLES);

const sbPowerIds = SB_ROLE_POWERS.map((power) => power.id) as [string, ...string[]];
const eventPowerIds = EVENT_ROLE_POWERS.map((power) => power.id) as [string, ...string[]];

const sbPowerSchema = z.enum(sbPowerIds);
const eventPowerSchema = z.enum(eventPowerIds);

export const updateRolePermissionsSchema = z
  .object({
    eventRolePowers: z.record(eventRoleSchema, z.array(eventPowerSchema)).optional(),
    sbRolePowers: z.record(sbRoleSchema, z.array(sbPowerSchema)).optional(),
  })
  .strict();

export const auditLogsQuerySchema = z
  .object({
    action: z.string().trim().min(1).max(128).optional(),
    actorUserId: z.string().trim().min(1).max(128).optional(),
    cursor: z.string().trim().min(1).max(128).optional(),
    dateFrom: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "dateFrom must use YYYY-MM-DD.")
      .optional(),
    dateTo: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "dateTo must use YYYY-MM-DD.")
      .optional(),
    limit: z.coerce.number().int().min(1).max(99).default(25),
    targetId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();
