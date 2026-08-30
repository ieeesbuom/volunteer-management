import { redirect } from "next/navigation";
import { ReportsAppShell } from "@/features/reports/components/reports-app-shell";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { isVolunteerPreviewActive } from "@/features/access-control/server/view-mode";

export const dynamic = "force-dynamic";

export default async function ReportsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin || (await isVolunteerPreviewActive(user.isAdmin))) {
    redirect("/dashboard");
  }

  return (
    <ReportsAppShell user={user}>{children}</ReportsAppShell>
  );
}
