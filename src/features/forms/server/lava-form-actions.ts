"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  ActionResult,
  FieldDefinition,
  SubmitFormState,
} from "@knurdz/lava-form-builder";
import { requireAuth, requireUomVerifiedVolunteer } from "@/features/access-control/server/current-user";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { isFormVisibleToUser } from "@/features/forms/lib/audience";
import { lavaEditPath, lavaFillPath } from "@/features/forms/lib/lava-paths";
import {
  getLavaFormPreset,
  isGroupAnswersEnabled,
} from "@/features/forms/lib/lava-form-presets";
import { fitLavaString, LAVA_FORM_LIMITS } from "@/features/forms/lib/lava-form-mappers";
import { normalizeLavaScheduleInstant } from "@/features/forms/lib/lava-schedule";
import {
  createFormConnectionForCurrentUser,
} from "@/features/forms/server/form-connection-service";
import {
  createAppwriteFormConnectionRepository,
} from "@/features/forms/server/form-connection-repository";
import {
  canManageFormConnectionsForEvent,
} from "@/features/forms/server/permissions";
import {
  createLavaFormStore,
  diffIncomingFields,
} from "@/features/forms/server/lava-form-store";
import type { FormConnectionPurpose } from "@/features/forms/types";
import { getEventNotificationContext } from "@/features/notifications/server/workflow-recipients";
import {
  notifyEventUpdateWorkflow,
  notifyGradingRequestWorkflow,
} from "@/features/notifications/server/workflow-notifications";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import type { SafeJsonObject } from "@/lib/validation/safe-json";
import { formatUserFacingError } from "@/lib/utils";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { enforceRateLimit, rateLimitKey, RATE_LIMITS } from "@/server/rate-limit";

function actionSuccess(message: string): ActionResult {
  return { message, status: "success", toastKey: Date.now() };
}

function actionError(error: unknown, fallback: string): ActionResult {
  return {
    message: formatUserFacingError(error, fallback),
    status: "error",
    toastKey: Date.now(),
  };
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(formData: FormData, key: string, fallback: number) {
  const raw = readString(formData, key);
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function revalidateFormPaths(eventId: string, connectionId?: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
  if (connectionId) {
    revalidatePath(lavaFillPath(eventId, connectionId));
    revalidatePath(lavaEditPath(eventId, connectionId));
  }
}

async function revalidateLavaForm(eventId: string, formId: string) {
  const listed = await createAppwriteFormConnectionRepository().list({ eventId, limit: 100 });
  const connection = listed.find((item) => item.externalFormId === formId);
  revalidateFormPaths(eventId, connection?.id);
}

async function requireManager(eventId: string) {
  const user = await requireAuth();
  enforceRateLimit(
    rateLimitKey("lava-form-manage", user.authUser.id),
    RATE_LIMITS.lavaFormManagePerUser,
  );

  if (!(await canManageFormConnectionsForEvent(user, eventId))) {
    throw new ForbiddenError("Event form connection permission is required.");
  }

  return user;
}

export async function createCustomEventFormAction(input: {
  eventId: string;
  groupAnswersEnabled?: boolean;
  metadata?: SafeJsonObject;
  purpose: FormConnectionPurpose;
  title: string;
}): Promise<{ connectionId: string } | { error: string }> {
  try {
    const user = await requireManager(input.eventId);
    const title = fitLavaString(input.title, LAVA_FORM_LIMITS.title);
    if (!title) {
      throw new ValidationError("Form title is required.");
    }

    const store = createLavaFormStore({ eventId: input.eventId, user });
    const created = await store.createForm({
      description: null,
      kind: "competition",
      slug: title,
      sortOrder: 0,
      title,
    });
    const createdForm = await store.getFormById(created.id);
    if (!createdForm) {
      throw new NotFoundError("Custom form was not found.");
    }

    const metadata = { ...(input.metadata ?? {}) };
    const openAt = normalizeLavaScheduleInstant(
      typeof metadata.openAt === "string" ? metadata.openAt : null,
    );
    const closeAt = normalizeLavaScheduleInstant(
      typeof metadata.closeAt === "string" ? metadata.closeAt : null,
      true,
    );
    if (openAt) {
      metadata.openAt = openAt;
    } else {
      delete metadata.openAt;
    }
    if (closeAt) {
      metadata.closeAt = closeAt;
    } else {
      delete metadata.closeAt;
    }

    const groupAnswersEnabled = Boolean(input.groupAnswersEnabled);
    metadata.groupAnswersEnabled = groupAnswersEnabled;
    const preset = getLavaFormPreset(input.purpose, groupAnswersEnabled);

    await store.updateFormSettings({
      closeAt,
      confirmationEmailEnabled: false,
      confirmationEmailFieldId: null,
      confirmationEmailSelectedFieldIds: [],
      confirmationEmailTemplate: null,
      confirmationNameFieldId: null,
      description: null,
      formId: created.id,
      googleSheetsAdminUserId: null,
      googleSheetsSelectedFieldIds: [],
      googleSheetsSheetTitle: null,
      googleSheetsSyncEnabled: false,
      kind: "competition",
      openAt,
      slug: createdForm.slug,
      status: "open",
      successMessage: null,
      teamMaxMembers: preset.teamMaxMembers,
      teamMinMembers: preset.teamMinMembers,
      title,
    });

    if (preset.fields.length > 0) {
      await store.bulkSaveFields({
        creates: preset.fields,
        deletes: [],
        formId: created.id,
        updates: [],
      });
    }

    try {
      const connection = await createFormConnectionForCurrentUser(
        {
          eventId: input.eventId,
          externalFormId: created.id,
          metadata,
          provider: "lava",
          purpose: input.purpose,
          title,
        },
        user,
      );

      const env = getServerEnv();
      const { tables } = getAppwriteAdminServices();
      await tables.updateRow(env.NEXT_PUBLIC_APPWRITE_DATABASE_ID, APPWRITE_TABLES.lavaForms, created.id, {
        connectionId: connection.id,
      });

      const notificationContext = await getEventNotificationContext(connection.eventId, {
        excludeUserIds: [user.authUser.id],
      });
      if (connection.purpose === "grading") {
        await notifyGradingRequestWorkflow({
          actorUserId: user.authUser.id,
          eventId: connection.eventId,
          eventTitle: notificationContext.eventTitle,
          linkHref: lavaFillPath(connection.eventId, connection.id),
          recipientUserIds: notificationContext.recipientUserIds,
        });
      } else {
        await notifyEventUpdateWorkflow({
          actorUserId: user.authUser.id,
          eventId: connection.eventId,
          eventTitle: notificationContext.eventTitle,
          linkHref: lavaFillPath(connection.eventId, connection.id),
          message: `${connection.title} is now available.`,
          recipientUserIds: notificationContext.recipientUserIds,
        });
      }

      revalidateFormPaths(input.eventId, connection.id);
      return { connectionId: connection.id };
    } catch (error) {
      await store.deleteForm(created.id);
      throw error;
    }
  } catch (error) {
    return { error: formatUserFacingError(error, "Could not create custom form.") };
  }
}

export async function lavaCreateFormAction(
  eventId: string,
  prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  void eventId;
  void prev;
  void formData;
  return actionError(
    new ValidationError("Add another form from the Event Forms card."),
    "Add another form from the Event Forms card.",
  );
}

export async function lavaUpdateSettingsAction(
  eventId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireManager(eventId);
    const formId = readString(formData, "formId");
    if (!formId) {
      throw new ValidationError("Form id is required.");
    }

    const store = createLavaFormStore({ eventId, user });
    const connection = (await createAppwriteFormConnectionRepository().list({ eventId, limit: 100 })).find(
      (item) => item.externalFormId === formId,
    );
    const groupEnabled = connection ? isGroupAnswersEnabled(connection) : false;
    let teamMinMembers = readNumber(formData, "teamMinMembers", 1);
    let teamMaxMembers = readNumber(formData, "teamMaxMembers", 1);
    if (!groupEnabled) {
      teamMinMembers = 1;
      teamMaxMembers = 1;
    }

    await store.updateFormSettings({
      closeAt: readString(formData, "closeAt") || null,
      confirmationEmailEnabled: false,
      confirmationEmailFieldId: null,
      confirmationEmailSelectedFieldIds: [],
      confirmationEmailTemplate: null,
      confirmationNameFieldId: null,
      description: readString(formData, "description") || null,
      formId,
      googleSheetsAdminUserId: null,
      googleSheetsSelectedFieldIds: [],
      googleSheetsSheetTitle: null,
      googleSheetsSyncEnabled: false,
      kind: "competition",
      openAt: readString(formData, "openAt") || null,
      slug: readString(formData, "slug"),
      status: (["draft", "open", "closed"].includes(readString(formData, "status"))
        ? readString(formData, "status")
        : "open") as "draft" | "open" | "closed",
      successMessage: readString(formData, "successMessage") || null,
      teamMaxMembers,
      teamMinMembers,
      title: readString(formData, "title"),
    });

    await revalidateLavaForm(eventId, formId);
    return actionSuccess("Form settings saved.");
  } catch (error) {
    return actionError(error, "Could not save form settings.");
  }
}

export async function lavaDeleteFormAction(
  eventId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireManager(eventId);
    const formId = readString(formData, "formId");
    if (!formId) {
      throw new ValidationError("Form id is required.");
    }

    const store = createLavaFormStore({ eventId, user });
    await store.deleteForm(formId);
    revalidateFormPaths(eventId);
  } catch (error) {
    return actionError(error, "Could not delete form.");
  }

  redirect(`/events/${eventId}`);
}

export async function lavaUploadBannerAction(
  eventId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireManager(eventId);
    const formId = readString(formData, "formId");
    const banner = formData.get("banner");
    if (!formId || !(banner instanceof File)) {
      throw new ValidationError("Choose a banner image to upload.");
    }

    const store = createLavaFormStore({ eventId, user });
    await store.uploadBanner(formId, banner);
    await revalidateLavaForm(eventId, formId);
    return actionSuccess("Banner uploaded.");
  } catch (error) {
    return actionError(error, "Could not upload banner.");
  }
}

export async function lavaDeleteBannerAction(
  eventId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireManager(eventId);
    const formId = readString(formData, "formId");
    if (!formId) {
      throw new ValidationError("Form id is required.");
    }

    const store = createLavaFormStore({ eventId, user });
    await store.deleteBanner(formId);
    await revalidateLavaForm(eventId, formId);
    return actionSuccess("Banner removed.");
  } catch (error) {
    return actionError(error, "Could not remove banner.");
  }
}

export async function lavaBulkSaveFieldsAction(
  eventId: string,
  formId: string,
  fields: Array<Partial<FieldDefinition> & { id: string }>,
): Promise<ActionResult> {
  try {
    const user = await requireManager(eventId);
    const store = createLavaFormStore({ eventId, user });
    const existing = await store.getFormById(formId);
    if (!existing) {
      throw new NotFoundError("Custom form was not found.");
    }

    const connection = (await createAppwriteFormConnectionRepository().list({ eventId, limit: 100 })).find(
      (item) => item.externalFormId === formId,
    );
    const groupEnabled = connection ? isGroupAnswersEnabled(connection) : false;
    const normalizedFields = groupEnabled
      ? fields
      : fields.map((field) => ({
          ...field,
          scope: "submission" as const,
        }));

    const diff = diffIncomingFields(existing.fields, normalizedFields);
    await store.bulkSaveFields({
      creates: diff.creates,
      deletes: diff.deletes,
      formId,
      updates: diff.updates,
    });
    await revalidateLavaForm(eventId, formId);
    return actionSuccess("Form questions saved.");
  } catch (error) {
    return actionError(error, "Could not save form questions.");
  }
}

export async function lavaSetGroupAnswersAction(input: {
  connectionId: string;
  enabled: boolean;
  eventId: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await requireManager(input.eventId);
    const repository = createAppwriteFormConnectionRepository();
    const connection = await repository.get(input.connectionId);
    if (
      !connection ||
      connection.eventId !== input.eventId ||
      connection.provider !== "lava" ||
      !connection.externalFormId
    ) {
      throw new NotFoundError("Custom form was not found.");
    }

    const metadata = {
      ...(connection.metadata ?? {}),
      groupAnswersEnabled: input.enabled,
    };
    const timestamp = new Date().toISOString();
    await repository.update(input.connectionId, {
      metadata,
      updatedAt: timestamp,
    });

    const store = createLavaFormStore({ eventId: input.eventId, user });
    const form = await store.getFormById(connection.externalFormId);
    if (form) {
      await store.updateFormSettings({
        closeAt: form.closeAt,
        confirmationEmailEnabled: false,
        confirmationEmailFieldId: null,
        confirmationEmailSelectedFieldIds: [],
        confirmationEmailTemplate: null,
        confirmationNameFieldId: null,
        description: form.description,
        formId: form.id,
        googleSheetsAdminUserId: null,
        googleSheetsSelectedFieldIds: [],
        googleSheetsSheetTitle: null,
        googleSheetsSyncEnabled: false,
        kind: "competition",
        openAt: form.openAt,
        slug: form.slug,
        status: form.status,
        successMessage: form.successMessage,
        teamMaxMembers: input.enabled ? Math.max(form.teamMaxMembers, 2) : 1,
        teamMinMembers: input.enabled ? Math.max(form.teamMinMembers, 2) : 1,
        title: form.title,
      });

      if (!input.enabled) {
        const memberFields = form.fields.filter((field) => field.scope === "member");
        if (memberFields.length > 0) {
          await store.bulkSaveFields({
            creates: [],
            deletes: [],
            formId: form.id,
            updates: memberFields.map((field) => ({
              fieldId: field.id,
              helpText: field.helpText,
              isUnique: field.isUnique,
              key: field.key,
              label: field.label,
              options: field.options,
              placeholder: field.placeholder,
              required: field.required,
              scope: "submission",
              sortOrder: field.sortOrder,
              type: field.type,
              uniqueCaseSensitive: field.uniqueCaseSensitive,
              validationPattern: field.validationPattern,
              validationPatternMessage: field.validationPatternMessage,
            })),
          });
        }
      }
    }

    revalidateFormPaths(input.eventId, input.connectionId);
    return { ok: true };
  } catch (error) {
    return { error: formatUserFacingError(error, "Could not update group answers setting.") };
  }
}

export async function lavaSubmitFormAction(
  eventId: string,
  connectionId: string,
  prev: SubmitFormState,
  formData: FormData,
): Promise<SubmitFormState> {
  try {
    const user = await requireUomVerifiedVolunteer();
    enforceRateLimit(
      rateLimitKey("lava-form-submit", user.authUser.id),
      RATE_LIMITS.lavaFormSubmitPerUser,
    );

    const connection = await createAppwriteFormConnectionRepository().get(connectionId);
    if (!connection || connection.eventId !== eventId || connection.provider !== "lava") {
      throw new NotFoundError("Form was not found.");
    }

    const visible = isFormVisibleToUser({
      connection,
      currentUserId: user.authUser.id,
      isAdmin: user.isAdmin,
      isVolunteer: canVolunteer(user.profile),
      userRoleAssignments: user.eventRoles,
    });
    if (!visible && !(await canManageFormConnectionsForEvent(user, eventId))) {
      throw new ForbiddenError("You do not have access to this form.");
    }

    const store = createLavaFormStore({ eventId, user });
    const form = connection.externalFormId
      ? await store.getFormById(connection.externalFormId)
      : null;
    if (!form) {
      throw new NotFoundError("Custom form was not found.");
    }

    const { submitForm } = await import("@knurdz/lava-form-builder");
    const result = await submitForm(store, form, formData);
    if (result.status === "success") {
      revalidateFormPaths(eventId, connectionId);
    }

    return result;
  } catch (error) {
    return {
      fieldErrors: {},
      fields: prev.fields,
      message: formatUserFacingError(error, "Could not submit the form."),
      status: "error",
      toastKey: Date.now(),
    };
  }
}

export async function lavaDeleteSubmissionAction(
  eventId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireManager(eventId);
    const submissionId = readString(formData, "submissionId");
    if (!submissionId) {
      throw new ValidationError("Submission id is required.");
    }

    const store = createLavaFormStore({ eventId, user });
    const deleted = await store.deleteSubmission(submissionId);
    await revalidateLavaForm(eventId, deleted.formId);
    return actionSuccess("Submission deleted.");
  } catch (error) {
    return actionError(error, "Could not delete submission.");
  }
}

