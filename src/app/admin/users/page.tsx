import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AppPage } from "@/components/layout/app-page";
import { PageHeader } from "@/components/layout/page-header";
import { AccessControlPanel } from "@/features/access-control/components/access-control-panel";
import { listAdminUsers } from "@/features/access-control/server/admin-users";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  const users = await listAdminUsers();

  return (
    <AppShell active="users" pageTitle="Access Control" user={currentUser}>
      <AppPage>
        <PageHeader
          title="Access Control"
          description="Manage verified profiles and Student Branch role assignments for each IEEE term."
        />
        <AccessControlPanel initialUsers={users} />
      </AppPage>
    </AppShell>
  );
}
