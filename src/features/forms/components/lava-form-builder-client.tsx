"use client";

import { useState, useTransition } from "react";
import {
  FormBuilder,
  FormSubmissions,
  type FieldDefinition,
  type FormBuilderActions,
  type FormDefinition,
  type FormWithFields,
  type SubmissionDetail,
  type SubmissionPage,
  type ActionResult,
} from "@knurdz/lava-form-builder";
import { useRouter } from "next/navigation";
import { LavaFormSurface } from "@/features/forms/components/lava-form-surface";
import {
  getFormPurposeDescription,
  getFormPurposeLabel,
} from "@/features/forms/lib/lava-form-presets";
import { lavaEditPath, lavaFillPath } from "@/features/forms/lib/lava-paths";
import { lavaSetGroupAnswersAction } from "@/features/forms/server/lava-form-actions";
import type { FormConnectionPurpose } from "@/features/forms/types";

export function LavaFormBuilderClient({
  actions,
  bannerUrl,
  connectionId,
  deleteSubmission,
  eventId,
  form,
  forms,
  from,
  groupAnswersEnabled,
  origin,
  pageSize,
  purpose,
  searchField,
  searchQuery,
  selectedSubmission,
  submissionPage,
  to,
}: {
  actions: FormBuilderActions;
  bannerUrl: string | null;
  connectionId: string;
  deleteSubmission: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  eventId: string;
  form: FormWithFields;
  forms: FormDefinition[];
  from?: string | null;
  groupAnswersEnabled: boolean;
  origin: string;
  pageSize?: number | "all" | null;
  purpose: FormConnectionPurpose;
  searchField?: string | null;
  searchQuery?: string | null;
  selectedSubmission: SubmissionDetail | null;
  submissionPage: SubmissionPage;
  to?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [groupEnabled, setGroupEnabled] = useState(groupAnswersEnabled);
  const [toggleError, setToggleError] = useState("");

  if (groupAnswersEnabled !== groupEnabled && !pending) {
    setGroupEnabled(groupAnswersEnabled);
  }
  const fillPath = lavaFillPath(eventId, connectionId);
  const editPath = lavaEditPath(eventId, connectionId);
  const builderForm: FormWithFields = {
    ...form,
    confirmationEmailSelectedFieldIds: form.confirmationEmailSelectedFieldIds ?? [],
    fields: (form.fields ?? []).map((field) => ({
      ...field,
      options: field.options ?? [],
    })),
    googleSheetsSelectedFieldIds: form.googleSheetsSelectedFieldIds ?? [],
  };

  function handleNavigate(url: string) {
    if (url.startsWith("/admin")) {
      return;
    }

    router.push(url);
  }

  async function bulkSaveFields(formId: string, fields: FieldDefinition[]) {
    const result = await actions.bulkSaveFields(formId, fields);
    if (result.status === "success") {
      router.refresh();
    }
    return result;
  }

  function toggleGroupAnswers(next: boolean) {
    setToggleError("");
    setGroupEnabled(next);
    startTransition(async () => {
      const result = await lavaSetGroupAnswersAction({
        connectionId,
        enabled: next,
        eventId,
      });
      if ("error" in result) {
        setGroupEnabled(!next);
        setToggleError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Form purpose
            </p>
            <p className="text-[15px] font-semibold text-text-strong">
              {getFormPurposeLabel(purpose)}
            </p>
            <p className="text-[13px] text-text-muted">
              {getFormPurposeDescription(purpose)}
            </p>
          </div>
          <label className="flex max-w-md items-start gap-3 rounded-lg border border-border bg-bg-base/60 p-3 text-sm text-text-secondary">
            <input
              checked={groupEnabled}
              className="mt-1 size-4 accent-(--primary)"
              disabled={pending}
              onChange={(event) => toggleGroupAnswers(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="font-semibold text-text-strong">Group / team answers</span>
              <span className="mt-1 block text-xs font-normal text-text-muted">
                When enabled, volunteers can enter a group size and answer selected questions for
                each member. Number of people includes the person submitting.
              </span>
            </span>
          </label>
        </div>
        {toggleError ? (
          <p className="mt-3 text-sm text-danger">{toggleError}</p>
        ) : null}
        {groupEnabled ? (
          <p className="mt-3 rounded-lg border border-primary/20 bg-primary-soft/40 px-3 py-2 text-[13px] text-text-body">
            Group mode is on. In form settings, use Min / Max team size for the allowed group
            size. Mark questions as per-member when each person should answer them.
          </p>
        ) : null}
      </section>

      <LavaFormSurface
        connectionId={connectionId}
        eventId={eventId}
        fillPath={fillPath}
        groupAnswersEnabled={groupEnabled}
        variant="builder"
      >
        <FormBuilder
          actions={{ ...actions, bulkSaveFields }}
          bannerUrl={bannerUrl}
          forms={[builderForm]}
          googleSheetsConnection={null}
          googleSheetsOAuthConfigured={false}
          googleSheetsSettingsHref={editPath}
          linkedResourceTitle={form.title}
          maxForms={1}
          publicFormBaseUrl={origin}
          selectedForm={builderForm}
          onNavigate={handleNavigate}
        />
      </LavaFormSurface>

      <section className="space-y-3" id="responses">
        <div>
          <h2 className="text-[16px] font-semibold text-text-strong">Responses</h2>
          <p className="mt-1 text-[13px] text-text-muted">
            Review and delete volunteer submissions for this custom form.
          </p>
        </div>
        <LavaFormSurface connectionId={connectionId} eventId={eventId} fillPath={fillPath}>
          <FormSubmissions
            form={builderForm}
            forms={forms}
            formsWithFields={[builderForm]}
            from={from}
            onDeleteSubmission={deleteSubmission}
            onNavigate={handleNavigate}
            pageSize={pageSize}
            searchField={searchField}
            searchQuery={searchQuery}
            selectedSubmission={selectedSubmission}
            submissionPage={submissionPage}
            submissionsBasePath={editPath}
            to={to}
          />
        </LavaFormSurface>
      </section>
    </div>
  );
}
