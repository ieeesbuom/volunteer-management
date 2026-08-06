import type { SessionUser } from "@/features/access-control/types";
import type { DashboardLayout } from "@/features/dashboard/types";
import type { DashboardOpportunityItem } from "@/features/dashboard/lib/opportunity-types";
import { CustomizableDashboard } from "@/features/dashboard/components/customizable-dashboard";

interface DashboardOverviewProps {
  user: SessionUser;
  opportunityList: DashboardOpportunityItem[];
  initialLayout: DashboardLayout | null;
}

export function DashboardOverview(props: DashboardOverviewProps) {
  return <CustomizableDashboard {...props} />;
}
