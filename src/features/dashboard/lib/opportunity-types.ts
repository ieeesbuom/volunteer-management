import type { FormConnection } from "@/features/forms/types";
import type { Event } from "@/features/events/types";

export interface DashboardOpportunityItem {
  conn: FormConnection;
  event: Event | undefined;
}
