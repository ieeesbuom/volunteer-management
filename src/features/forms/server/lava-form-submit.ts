import "server-only";

import type {
  FieldDefinition,
  FormWithFields,
  LavaFormStore,
  SubmissionAnswers,
  SubmissionAnswerValue,
  SubmitFormState,
  UniqueReserveEntry,
} from "@knurdz/lava-form-builder";
import { getLavaFormAvailability } from "@/features/forms/lib/lava-availability";

export class UniqueFieldConflictError extends Error {
  fieldErrors: Record<string, string>;

  constructor(fieldErrors: Record<string, string>) {
    super("One or more fields must be unique.");
    this.name = "UniqueFieldConflictError";
    this.fieldErrors = fieldErrors;
  }
}

export class FormSubmissionNotAllowedError extends Error {
  formId: string | null;

  constructor(message: string, formId: string | null = null) {
    super(message);
    this.name = "FormSubmissionNotAllowedError";
    this.formId = formId;
  }
}

const HONEYPOT_FIELD_NAME = "registration_url";
const MAX_TOTAL_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

function parseDateParts(value: string): string | null {
  const trimmed = value.trim();
  let m = trimmed.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) {
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  m = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) {
    const y = Number(m[3]);
    const mo = Number(m[2]);
    const d = Number(m[1]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) {
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

function formDataToFieldsRecord(formData: FormData): Record<string, string | string[]> {
  const fields: Record<string, string | string[]> = {};
  for (const [key, value] of Array.from(formData.entries())) {
    if (typeof value === "string") {
      if (fields[key] !== undefined) {
        if (Array.isArray(fields[key])) {
          (fields[key] as string[]).push(value);
        } else {
          fields[key] = [fields[key] as string, value];
        }
      } else {
        fields[key] = value;
      }
    }
  }
  return fields;
}

function coerceFieldValue(field: FieldDefinition, raw: unknown): SubmissionAnswerValue {
  if (field.type === "page_break") {
    return null;
  }
  if (field.type === "checkbox") {
    return Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
  }
  let val = raw;
  if (Array.isArray(val)) {
    val = val[0] ?? null;
  }
  if (field.type === "file") {
    return val instanceof File && val.size > 0 ? val : null;
  }
  if (typeof val !== "string") {
    return null;
  }
  const trimmed = val.trim();
  if (!trimmed) {
    return null;
  }
  if (field.type === "number") {
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : trimmed;
  }
  if (field.type === "date") {
    const isoDate = parseDateParts(trimmed);
    if (!isoDate) {
      return trimmed;
    }
    const [y, m, d] = isoDate.split("-");
    return `${y}/${m}/${d}`;
  }
  return trimmed;
}

function validatePattern(field: FieldDefinition, value: unknown): string | null {
  const pattern = field.validationPattern?.trim();
  if (!pattern) {
    return null;
  }
  try {
    let regex: RegExp;
    if (pattern.startsWith("/")) {
      const last = pattern.lastIndexOf("/");
      if (last > 0) {
        regex = new RegExp(pattern.slice(1, last), pattern.slice(last + 1));
      } else {
        regex = new RegExp(pattern);
      }
    } else {
      regex = new RegExp(pattern);
    }
    const valStr = typeof value === "number" ? String(value) : String(value ?? "");
    if (!regex.test(valStr)) {
      return field.validationPatternMessage?.trim() || `${field.label} format is invalid.`;
    }
  } catch {
    return null;
  }
  return null;
}

function validateFieldValue(field: FieldDefinition, value: unknown): string | null {
  if (field.type === "page_break") {
    return null;
  }
  if (field.type === "checkbox") {
    return field.required && (!Array.isArray(value) || value.length === 0)
      ? `Please select at least one option for ${field.label}.`
      : null;
  }
  if (field.type === "file") {
    if (field.required && !(value instanceof File)) {
      return `${field.label} is required. Please upload a file.`;
    }
    if (value instanceof File) {
      if (value.size > 10 * 1024 * 1024) {
        return `${field.label} must be less than 10MB.`;
      }
      const allowed = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowed.includes(value.type)) {
        return `${field.label} format is not supported. Please upload a PDF, Word document, or image.`;
      }
    }
    return null;
  }
  if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
    return field.required ? `${field.label} is required.` : null;
  }
  if (field.type === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return `${field.label} must be a valid number.`;
    }
    return validatePattern(field, value);
  }
  if (typeof value !== "string") {
    return `${field.label} has an invalid value.`;
  }
  if (field.type === "date" && !parseDateParts(value)) {
    return `${field.label} must use the yyyy/mm/dd format.`;
  }
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return `${field.label} must be a valid email address.`;
  }
  if (field.type === "tel" && !/^[+()\-\s0-9.]{7,24}$/.test(value)) {
    return `${field.label} must be a valid phone number.`;
  }
  if (field.type === "url") {
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return `${field.label} must be a valid URL.`;
      }
    } catch {
      return `${field.label} must be a valid URL.`;
    }
  }
  if (["select", "radio"].includes(field.type)) {
    const valid = new Set(field.options?.map((o) => o.value) ?? []);
    if (!valid.has(value)) {
      return `${field.label} has an invalid option.`;
    }
  }
  return validatePattern(field, value);
}

function computeUploadSize(records: Array<SubmissionAnswers>): number {
  let total = 0;
  for (const rec of records) {
    for (const val of Object.values(rec)) {
      if (val instanceof File) {
        total += val.size;
      }
    }
  }
  return total;
}

async function uploadAnswerFiles(
  store: LavaFormStore,
  answers: SubmissionAnswers,
  uploaded: string[],
) {
  for (const [key, value] of Object.entries(answers)) {
    if (value instanceof File) {
      const fileId = await store.uploadFile(value);
      answers[key] = fileId;
      uploaded.push(fileId);
    }
  }
}

export type LavaFormPlugins = {
  sheets?: {
    onSubmissionCreated?: (event: {
      form: FormWithFields;
      submission: unknown;
      payload: unknown;
    }) => Promise<void>;
  };
  email?: {
    onSubmissionCreated?: (event: {
      form: FormWithFields;
      submission: unknown;
      payload: unknown;
    }) => Promise<void>;
  };
};

export async function executeFormSubmission(
  store: LavaFormStore,
  form: FormWithFields,
  formData: FormData,
  plugins?: LavaFormPlugins,
): Promise<SubmitFormState> {
  const fields = formDataToFieldsRecord(formData);
  const honeypot = formData.get(HONEYPOT_FIELD_NAME);
  if (typeof honeypot === "string" && honeypot.trim()) {
    return {
      fieldErrors: {},
      fields,
      message: "Unable to submit right now. Please refresh and try again.",
      status: "error",
      toastKey: Date.now(),
    };
  }

  const availability = getLavaFormAvailability(form);
  if (!availability.isAcceptingSubmissions) {
    return {
      fieldErrors: {},
      fields,
      message: availability.description
        ? `This form is not accepting submissions. ${availability.description}`
        : "This form is not accepting submissions right now.",
      status: "error",
      toastKey: Date.now(),
    };
  }

  const fieldErrors: Record<string, string> = {};
  const submissionFields = form.fields.filter(
    (f) => f.scope === "submission" && f.type !== "page_break",
  );
  const memberFields = form.fields.filter(
    (f) => f.scope === "member" && f.type !== "page_break",
  );
  const answers: SubmissionAnswers = {};
  const uniqueReservations: UniqueReserveEntry[] = [];

  for (const field of submissionFields) {
    const key = `submission__${field.key}`;
    const rawValue = field.type === "checkbox" ? formData.getAll(key) : formData.get(key);
    const value = coerceFieldValue(field, rawValue);
    const error = validateFieldValue(field, value);
    if (error) {
      fieldErrors[key] = error;
    }
    answers[field.key] = value;
    if (!error && field.isUnique) {
      uniqueReservations.push({ errorKey: key, field, value });
    }
  }

  const memberAnswers: SubmissionAnswers[] = [];
  if (memberFields.length > 0) {
    const rawMemberCount = formData.get("memberCount");
    const memberCount = Number(typeof rawMemberCount === "string" ? rawMemberCount.trim() : "");
    if (
      !Number.isInteger(memberCount) ||
      memberCount < form.teamMinMembers ||
      memberCount > form.teamMaxMembers
    ) {
      fieldErrors.memberCount = `Team size must be between ${form.teamMinMembers} and ${form.teamMaxMembers} (including leader).`;
    } else {
      const extraMembers = Math.max(0, memberCount - 1);
      for (let p = 0; p < extraMembers; p += 1) {
        const memberAnswer: SubmissionAnswers = {};
        for (const field of memberFields) {
          const key = `member__${p}__${field.key}`;
          const rawValue = field.type === "checkbox" ? formData.getAll(key) : formData.get(key);
          const value = coerceFieldValue(field, rawValue);
          const error = validateFieldValue(field, value);
          if (error) {
            fieldErrors[key] = `Member ${p + 1}: ${error}`;
          }
          memberAnswer[field.key] = value;
          if (!error && field.isUnique) {
            uniqueReservations.push({ errorKey: key, field, value });
          }
        }
        memberAnswers.push(memberAnswer);
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      fields,
      message: "Please fix the highlighted fields and try again.",
      status: "error",
      toastKey: Date.now(),
    };
  }

  if (computeUploadSize([answers, ...memberAnswers]) > MAX_TOTAL_UPLOAD_BYTES) {
    return {
      fieldErrors: {},
      fields,
      message: "Combined uploads must be 25MB or less.",
      status: "error",
      toastKey: Date.now(),
    };
  }

  let reserved: string[] = [];
  try {
    reserved = await store.reserveUniqueValues({
      entries: uniqueReservations,
      formId: form.id,
    });
  } catch (error: unknown) {
    if (error instanceof UniqueFieldConflictError || (error as { fieldErrors?: Record<string, string> })?.fieldErrors) {
      return {
        fieldErrors: (error as { fieldErrors: Record<string, string> }).fieldErrors,
        fields,
        message: "Please fix the highlighted fields and try again.",
        status: "error",
        toastKey: Date.now(),
      };
    }
    return {
      fieldErrors: {},
      fields,
      message: "Unable to verify unique field values right now. Please try again.",
      status: "error",
      toastKey: Date.now(),
    };
  }

  const uploadedFiles: string[] = [];
  try {
    await uploadAnswerFiles(store, answers, uploadedFiles);
    for (const member of memberAnswers) {
      await uploadAnswerFiles(store, member, uploadedFiles);
    }

    const payload = {
      answers,
      formId: form.id,
      memberAnswers,
      teamName: null,
    };
    const { id: submissionId } = await store.createSubmission(payload);
    await store.attachUniqueReservations(reserved, submissionId);

    if (plugins) {
      const submission = await store.getSubmissionById(submissionId);
      if (submission) {
        const eventPayload = { form, payload, submission };
        await plugins.sheets?.onSubmissionCreated?.(eventPayload);
        await plugins.email?.onSubmissionCreated?.(eventPayload);
      }
    }

    return {
      fieldErrors: {},
      message: form.successMessage || "Your response has been recorded successfully.",
      status: "success",
      toastKey: Date.now(),
    };
  } catch (error: unknown) {
    try {
      await store.releaseUniqueReservations(reserved);
    } catch {
      // Ignore rollback failure
    }
    try {
      await store.deleteFiles(uploadedFiles);
    } catch {
      // Ignore file delete failure
    }

    if (error instanceof UniqueFieldConflictError || (error as { fieldErrors?: Record<string, string> })?.fieldErrors) {
      return {
        fieldErrors: (error as { fieldErrors: Record<string, string> }).fieldErrors,
        fields,
        message: "Please fix the highlighted fields and try again.",
        status: "error",
        toastKey: Date.now(),
      };
    }

    if (error instanceof FormSubmissionNotAllowedError || (error as Error)?.message) {
      return {
        fieldErrors: {},
        fields,
        message: (error as Error).message,
        status: "error",
        toastKey: Date.now(),
      };
    }

    return {
      fieldErrors: {},
      fields,
      message: "Unable to submit right now. Please try again.",
      status: "error",
      toastKey: Date.now(),
    };
  }
}
