import { AppPage } from "@/components/layout/app-page";
import { PageHeader } from "@/components/layout/page-header";
import { ReportsNav } from "@/features/reports/components/reports-nav";

type ReportsSectionProps = {
  canAccessConclusions: boolean;
  children: React.ReactNode;
  description?: string;
  isAdmin: boolean;
  title: string;
};

export function ReportsSection({
  canAccessConclusions,
  children,
  description,
  isAdmin,
  title,
}: ReportsSectionProps) {
  return (
    <AppPage className="space-y-5">
      <PageHeader eyebrow="Reporting" title={title} description={description} />
      <ReportsNav canAccessConclusions={canAccessConclusions} isAdmin={isAdmin} />
      <div className="space-y-6">{children}</div>
    </AppPage>
  );
}
