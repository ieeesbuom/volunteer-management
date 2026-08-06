import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AppPage } from "@/components/layout/app-page";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { SystemSettingsPanel } from "@/features/system-settings/components/system-settings-panel";
import { getInitialSystemSettingsData } from "@/features/system-settings/server/settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  const settingsData = await getInitialSystemSettingsData();
  const selectedTermId = settingsData.activeTermId || settingsData.terms[0]?.$id || "";

  return (
    <AppShell active="settings" pageTitle="System Settings" user={currentUser}>
      <AppPage>
        <PageHeader
          title="System Settings"
          description="Manage IEEE terms, role permissions, and the system audit trail from one place."
        />
        <SystemSettingsPanel
          initialActiveTermId={settingsData.activeTermId}
          initialAuditPage={settingsData.auditPage}
          initialPermissions={settingsData.permissions}
          initialSelectedTermId={selectedTermId}
          initialTerms={settingsData.terms}
        />
      </AppPage>
    </AppShell>
  );
}
