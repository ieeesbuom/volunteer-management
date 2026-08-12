import type {
  FieldDefinition,
  FieldOption,
  FieldType,
  FieldWrite,
  FieldUpdate,
  FormDefinition,
  FormStatus,
  SubmissionAnswers,
  SubmissionDetail,
} from "@knurdz/lava-form-builder";
import { lavaFileProxyPath } from "@/features/forms/lib/lava-paths";

export const LAVA_ANSWERS_JSON_MAX_CHARS = 65_000;

export const LAVA_FIELD_LIMITS = {
  helpText: 500,
  key: 80,
  label: 160,
  optionsJson: 8000,
  placeholder: 240,
  validationPattern: 240,
  validationPatternMessage: 240,
} as const;

export const LAVA_FORM_LIMITS = {
  closeAt: 40,
  confirmationEmailTemplate: 5000,
  description: 2000,
  kind: 64,
  openAt: 40,
  slug: 80,
  successMessage: 2000,
  title: 160,
  googleSheetsSheetTitle: 160,
} as const;

const APPWRITE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;
const FIELD_TYPES = new Set<FieldType>([
  "text",
  "textarea",
  "email",
  "tel",
  "url",
  "number",
  "select",
  "radio",
  "checkbox",
  "date",
  "time",
  "file",
  "page_break",
]);

export type LavaFormRow = {
  $id: string;
  eventId?: unknown;
  connectionId?: unknown;
  createdBy?: unknown;
  slug?: unknown;
  title?: unknown;
  description?: unknown;
  kind?: unknown;
  status?: unknown;
  openAt?: unknown;
  closeAt?: unknown;
  successMessage?: unknown;
  confirmationEmailEnabled?: unknown;
  confirmationEmailTemplate?: unknown;
  confirmationEmailFieldId?: unknown;
  confirmationNameFieldId?: unknown;
  confirmationEmailSelectedFieldIds?: unknown;
  googleSheetsSyncEnabled?: unknown;
  googleSheetsSelectedFieldIds?: unknown;
  googleSheetsAdminUserId?: unknown;
  googleSheetsSheetTitle?: unknown;
  teamMinMembers?: unknown;
  teamMaxMembers?: unknown;
  bannerFileId?: unknown;
  sortOrder?: unknown;
};

export type LavaFieldRow = {
  $id: string;
  formId?: unknown;
  scope?: unknown;
  key?: unknown;
  label?: unknown;
  type?: unknown;
  required?: unknown;
  sortOrder?: unknown;
  optionsJson?: unknown;
  placeholder?: unknown;
  helpText?: unknown;
  isUnique?: unknown;
  uniqueCaseSensitive?: unknown;
  validationPattern?: unknown;
  validationPatternMessage?: unknown;
};

export type LavaSubmissionRow = {
  $id: string;
  formId?: unknown;
  eventId?: unknown;
  submittedBy?: unknown;
  answersJson?: unknown;
  memberAnswersJson?: unknown;
  teamName?: unknown;
  createdAt?: unknown;
  $createdAt?: string;
};

export function isValidAppwriteId(value: string) {
  return APPWRITE_ID_PATTERN.test(value);
}

export function slugifyFormTitle(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "form";
}

export function optionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function parseFieldOptions(value: unknown): FieldOption[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label : "";
      const optionValue = typeof record.value === "string" ? record.value : label;
      if (!label && !optionValue) {
        return [];
      }

      return [{ label: label || optionValue, value: optionValue || label }];
    });
  } catch {
    return [];
  }
}

export function parseSubmissionAnswers(value: unknown): SubmissionAnswers {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as SubmissionAnswers;
  }

  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as SubmissionAnswers)
      : {};
  } catch {
    return {};
  }
}

export function parseMemberAnswers(value: unknown): SubmissionAnswers[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is SubmissionAnswers => Boolean(item) && typeof item === "object",
    );
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is SubmissionAnswers => Boolean(item) && typeof item === "object",
        )
      : [];
  } catch {
    return [];
  }
}

export function serializeJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

export function fitLavaString(value: string | null | undefined, max: number, fallback = "") {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return fallback;
  }

  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

function serializeFieldOptions(options: FieldOption[] | undefined) {
  const list = Array.isArray(options) ? options : [];
  let json = JSON.stringify(list);
  if (json.length <= LAVA_FIELD_LIMITS.optionsJson) {
    return json;
  }

  const trimmed = [...list];
  while (trimmed.length > 0) {
    trimmed.pop();
    json = JSON.stringify(trimmed);
    if (json.length <= LAVA_FIELD_LIMITS.optionsJson) {
      return json;
    }
  }

  return "[]";
}

export function uniquifyFieldKeys<T extends { key: string; scope?: string }>(fields: T[]): T[] {
  const used = new Set<string>();

  return fields.map((field) => {
    const scope = field.scope === "member" ? "member" : "submission";
    const base = fitLavaString(field.key, LAVA_FIELD_LIMITS.key, "field") || "field";
    let key = base;
    let suffix = 2;
    while (used.has(`${scope}:${key}`)) {
      const extra = `_${suffix}`;
      key = `${base.slice(0, LAVA_FIELD_LIMITS.key - extra.length)}${extra}`;
      suffix += 1;
    }
    used.add(`${scope}:${key}`);
    return { ...field, key, scope };
  });
}

export function serializeAnswers(value: SubmissionAnswers | SubmissionAnswers[]) {
  const json = JSON.stringify(value, (_key, item) => {
    if (typeof File !== "undefined" && item instanceof File) {
      return undefined;
    }

    return item;
  });

  if (json.length > LAVA_ANSWERS_JSON_MAX_CHARS) {
    throw new Error("Form answers are too large to store.");
  }

  return json;
}

export function toFormDefinition(row: LavaFormRow): FormDefinition {
  const status = row.status === "open" || row.status === "closed" ? row.status : "draft";

  return {
    bannerFileId: optionalString(row.bannerFileId),
    closeAt: optionalString(row.closeAt),
    confirmationEmailEnabled: Boolean(row.confirmationEmailEnabled),
    confirmationEmailFieldId: optionalString(row.confirmationEmailFieldId),
    confirmationEmailSelectedFieldIds: parseJsonArray(row.confirmationEmailSelectedFieldIds),
    confirmationEmailTemplate: optionalString(row.confirmationEmailTemplate),
    confirmationNameFieldId: optionalString(row.confirmationNameFieldId),
    description: optionalString(row.description),
    googleSheetsAdminUserId: optionalString(row.googleSheetsAdminUserId),
    googleSheetsSelectedFieldIds: parseJsonArray(row.googleSheetsSelectedFieldIds),
    googleSheetsSheetTitle: optionalString(row.googleSheetsSheetTitle),
    googleSheetsSyncEnabled: Boolean(row.googleSheetsSyncEnabled),
    id: row.$id,
    kind: optionalString(row.kind) ?? "competition",
    openAt: optionalString(row.openAt),
    slug: optionalString(row.slug) ?? row.$id,
    sortOrder: Number(row.sortOrder ?? 0),
    status: status as FormStatus,
    successMessage: optionalString(row.successMessage),
    teamMaxMembers: Math.max(1, Number(row.teamMaxMembers ?? 1)),
    teamMinMembers: Math.max(1, Number(row.teamMinMembers ?? 1)),
    title: optionalString(row.title) ?? "Untitled form",
  };
}

export function toFieldDefinition(row: LavaFieldRow): FieldDefinition {
  const type = FIELD_TYPES.has(row.type as FieldType) ? (row.type as FieldType) : "text";

  return {
    formId: String(row.formId ?? ""),
    helpText: optionalString(row.helpText),
    id: row.$id,
    isUnique: Boolean(row.isUnique),
    key: optionalString(row.key) ?? row.$id,
    label: optionalString(row.label) ?? "Question",
    options: parseFieldOptions(row.optionsJson),
    placeholder: optionalString(row.placeholder),
    required: Boolean(row.required),
    scope: row.scope === "member" ? "member" : "submission",
    sortOrder: Number(row.sortOrder ?? 0),
    type,
    uniqueCaseSensitive: Boolean(row.uniqueCaseSensitive),
    validationPattern: optionalString(row.validationPattern),
    validationPatternMessage: optionalString(row.validationPatternMessage),
  };
}

export function fieldWriteToRow(formId: string, field: FieldWrite) {
  return {
    formId,
    helpText: fitLavaString(field.helpText, LAVA_FIELD_LIMITS.helpText),
    isUnique: Boolean(field.isUnique),
    key: fitLavaString(field.key, LAVA_FIELD_LIMITS.key, "field") || "field",
    label: fitLavaString(field.label, LAVA_FIELD_LIMITS.label, "Question") || "Question",
    optionsJson: serializeFieldOptions(field.options),
    placeholder: fitLavaString(field.placeholder, LAVA_FIELD_LIMITS.placeholder),
    required: Boolean(field.required),
    scope: field.scope === "member" ? "member" : "submission",
    sortOrder: Number.isFinite(field.sortOrder) ? field.sortOrder : 0,
    type: FIELD_TYPES.has(field.type) ? field.type : "text",
    uniqueCaseSensitive: Boolean(field.uniqueCaseSensitive),
    validationPattern: fitLavaString(field.validationPattern, LAVA_FIELD_LIMITS.validationPattern),
    validationPatternMessage: fitLavaString(
      field.validationPatternMessage,
      LAVA_FIELD_LIMITS.validationPatternMessage,
    ),
  };
}

export function normalizeUniqueValue(value: unknown, caseSensitive: boolean) {
  const raw = Array.isArray(value)
    ? value.map((item) => String(item)).join("|")
    : value == null
      ? ""
      : String(value);

  const trimmed = raw.trim();
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

export function uniqueReservationKey(formId: string, fieldId: string, normalizedValue: string) {
  return `${formId}:${fieldId}:${normalizedValue}`.slice(0, 400);
}

export function collectFileIdsFromAnswers(
  fields: FieldDefinition[],
  answers: SubmissionAnswers,
  memberAnswers: SubmissionAnswers[],
) {
  const fileKeys = new Set(
    fields.filter((field) => field.type === "file").map((field) => field.key),
  );
  const ids = new Set<string>();

  const collect = (record: SubmissionAnswers) => {
    for (const [key, value] of Object.entries(record)) {
      if (!fileKeys.has(key)) {
        continue;
      }

      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        if (typeof item === "string" && isValidAppwriteId(item)) {
          ids.add(item);
        }
      }
    }
  };

  collect(answers);
  for (const member of memberAnswers) {
    collect(member);
  }

  return [...ids];
}

export function rewriteFileAnswers(
  fields: FieldDefinition[],
  answers: SubmissionAnswers,
): SubmissionAnswers {
  const fileKeys = new Set(
    fields.filter((field) => field.type === "file").map((field) => field.key),
  );
  const next: SubmissionAnswers = { ...answers };

  for (const key of fileKeys) {
    const value = next[key];
    if (typeof value === "string" && isValidAppwriteId(value)) {
      next[key] = lavaFileProxyPath(value);
    } else if (Array.isArray(value)) {
      next[key] = value.map((item) =>
        typeof item === "string" && isValidAppwriteId(item) ? lavaFileProxyPath(item) : item,
      ) as string[];
    }
  }

  return next;
}

export function toSubmissionDetail(
  row: LavaSubmissionRow,
  form: FormDefinition,
  fields: FieldDefinition[],
): SubmissionDetail {
  const answers = rewriteFileAnswers(fields, parseSubmissionAnswers(row.answersJson));
  const memberAnswers = parseMemberAnswers(row.memberAnswersJson).map((member) =>
    rewriteFileAnswers(fields, member),
  );
  const teamName = optionalString(row.teamName);
  const createdAt =
    optionalString(row.createdAt) ??
    (typeof row.$createdAt === "string" ? row.$createdAt : new Date().toISOString());
  const firstAnswer = Object.values(answers).find(
    (value) => typeof value === "string" && value.trim(),
  );

  return {
    answers,
    createdAt,
    displaySubtitle: teamName,
    displayTitle:
      teamName ||
      (typeof firstAnswer === "string" ? firstAnswer : null) ||
      "Submission",
    formId: String(row.formId ?? form.id),
    formSlug: form.slug,
    formTitle: form.title,
    id: row.$id,
    memberAnswers,
    teamName,
  };
}

export function diffFieldsForBulkSave(
  existing: FieldDefinition[],
  incoming: Array<Partial<FieldDefinition> & { id: string }>,
): {
  creates: Array<FieldWrite & { id: string }>;
  updates: FieldUpdate[];
  deletes: string[];
} {
  const existingIds = new Set(existing.map((field) => field.id));
  const incomingIds = new Set(incoming.map((field) => field.id));
  const creates: Array<FieldWrite & { id: string }> = [];
  const updates: FieldUpdate[] = [];
  const uniqued = uniquifyFieldKeys(
    incoming.map((field) => ({
      ...field,
      key: field.key ?? field.id,
      scope: field.scope === "member" ? "member" : "submission",
    })),
  );

  for (const field of uniqued) {
    const write: FieldWrite = {
      helpText: field.helpText ?? null,
      isUnique: Boolean(field.isUnique),
      key: field.key,
      label: field.label ?? "Question",
      options: field.options ?? [],
      placeholder: field.placeholder ?? null,
      required: Boolean(field.required),
      scope: field.scope === "member" ? "member" : "submission",
      sortOrder: Number(field.sortOrder ?? 0),
      type: FIELD_TYPES.has(field.type as FieldType) ? (field.type as FieldType) : "text",
      uniqueCaseSensitive: Boolean(field.uniqueCaseSensitive),
      validationPattern: field.validationPattern ?? null,
      validationPatternMessage: field.validationPatternMessage ?? null,
    };

    if (existingIds.has(field.id)) {
      updates.push({ ...write, fieldId: field.id });
    } else {
      creates.push({ ...write, id: field.id });
    }
  }

  return {
    creates,
    deletes: existing.filter((field) => !incomingIds.has(field.id)).map((field) => field.id),
    updates,
  };
}

export function matchesSubmissionSearch(
  submission: SubmissionDetail,
  searchField: string | null | undefined,
  searchQuery: string | null | undefined,
) {
  const query = searchQuery?.trim().toLowerCase();
  if (!query) {
    return true;
  }

  const haystacks: string[] = [
    submission.displayTitle,
    submission.displaySubtitle ?? "",
    submission.teamName ?? "",
    JSON.stringify(submission.answers),
    JSON.stringify(submission.memberAnswers),
  ];

  if (searchField) {
    const scoped = submission.answers[searchField];
    haystacks.push(scoped == null ? "" : String(scoped));
  }

  return haystacks.some((item) => item.toLowerCase().includes(query));
}
