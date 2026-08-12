import "server-only";

import { ID, Query, TablesDB } from "node-appwrite";
import type {
  FieldDefinition,
  FieldWrite,
  FormWithFields,
  LavaFormStore,
  SubmissionFilters,
  SubmissionPage,
} from "@knurdz/lava-form-builder";
import { canVolunteer } from "@/features/access-control/lib/rules";
import type { SessionUser } from "@/features/access-control/types";
import { isFormVisibleToUser } from "@/features/forms/lib/audience";
import {
  collectFileIdsFromAnswers,
  diffFieldsForBulkSave,
  fieldWriteToRow,
  fitLavaString,
  isValidAppwriteId,
  LAVA_FORM_LIMITS,
  matchesSubmissionSearch,
  normalizeUniqueValue,
  parseMemberAnswers,
  parseSubmissionAnswers,
  serializeAnswers,
  serializeJson,
  slugifyFormTitle,
  toFieldDefinition,
  toFormDefinition,
  toSubmissionDetail,
  uniqueReservationKey,
  type LavaFieldRow,
  type LavaFormRow,
  type LavaSubmissionRow,
} from "@/features/forms/lib/lava-form-mappers";
import { lavaFileProxyPath } from "@/features/forms/lib/lava-paths";
import { normalizeLavaScheduleInstant } from "@/features/forms/lib/lava-schedule";
import {
  canManageFormConnectionsForEvent,
} from "@/features/forms/server/permissions";
import {
  createAppwriteFormConnectionRepository,
  type FormConnectionRepository,
} from "@/features/forms/server/form-connection-repository";
import {
  deleteLavaFormFile,
  getLavaFormStorage,
  uploadLavaFormFile,
  type LavaStorageClient,
} from "@/features/forms/server/lava-form-files";
import type { FormConnection } from "@/features/forms/types";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import {
  ForbiddenError,
  isAppwriteConflict,
  isAppwriteNotFound,
  NotFoundError,
  ValidationError,
} from "@/server/errors";

type TablesClient = Pick<
  TablesDB,
  "createRow" | "deleteRow" | "getRow" | "listRows" | "updateRow"
>;

export type LavaFormStoreDeps = {
  connectionRepository?: FormConnectionRepository;
  databaseId?: string;
  eventId: string;
  now?: () => Date;
  storage?: LavaStorageClient;
  tables?: TablesClient;
  user: SessionUser;
};

const LIST_PAGE_SIZE = 100;

function rowId(id: string) {
  return isValidAppwriteId(id) ? ID.custom(id) : ID.unique();
}

export function createLavaFormStore(deps: LavaFormStoreDeps): LavaFormStore {
  const user = deps.user;
  const eventId = deps.eventId;
  const now = deps.now ?? (() => new Date());
  const tables = deps.tables ?? getAppwriteAdminServices().tables;
  const storage = deps.storage ?? getLavaFormStorage();
  const connections = deps.connectionRepository ?? createAppwriteFormConnectionRepository();
  const databaseId = deps.databaseId ?? getServerEnv().NEXT_PUBLIC_APPWRITE_DATABASE_ID;

  async function assertCanManage() {
    if (!(await canManageFormConnectionsForEvent(user, eventId))) {
      throw new ForbiddenError("Event form connection permission is required.");
    }
  }

  async function listAllRows<T extends { $id: string }>(tableId: string, queries: string[]) {
    const rows: T[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 20; page += 1) {
      const pageQueries = [...queries, Query.limit(LIST_PAGE_SIZE)];
      if (cursor) {
        pageQueries.push(Query.cursorAfter(cursor));
      }

      const result = await tables.listRows(databaseId, tableId, pageQueries, undefined, false);
      const batch = result.rows as unknown as T[];
      if (batch.length === 0) {
        break;
      }

      rows.push(...batch);
      cursor = batch[batch.length - 1]?.$id;
      if (batch.length < LIST_PAGE_SIZE) {
        break;
      }
    }

    return rows;
  }

  async function getFormRow(formId: string): Promise<LavaFormRow | null> {
    try {
      const row = await tables.getRow(databaseId, APPWRITE_TABLES.lavaForms, formId);
      const form = row as LavaFormRow;
      return String(form.eventId) === eventId ? form : null;
    } catch (error) {
      if (isAppwriteNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  async function requireFormRow(formId: string) {
    const row = await getFormRow(formId);
    if (!row) {
      throw new NotFoundError("Custom form was not found.");
    }

    return row;
  }

  async function listFieldsForForm(formId: string) {
    const rows = await listAllRows<LavaFieldRow>(APPWRITE_TABLES.lavaFormFields, [
      Query.equal("formId", formId),
      Query.orderAsc("sortOrder"),
    ]);
    return rows.map(toFieldDefinition);
  }

  async function toFormWithFields(row: LavaFormRow): Promise<FormWithFields> {
    const form = toFormDefinition(row);
    return {
      ...form,
      fields: await listFieldsForForm(form.id),
    };
  }

  async function getConnectionForForm(row: LavaFormRow): Promise<FormConnection | null> {
    const connectionId = typeof row.connectionId === "string" ? row.connectionId.trim() : "";
    if (connectionId) {
      const connection = await connections.get(connectionId);
      if (connection && connection.eventId === eventId) {
        return connection;
      }
    }

    const listed = await connections.list({ eventId, limit: 100 });
    return listed.find((item) => item.externalFormId === row.$id) ?? null;
  }

  async function assertCanSubmit(formId: string) {
    const row = await requireFormRow(formId);
    const connection = await getConnectionForForm(row);

    if (!connection || connection.status !== "active") {
      const { FormSubmissionNotAllowedError } = await import("@knurdz/lava-form-builder");
      throw new FormSubmissionNotAllowedError("This form is not accepting responses.", formId);
    }

    const visible = isFormVisibleToUser({
      connection,
      currentUserId: user.authUser.id,
      isAdmin: user.isAdmin,
      isVolunteer: canVolunteer(user.profile),
      userRoleAssignments: user.eventRoles,
    });

    if (!visible) {
      throw new ForbiddenError("You do not have access to this form.");
    }
  }

  async function uniqueSlug(base: string) {
    const slugBase = slugifyFormTitle(base);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const slug = attempt === 0 ? slugBase : `${slugBase}-${attempt + 1}`.slice(0, 80);
      const existing = await tables.listRows(
        databaseId,
        APPWRITE_TABLES.lavaForms,
        [Query.equal("eventId", eventId), Query.equal("slug", slug), Query.limit(1)],
        undefined,
        false,
      );
      if (existing.rows.length === 0) {
        return slug;
      }
    }

    return `${slugBase}-${ID.unique().slice(0, 8)}`.slice(0, 80);
  }

  async function deleteRows(tableId: string, queries: string[]) {
    const rows = await listAllRows<{ $id: string }>(tableId, queries);
    await Promise.all(rows.map((row) => tables.deleteRow(databaseId, tableId, row.$id)));
    return rows;
  }

  const store: LavaFormStore = {
    async listForms() {
      await assertCanManage();
      const rows = await listAllRows<LavaFormRow>(APPWRITE_TABLES.lavaForms, [
        Query.equal("eventId", eventId),
        Query.orderAsc("sortOrder"),
      ]);
      return rows.map(toFormDefinition);
    },

    async getFormById(formId) {
      const row = await getFormRow(formId);
      return row ? toFormWithFields(row) : null;
    },

    async getFormBySlug(slug) {
      const result = await tables.listRows(
        databaseId,
        APPWRITE_TABLES.lavaForms,
        [Query.equal("eventId", eventId), Query.equal("slug", slug), Query.limit(1)],
        undefined,
        false,
      );
      const row = result.rows[0] as LavaFormRow | undefined;
      return row ? toFormWithFields(row) : null;
    },

    async createForm(input) {
      await assertCanManage();
      const timestamp = now().toISOString();
      const title = fitLavaString(input.title, LAVA_FORM_LIMITS.title, "Untitled form") || "Untitled form";
      const slug = await uniqueSlug(input.slug || title);
      const row = await tables.createRow(
        databaseId,
        APPWRITE_TABLES.lavaForms,
        ID.unique(),
        {
          bannerFileId: "",
          closeAt: "",
          confirmationEmailEnabled: false,
          confirmationEmailFieldId: "",
          confirmationEmailSelectedFieldIds: "[]",
          confirmationEmailTemplate: "",
          confirmationNameFieldId: "",
          connectionId: "",
          createdAt: timestamp,
          createdBy: user.authUser.id,
          description: fitLavaString(input.description, LAVA_FORM_LIMITS.description),
          eventId,
          googleSheetsAdminUserId: "",
          googleSheetsSelectedFieldIds: "[]",
          googleSheetsSheetTitle: "",
          googleSheetsSyncEnabled: false,
          kind: fitLavaString(input.kind, LAVA_FORM_LIMITS.kind, "competition") || "competition",
          openAt: "",
          slug,
          sortOrder: input.sortOrder,
          status: "draft",
          successMessage: "",
          teamMaxMembers: 1,
          teamMinMembers: 1,
          title,
          updatedAt: timestamp,
        },
      );

      return { id: row.$id };
    },

    async updateFormSettings(input) {
      await assertCanManage();
      const existing = await requireFormRow(input.formId);
      const current = toFormDefinition(existing);
      const timestamp = now().toISOString();
      const title = fitLavaString(input.title, LAVA_FORM_LIMITS.title, current.title) || current.title;
      let slug =
        fitLavaString(input.slug, LAVA_FORM_LIMITS.slug, current.slug) || current.slug;
      if (slug !== current.slug) {
        slug = await uniqueSlug(slug);
      }
      const openAt = normalizeLavaScheduleInstant(input.openAt) ?? "";
      const closeAt = normalizeLavaScheduleInstant(input.closeAt, true) ?? "";
      const teamMinMembers = Math.max(1, Math.min(50, Number(input.teamMinMembers) || 1));
      const teamMaxMembers = Math.max(
        teamMinMembers,
        Math.min(50, Number(input.teamMaxMembers) || teamMinMembers),
      );

      await tables.updateRow(databaseId, APPWRITE_TABLES.lavaForms, input.formId, {
        closeAt,
        confirmationEmailEnabled: false,
        confirmationEmailFieldId: "",
        confirmationEmailSelectedFieldIds: "[]",
        confirmationEmailTemplate: "",
        confirmationNameFieldId: "",
        description: fitLavaString(input.description, LAVA_FORM_LIMITS.description),
        googleSheetsAdminUserId: "",
        googleSheetsSelectedFieldIds: "[]",
        googleSheetsSheetTitle: "",
        googleSheetsSyncEnabled: false,
        kind: fitLavaString(input.kind, LAVA_FORM_LIMITS.kind, "competition") || "competition",
        openAt,
        slug,
        status: input.status,
        successMessage: fitLavaString(input.successMessage, LAVA_FORM_LIMITS.successMessage),
        teamMaxMembers,
        teamMinMembers,
        title,
        updatedAt: timestamp,
      });

      const connection = await getConnectionForForm(existing);
      if (connection) {
        const metadata = {
          ...(connection.metadata ?? {}),
          ...(openAt ? { openAt } : {}),
          ...(closeAt ? { closeAt } : {}),
        };
        if (!openAt && metadata.openAt) {
          delete metadata.openAt;
        }
        if (!closeAt && metadata.closeAt) {
          delete metadata.closeAt;
        }

        await connections.update(connection.id, {
          metadata,
          title,
          updatedAt: timestamp,
        });
      }
    },

    async deleteForm(formId) {
      await assertCanManage();
      await purgeLavaFormRecords({
        databaseId,
        formId,
        storage,
        tables,
      });

      const remaining = await getFormRow(formId).catch(() => null);
      if (remaining) {
        await tables.deleteRow(databaseId, APPWRITE_TABLES.lavaForms, formId);
      }

      const listed = await connections.list({ eventId, limit: 100 });
      const linked = listed.find((item) => item.externalFormId === formId);
      if (linked) {
        await connections.delete(linked.id);
      }
    },

    async uploadBanner(formId, file) {
      await assertCanManage();
      const existing = await requireFormRow(formId);
      const previous = typeof existing.bannerFileId === "string" ? existing.bannerFileId : "";
      const fileId = await uploadLavaFormFile(file, storage);
      await tables.updateRow(databaseId, APPWRITE_TABLES.lavaForms, formId, {
        bannerFileId: fileId,
        updatedAt: now().toISOString(),
      });
      if (previous) {
        await deleteLavaFormFile(previous, storage);
      }
      return fileId;
    },

    async deleteBanner(formId) {
      await assertCanManage();
      const existing = await requireFormRow(formId);
      const previous = typeof existing.bannerFileId === "string" ? existing.bannerFileId : "";
      await tables.updateRow(databaseId, APPWRITE_TABLES.lavaForms, formId, {
        bannerFileId: "",
        updatedAt: now().toISOString(),
      });
      if (previous) {
        await deleteLavaFormFile(previous, storage);
      }
    },

    getBannerUrl(bannerFileId) {
      return lavaFileProxyPath(bannerFileId);
    },

    async createField(input) {
      await assertCanManage();
      await requireFormRow(input.formId);
      const row = await tables.createRow(
        databaseId,
        APPWRITE_TABLES.lavaFormFields,
        ID.unique(),
        fieldWriteToRow(input.formId, input),
      );
      return { id: row.$id };
    },

    async updateField(input) {
      await assertCanManage();
      await requireFormRow(input.formId);
      await tables.updateRow(
        databaseId,
        APPWRITE_TABLES.lavaFormFields,
        input.fieldId,
        fieldWriteToRow(input.formId, input),
      );
    },

    async deleteField(fieldId) {
      await assertCanManage();
      try {
        const row = await tables.getRow(databaseId, APPWRITE_TABLES.lavaFormFields, fieldId);
        await requireFormRow(String((row as LavaFieldRow).formId));
        await tables.deleteRow(databaseId, APPWRITE_TABLES.lavaFormFields, fieldId);
      } catch (error) {
        if (!isAppwriteNotFound(error)) {
          throw error;
        }
      }
    },

    async reorderFields(updates) {
      await assertCanManage();
      await Promise.all(
        updates.map((item) =>
          tables.updateRow(databaseId, APPWRITE_TABLES.lavaFormFields, item.id, {
            sortOrder: item.sortOrder,
          }),
        ),
      );
    },

    async bulkSaveFields(input) {
      await assertCanManage();
      await requireFormRow(input.formId);

      for (const fieldId of input.deletes) {
        await store.deleteField(fieldId);
      }

      for (const field of input.updates) {
        await store.updateField({ ...field, formId: input.formId });
      }

      for (const field of input.creates) {
        const withId = field as FieldWrite & { id?: string };
        await tables.createRow(
          databaseId,
          APPWRITE_TABLES.lavaFormFields,
          withId.id && isValidAppwriteId(withId.id) ? rowId(withId.id) : ID.unique(),
          fieldWriteToRow(input.formId, field),
        );
      }
    },

    async createSubmission(payload) {
      await assertCanSubmit(payload.formId);
      const timestamp = now().toISOString();
      const row = await tables.createRow(
        databaseId,
        APPWRITE_TABLES.lavaFormSubmissions,
        ID.unique(),
        {
          answersJson: serializeAnswers(payload.answers),
          createdAt: timestamp,
          eventId,
          formId: payload.formId,
          memberAnswersJson: serializeAnswers(payload.memberAnswers),
          submittedBy: user.authUser.id,
          teamName: payload.teamName ?? "",
        },
      );
      return { id: row.$id };
    },

    async listSubmissions(filters) {
      await assertCanManage();
      const page = await loadSubmissionPage({
        eventId,
        filters,
        getFormWithFields: async (formId) => {
          const row = await getFormRow(formId);
          return row ? toFormWithFields(row) : null;
        },
        listAllRows,
      });
      return page;
    },

    async listAllSubmissionDetails(filters) {
      const page = await store.listSubmissions({ ...filters, page: 1, pageSize: "all" });
      return page.submissions;
    },

    async getSubmissionById(submissionId) {
      await assertCanManage();
      try {
        const row = (await tables.getRow(
          databaseId,
          APPWRITE_TABLES.lavaFormSubmissions,
          submissionId,
        )) as LavaSubmissionRow;
        if (String(row.eventId) !== eventId) {
          return null;
        }

        const form = await store.getFormById(String(row.formId));
        if (!form) {
          return null;
        }

        return toSubmissionDetail(row, form, form.fields);
      } catch (error) {
        if (isAppwriteNotFound(error)) {
          return null;
        }

        throw error;
      }
    },

    async deleteSubmission(submissionId) {
      await assertCanManage();
      const detail = await store.getSubmissionById(submissionId);
      if (!detail) {
        throw new NotFoundError("Submission was not found.");
      }

      const row = (await tables.getRow(
        databaseId,
        APPWRITE_TABLES.lavaFormSubmissions,
        submissionId,
      )) as LavaSubmissionRow;
      const fields = (await store.getFormById(detail.formId))?.fields ?? [];
      const fileIds = collectFileIdsFromAnswers(
        fields,
        parseSubmissionAnswers(row.answersJson),
        parseMemberAnswers(row.memberAnswersJson),
      );
      await Promise.all(fileIds.map((fileId) => deleteLavaFormFile(fileId, storage)));
      await deleteRows(APPWRITE_TABLES.lavaFormUniqueKeys, [
        Query.equal("submissionId", submissionId),
      ]);
      await tables.deleteRow(databaseId, APPWRITE_TABLES.lavaFormSubmissions, submissionId);
      return detail;
    },

    async reserveUniqueValues(input) {
      await assertCanSubmit(input.formId);
      const created: string[] = [];

      try {
        for (const entry of input.entries) {
          const normalized = normalizeUniqueValue(entry.value, entry.field.uniqueCaseSensitive);
          if (!normalized) {
            continue;
          }

          const uniqueKey = uniqueReservationKey(input.formId, entry.field.id, normalized);
          try {
            const row = await tables.createRow(
              databaseId,
              APPWRITE_TABLES.lavaFormUniqueKeys,
              ID.unique(),
              {
                fieldId: entry.field.id,
                formId: input.formId,
                normalizedValue: normalized,
                submissionId: "",
                uniqueKey,
              },
            );
            created.push(row.$id);
          } catch (error) {
            if (isAppwriteConflict(error)) {
              const { UniqueFieldConflictError } = await import("@knurdz/lava-form-builder");
              throw new UniqueFieldConflictError({
                [entry.errorKey]: "This value is already taken.",
              });
            }

            throw error;
          }
        }
      } catch (error) {
        await store.releaseUniqueReservations(created);
        throw error;
      }

      return created;
    },

    async attachUniqueReservations(reservationIds, submissionId) {
      await Promise.all(
        reservationIds.map((reservationId) =>
          tables.updateRow(databaseId, APPWRITE_TABLES.lavaFormUniqueKeys, reservationId, {
            submissionId,
          }),
        ),
      );
    },

    async releaseUniqueReservations(reservationIds) {
      await Promise.all(
        reservationIds.map(async (reservationId) => {
          try {
            await tables.deleteRow(databaseId, APPWRITE_TABLES.lavaFormUniqueKeys, reservationId);
          } catch (error) {
            if (!isAppwriteNotFound(error)) {
              throw error;
            }
          }
        }),
      );
    },

    async uploadFile(file) {
      return uploadLavaFormFile(file, storage);
    },

    async deleteFiles(fileIds) {
      await Promise.all(fileIds.map((fileId) => deleteLavaFormFile(fileId, storage)));
    },

    getFileUrl(fileId) {
      return lavaFileProxyPath(fileId);
    },
  };

  return store;
}

export async function purgeLavaFormRecords({
  databaseId,
  formId,
  storage = getLavaFormStorage(),
  tables = getAppwriteAdminServices().tables,
}: {
  databaseId?: string;
  formId: string;
  storage?: LavaStorageClient;
  tables?: TablesClient;
}) {
  const db = databaseId ?? getServerEnv().NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  let form: LavaFormRow | null = null;

  try {
    form = (await tables.getRow(db, APPWRITE_TABLES.lavaForms, formId)) as LavaFormRow;
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }
  }

  const fieldRows = await listTableRows<LavaFieldRow>(tables, db, APPWRITE_TABLES.lavaFormFields, [
    Query.equal("formId", formId),
  ]);
  const submissionRows = await listTableRows<LavaSubmissionRow>(
    tables,
    db,
    APPWRITE_TABLES.lavaFormSubmissions,
    [Query.equal("formId", formId)],
  );
  const fields = fieldRows.map(toFieldDefinition);

  for (const submission of submissionRows) {
    const fileIds = collectFileIdsFromAnswers(
      fields,
      parseSubmissionAnswers(submission.answersJson),
      parseMemberAnswers(submission.memberAnswersJson),
    );
    await Promise.all(fileIds.map((fileId) => deleteLavaFormFile(fileId, storage)));
    await tables.deleteRow(db, APPWRITE_TABLES.lavaFormSubmissions, submission.$id);
  }

  await Promise.all(
    fieldRows.map((row) => tables.deleteRow(db, APPWRITE_TABLES.lavaFormFields, row.$id)),
  );

  const uniqueRows = await listTableRows<{ $id: string }>(
    tables,
    db,
    APPWRITE_TABLES.lavaFormUniqueKeys,
    [Query.equal("formId", formId)],
  );
  await Promise.all(
    uniqueRows.map((row) => tables.deleteRow(db, APPWRITE_TABLES.lavaFormUniqueKeys, row.$id)),
  );

  const bannerId = form && typeof form.bannerFileId === "string" ? form.bannerFileId : "";
  if (bannerId) {
    await deleteLavaFormFile(bannerId, storage);
  }

  if (form) {
    await tables.deleteRow(db, APPWRITE_TABLES.lavaForms, formId);
  }
}

export async function syncLavaFormStatus(formId: string, connectionStatus: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const status = connectionStatus === "active" ? "open" : "closed";

  try {
    await tables.updateRow(env.NEXT_PUBLIC_APPWRITE_DATABASE_ID, APPWRITE_TABLES.lavaForms, formId, {
      status,
    });
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }
  }
}

export function diffIncomingFields(
  existing: FieldDefinition[],
  incoming: Array<Partial<FieldDefinition> & { id: string }>,
) {
  return diffFieldsForBulkSave(existing, incoming);
}

async function listTableRows<T extends { $id: string }>(
  tables: TablesClient,
  databaseId: string,
  tableId: string,
  queries: string[],
) {
  const rows: T[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 20; page += 1) {
    const pageQueries = [...queries, Query.limit(LIST_PAGE_SIZE)];
    if (cursor) {
      pageQueries.push(Query.cursorAfter(cursor));
    }

    const result = await tables.listRows(databaseId, tableId, pageQueries, undefined, false);
    const batch = result.rows as unknown as T[];
    if (batch.length === 0) {
      break;
    }

    rows.push(...batch);
    cursor = batch[batch.length - 1]?.$id;
    if (batch.length < LIST_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function loadSubmissionPage({
  eventId,
  filters,
  getFormWithFields,
  listAllRows,
}: {
  eventId: string;
  filters: SubmissionFilters;
  getFormWithFields: (formId: string) => Promise<FormWithFields | null>;
  listAllRows: <T extends { $id: string }>(tableId: string, queries: string[]) => Promise<T[]>;
}): Promise<SubmissionPage> {
  const formId = filters.formId;
  if (!formId) {
    return { page: 1, pageSize: filters.pageSize ?? 20, submissions: [], total: 0 };
  }

  const queries = [
    Query.equal("formId", formId),
    Query.equal("eventId", eventId),
    Query.orderDesc("createdAt"),
  ];
  if (filters.from) {
    queries.push(Query.greaterThanEqual("createdAt", filters.from));
  }
  if (filters.to) {
    queries.push(Query.lessThanEqual("createdAt", filters.to));
  }

  const rows = await listAllRows<LavaSubmissionRow>(APPWRITE_TABLES.lavaFormSubmissions, queries);
  const form = await getFormWithFields(formId);
  if (!form) {
    return { page: 1, pageSize: filters.pageSize ?? 20, submissions: [], total: 0 };
  }

  const details = rows
    .map((row) => toSubmissionDetail(row, form, form.fields))
    .filter((item) => matchesSubmissionSearch(item, filters.searchField, filters.searchQuery));

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize === "all" ? details.length || 1 : Math.max(1, filters.pageSize ?? 20);
  const start = filters.pageSize === "all" ? 0 : (page - 1) * pageSize;

  return {
    page,
    pageSize: filters.pageSize === "all" ? "all" : pageSize,
    submissions: details.slice(start, filters.pageSize === "all" ? undefined : start + pageSize),
    total: details.length,
  };
}

export function assertLavaFormId(formId: string) {
  if (!formId.trim()) {
    throw new ValidationError("Form id is required.");
  }
}
