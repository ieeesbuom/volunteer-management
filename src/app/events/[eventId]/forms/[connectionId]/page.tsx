import Link from "next/link";
import { redirect } from "next/navigation";
import { getLavaFormAvailability } from "@/features/forms/lib/lava-availability";
import { ArrowLeft } from "lucide-react";
import { AppPage } from "@/components/layout/app-page";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  getEventUserContext,
  isEventVisible,
} from "@/features/events/server/event-route-helpers";
import { getEventById } from "@/features/events/server/event-service";
import { LavaFormRendererClient } from "@/features/forms/components/lava-form-renderer-client";
import { isFormVisibleToUser } from "@/features/forms/lib/audience";
import { isGroupAnswersEnabled } from "@/features/forms/lib/lava-form-presets";
import { lavaFileProxyPath } from "@/features/forms/lib/lava-paths";
import { createAppwriteFormConnectionRepository } from "@/features/forms/server/form-connection-repository";
import {
  canManageFormConnectionsForEvent,
} from "@/features/forms/server/permissions";
import { lavaSubmitFormAction } from "@/features/forms/server/lava-form-actions";
import { createLavaFormStore } from "@/features/forms/server/lava-form-store";
import { isLavaFormProvider } from "@/features/forms/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ connectionId: string; eventId: string }>;
};

export default async function EventLavaFormFillPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && !canVolunteer(user.profile)) {
    redirect("/verify-uom");
  }

  const { connectionId, eventId } = await params;
  const event = await getEventById(eventId);
  if (!event) {
    redirect("/events");
  }

  const { userEventRole } = await getEventUserContext(eventId, user, event.reference);
  if (!isEventVisible(user, event, userEventRole)) {
    redirect("/events");
  }

  const connection = await createAppwriteFormConnectionRepository().get(connectionId);
  if (!connection || connection.eventId !== eventId || !isLavaFormProvider(connection.provider)) {
    redirect(`/events/${eventId}`);
  }

  const canManage = await canManageFormConnectionsForEvent(user, eventId);
  const visible = isFormVisibleToUser({
    canManage,
    connection,
    currentUserId: user.authUser.id,
    isAdmin: user.isAdmin,
    isVolunteer: canVolunteer(user.profile),
    userRoleAssignments: user.eventRoles,
  });

  if (!visible) {
    redirect(`/events/${eventId}`);
  }

  const store = createLavaFormStore({ eventId, user });
  const form = connection.externalFormId
    ? await store.getFormById(connection.externalFormId)
    : null;
  if (!form) {
    redirect(`/events/${eventId}`);
  }

  const availability = getLavaFormAvailability(form);

  return (
    <AppShell active="events" user={user}>
      <AppPage>
        <PageHeader
          description={
            isGroupAnswersEnabled(connection)
              ? `${event.title} · Group registration — include everyone in the group size.`
              : event.title
          }
          title={form.title}
          actions={
            <Link className={buttonClasses()} href={`/events/${eventId}`}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to event
            </Link>
          }
        />
        <LavaFormRendererClient
          availability={availability}
          bannerUrl={form.bannerFileId ? lavaFileProxyPath(form.bannerFileId) : null}
          connectionId={connectionId}
          eventId={eventId}
          form={form}
          submit={lavaSubmitFormAction.bind(null, eventId, connectionId)}
        />
      </AppPage>
    </AppShell>
  );
}
