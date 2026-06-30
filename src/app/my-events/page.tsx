import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { MyEvents } from "@/features/events/components/MyEvents";
import { getEventsForUser } from "@/features/events/server/event-roles.server";

export const dynamic = "force-dynamic";

export default async function MyEventsPage() {
  redirect("/events?tab=my");
}
