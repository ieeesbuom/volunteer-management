import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <AppShell active="settings" user={currentUser}>
      <div className="space-y-6">
        <PageHeader
          title="System Settings"
          description="Manage IEEE terms, active term selection, Top Board exclusions, permission visibility, and audit review."
          actions={
            <Link className={buttonClasses()} href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Overview
            </Link>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-4 text-primary" aria-hidden="true" />
              Core Configuration
            </CardTitle>
            <CardDescription>
              IEEE term dates are Admin-managed because Student Branch transitions are AGM-driven rather than hardcoded to one fixed calendar boundary.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SystemSettingsPanel
              initialActiveTermId={settingsData.activeTermId}
              initialAuditPage={settingsData.auditPage}
              initialPermissions={settingsData.permissions}
              initialSelectedTermId={selectedTermId}
              initialTerms={settingsData.terms}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
