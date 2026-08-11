import { redirect } from "next/navigation";
import { ReportsAppShell } from "@/features/reports/components/reports-app-shell";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

export default async function ReportsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <ReportsAppShell user={user}>{children}</ReportsAppShell>
  );
}
