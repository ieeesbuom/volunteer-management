import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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
import { LavaFormBuilderClient } from "@/features/forms/components/lava-form-builder-client";
import { isGroupAnswersEnabled } from "@/features/forms/lib/lava-form-presets";
import { lavaFileProxyPath } from "@/features/forms/lib/lava-paths";
import { createAppwriteFormConnectionRepository } from "@/features/forms/server/form-connection-repository";
import {
  canManageFormConnectionsForEvent,
} from "@/features/forms/server/permissions";
import {
  lavaBulkSaveFieldsAction,
  lavaCreateFormAction,
  lavaDeleteBannerAction,
  lavaDeleteFormAction,
  lavaDeleteSubmissionAction,
  lavaUpdateSettingsAction,
  lavaUploadBannerAction,
} from "@/features/forms/server/lava-form-actions";
import { createLavaFormStore } from "@/features/forms/server/lava-form-store";
import { isLavaFormProvider } from "@/features/forms/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ connectionId: string; eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EventLavaFormEditPage({ params, searchParams }: PageProps) {
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

  if (!(await canManageFormConnectionsForEvent(user, eventId))) {
    redirect(`/events/${eventId}`);
  }

  const connection = await createAppwriteFormConnectionRepository().get(connectionId);
  if (!connection || connection.eventId !== eventId || !isLavaFormProvider(connection.provider)) {
    redirect(`/events/${eventId}`);
  }

  const store = createLavaFormStore({ eventId, user });
  const form = connection.externalFormId
    ? await store.getFormById(connection.externalFormId)
    : null;
  if (!form) {
    redirect(`/events/${eventId}`);
  }

  const query = await searchParams;
  const pageSizeRaw = firstParam(query.pageSize);
  const pageSize =
    pageSizeRaw === "all" ? "all" : pageSizeRaw ? Number(pageSizeRaw) || 20 : 20;
  const submissionPage = await store.listSubmissions({
    formId: form.id,
    from: firstParam(query.from) ?? null,
    page: Number(firstParam(query.page) ?? "1") || 1,
    pageSize,
    searchField: firstParam(query.searchField) ?? null,
    searchQuery: firstParam(query.searchQuery) ?? null,
    to: firstParam(query.to) ?? null,
  });
  const selectedId = firstParam(query.submissionId);
  const selectedSubmission = selectedId
    ? (submissionPage.submissions.find((item) => item.id === selectedId) ??
      (await store.getSubmissionById(selectedId)))
    : null;

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const bulkSaveFields = lavaBulkSaveFieldsAction.bind(null, eventId);
  const createForm = lavaCreateFormAction.bind(null, eventId);
  const deleteBanner = lavaDeleteBannerAction.bind(null, eventId);
  const deleteForm = lavaDeleteFormAction.bind(null, eventId);
  const updateSettings = lavaUpdateSettingsAction.bind(null, eventId);
  const uploadBanner = lavaUploadBannerAction.bind(null, eventId);
  const deleteSubmission = lavaDeleteSubmissionAction.bind(null, eventId);

  return (
    <AppShell active="events" user={user}>
      <AppPage>
        <PageHeader
          description={`Build questions and review responses for ${event.title}.`}
          title={form.title}
          actions={
            <Link className={buttonClasses()} href={`/events/${eventId}`}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to event
            </Link>
          }
        />
        <LavaFormBuilderClient
          actions={{
            bulkSaveFields,
            createForm,
            deleteBanner,
            deleteForm,
            updateSettings,
            uploadBanner,
          }}
          bannerUrl={form.bannerFileId ? lavaFileProxyPath(form.bannerFileId) : null}
          connectionId={connectionId}
          deleteSubmission={deleteSubmission}
          eventId={eventId}
          form={form}
          forms={[form]}
          from={firstParam(query.from) ?? null}
          groupAnswersEnabled={isGroupAnswersEnabled(connection)}
          origin={`${proto}://${host}`}
          pageSize={pageSize}
          purpose={connection.purpose}
          searchField={firstParam(query.searchField) ?? null}
          searchQuery={firstParam(query.searchQuery) ?? null}
          selectedSubmission={selectedSubmission}
          submissionPage={submissionPage}
          to={firstParam(query.to) ?? null}
        />
      </AppPage>
    </AppShell>
  );
}
