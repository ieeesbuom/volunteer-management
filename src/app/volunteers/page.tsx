import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AppPage } from "@/components/layout/app-page";
import { PageHeader } from "@/components/layout/page-header";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { VolunteersDirectory } from "@/features/volunteers/components/volunteers-directory";
import { listVerifiedVolunteers } from "@/features/volunteers/server/profiles";

export const dynamic = "force-dynamic";

export default async function VolunteersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && !canVolunteer(user.profile)) {
    redirect("/verify-uom");
  }

  const { items, total } = await listVerifiedVolunteers({ limit: 50, offset: 0 });

  return (
    <AppShell active="directory" user={user} pageTitle="Volunteers">
      <AppPage>
        <PageHeader
          title="Volunteers"
          description="Browse verified volunteers and open shared profiles."
        />
        <VolunteersDirectory initialItems={items} initialTotal={total} />
      </AppPage>
    </AppShell>
  );
}
