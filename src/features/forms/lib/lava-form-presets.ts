import type { FieldWrite } from "@knurdz/lava-form-builder";
import type { FormConnection, FormConnectionPurpose } from "@/features/forms/types";

export type LavaPresetField = FieldWrite & { id: string };

export type LavaFormPreset = {
  description: string;
  fields: LavaPresetField[];
  groupAnswersDefault: boolean;
  label: string;
  teamMaxMembers: number;
  teamMinMembers: number;
};

const PURPOSE_META: Record<
  FormConnectionPurpose,
  { description: string; groupAnswersDefault: boolean; label: string }
> = {
  attendance: {
    description: "Mark who attended and capture short notes.",
    groupAnswersDefault: false,
    label: "Attendance",
  },
  feedback: {
    description: "Collect volunteer or attendee feedback.",
    groupAnswersDefault: false,
    label: "Feedback",
  },
  grading: {
    description: "Collect grading or scoring inputs for this event.",
    groupAnswersDefault: false,
    label: "Grading",
  },
  grant_request: {
    description: "Request funding or a grant for event work.",
    groupAnswersDefault: false,
    label: "Grant request",
  },
  oc_progress: {
    description: "Track OC / committee work progress and blockers.",
    groupAnswersDefault: false,
    label: "OC work progress",
  },
  other: {
    description: "General purpose form for this event.",
    groupAnswersDefault: false,
    label: "Other",
  },
  registration: {
    description: "Register volunteers or participants for this event.",
    groupAnswersDefault: false,
    label: "Volunteer registration",
  },
  team_registration: {
    description: "Register a group or team, with answers per member.",
    groupAnswersDefault: true,
    label: "Team registration",
  },
  tshirt_order: {
    description: "Collect T-shirt sizes and order details.",
    groupAnswersDefault: false,
    label: "T-shirt order",
  },
};

function field(
  id: string,
  input: {
    helpText?: string | null;
    isUnique?: boolean;
    key: string;
    label: string;
    options?: FieldWrite["options"];
    placeholder?: string | null;
    required?: boolean;
    scope: FieldWrite["scope"];
    sortOrder?: number;
    type: FieldWrite["type"];
    uniqueCaseSensitive?: boolean;
    validationPattern?: string | null;
    validationPatternMessage?: string | null;
  },
): LavaPresetField {
  return {
    helpText: input.helpText ?? null,
    id,
    isUnique: Boolean(input.isUnique),
    key: input.key,
    label: input.label,
    options: input.options ?? [],
    placeholder: input.placeholder ?? null,
    required: Boolean(input.required),
    scope: input.scope,
    sortOrder: input.sortOrder ?? 0,
    type: input.type,
    uniqueCaseSensitive: Boolean(input.uniqueCaseSensitive),
    validationPattern: input.validationPattern ?? null,
    validationPatternMessage: input.validationPatternMessage ?? null,
  };
}

function withSortOrder(fields: LavaPresetField[]): LavaPresetField[] {
  return fields.map((item, index) => ({ ...item, sortOrder: index }));
}

const SIZE_OPTIONS = [
  { label: "XS", value: "xs" },
  { label: "S", value: "s" },
  { label: "M", value: "m" },
  { label: "L", value: "l" },
  { label: "XL", value: "xl" },
  { label: "XXL", value: "xxl" },
];

export function getFormPurposeLabel(purpose: FormConnectionPurpose) {
  return PURPOSE_META[purpose]?.label ?? purpose;
}

export function getFormPurposeDescription(purpose: FormConnectionPurpose) {
  return PURPOSE_META[purpose]?.description ?? "";
}

export function getFormPurposeOptions() {
  return (Object.keys(PURPOSE_META) as FormConnectionPurpose[]).map((value) => ({
    description: PURPOSE_META[value].description,
    label: PURPOSE_META[value].label,
    value,
  }));
}

export function defaultGroupAnswersForPurpose(purpose: FormConnectionPurpose) {
  return PURPOSE_META[purpose]?.groupAnswersDefault ?? false;
}

export function isGroupAnswersEnabled(connection: FormConnection) {
  return connection.metadata?.groupAnswersEnabled === true;
}

export function isOperationalFormPurpose(purpose: FormConnectionPurpose) {
  return (
    purpose === "feedback" ||
    purpose === "attendance" ||
    purpose === "grading" ||
    purpose === "oc_progress"
  );
}

export function getLavaFormPreset(
  purpose: FormConnectionPurpose,
  groupAnswersEnabled = defaultGroupAnswersForPurpose(purpose),
): LavaFormPreset {
  const meta = PURPOSE_META[purpose];
  const teamMinMembers = groupAnswersEnabled ? (purpose === "team_registration" ? 2 : 2) : 1;
  const teamMaxMembers = groupAnswersEnabled ? (purpose === "team_registration" ? 5 : 10) : 1;

  let fields: LavaPresetField[] = [];

  switch (purpose) {
    case "registration":
      fields = [
        field("p_full_name", {
          key: "full_name",
          label: "Full name",
          required: true,
          scope: "submission",
          type: "text",
        }),
        field("p_email", {
          key: "email",
          label: "Email",
          required: true,
          scope: "submission",
          type: "email",
        }),
        field("p_phone", {
          key: "phone",
          label: "Phone",
          required: false,
          scope: "submission",
          type: "tel",
        }),
        field("p_faculty", {
          key: "faculty",
          label: "Faculty",
          required: false,
          scope: "submission",
          type: "text",
        }),
        field("p_ieee_number", {
          key: "ieee_number",
          label: "IEEE membership number",
          required: false,
          scope: "submission",
          type: "text",
        }),
        field("p_motivation", {
          key: "motivation",
          label: "Why do you want to join?",
          required: false,
          scope: "submission",
          type: "textarea",
        }),
      ];
      break;
    case "grant_request":
      fields = [
        field("p_request_title", {
          key: "request_title",
          label: "Request title",
          required: true,
          scope: "submission",
          type: "text",
        }),
        field("p_amount", {
          key: "amount",
          label: "Amount requested (LKR)",
          required: true,
          scope: "submission",
          type: "number",
        }),
        field("p_use_of_funds", {
          key: "use_of_funds",
          label: "Use of funds",
          required: true,
          scope: "submission",
          type: "textarea",
        }),
        field("p_timeline", {
          key: "timeline",
          label: "Timeline",
          required: false,
          scope: "submission",
          type: "text",
        }),
        field("p_contact", {
          key: "contact",
          label: "Contact person / email",
          required: true,
          scope: "submission",
          type: "text",
        }),
      ];
      break;
    case "tshirt_order":
      fields = [
        field("p_size", {
          key: "size",
          label: "T-shirt size",
          options: SIZE_OPTIONS,
          required: true,
          scope: "submission",
          type: "select",
        }),
        field("p_quantity", {
          key: "quantity",
          label: "Quantity",
          required: true,
          scope: "submission",
          type: "number",
        }),
        field("p_print_name", {
          key: "print_name",
          label: "Name / text for print",
          required: false,
          scope: "submission",
          type: "text",
        }),
        field("p_pickup_notes", {
          key: "pickup_notes",
          label: "Pickup notes",
          required: false,
          scope: "submission",
          type: "textarea",
        }),
      ];
      break;
    case "oc_progress":
      fields = [
        field("p_period", {
          key: "period",
          label: "Period / week",
          required: true,
          scope: "submission",
          type: "text",
        }),
        field("p_work_completed", {
          key: "work_completed",
          label: "Work completed",
          required: true,
          scope: "submission",
          type: "textarea",
        }),
        field("p_blockers", {
          key: "blockers",
          label: "Blockers",
          required: false,
          scope: "submission",
          type: "textarea",
        }),
        field("p_next_steps", {
          key: "next_steps",
          label: "Next steps",
          required: false,
          scope: "submission",
          type: "textarea",
        }),
      ];
      break;
    case "team_registration":
      fields = [
        field("p_team_name", {
          key: "team_name",
          label: "Team name",
          required: true,
          scope: "submission",
          type: "text",
        }),
        field("p_member_name", {
          key: "member_name",
          label: "Member full name",
          required: true,
          scope: groupAnswersEnabled ? "member" : "submission",
          type: "text",
        }),
        field("p_member_email", {
          key: "member_email",
          label: "Member email",
          required: true,
          scope: groupAnswersEnabled ? "member" : "submission",
          type: "email",
        }),
      ];
      break;
    case "feedback":
      fields = [
        field("p_rating", {
          key: "rating",
          label: "Overall rating (1-5)",
          required: true,
          scope: "submission",
          type: "number",
        }),
        field("p_what_went_well", {
          key: "what_went_well",
          label: "What went well?",
          required: false,
          scope: "submission",
          type: "textarea",
        }),
        field("p_improvements", {
          key: "improvements",
          label: "What could improve?",
          required: false,
          scope: "submission",
          type: "textarea",
        }),
      ];
      break;
    case "attendance":
      fields = [
        field("p_full_name", {
          key: "full_name",
          label: "Full name",
          required: true,
          scope: "submission",
          type: "text",
        }),
        field("p_attended", {
          key: "attended",
          label: "Did you attend?",
          options: [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ],
          required: true,
          scope: "submission",
          type: "radio",
        }),
        field("p_notes", {
          key: "notes",
          label: "Notes",
          required: false,
          scope: "submission",
          type: "textarea",
        }),
      ];
      break;
    case "grading":
      fields = [
        field("p_volunteer_name", {
          key: "volunteer_name",
          label: "Volunteer name",
          required: true,
          scope: "submission",
          type: "text",
        }),
        field("p_score", {
          key: "score",
          label: "Score",
          required: true,
          scope: "submission",
          type: "number",
        }),
        field("p_comments", {
          key: "comments",
          label: "Comments",
          required: false,
          scope: "submission",
          type: "textarea",
        }),
      ];
      break;
    default:
      fields = [
        field("p_response", {
          key: "response",
          label: "Your response",
          required: true,
          scope: "submission",
          type: "textarea",
        }),
      ];
      break;
  }

  if (groupAnswersEnabled && purpose !== "team_registration") {
    // Keep submission-scoped presets; chairs can add per-member fields in the builder.
  }

  return {
    description: meta.description,
    fields: withSortOrder(fields),
    groupAnswersDefault: meta.groupAnswersDefault,
    label: meta.label,
    teamMaxMembers,
    teamMinMembers,
  };
}
