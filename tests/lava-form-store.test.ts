import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppwriteException } from "node-appwrite";
import { UniqueFieldConflictError } from "@knurdz/lava-form-builder";

vi.mock("server-only", () => ({}));

const permissionMocks = vi.hoisted(() => ({
  canManageFormConnectionsForEvent: vi.fn(async () => true),
}));

vi.mock("@/features/forms/server/permissions", () => permissionMocks);

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ NEXT_PUBLIC_APPWRITE_DATABASE_ID: "db" }),
}));

vi.mock("@/server/appwrite", () => ({
  getAppwriteAdminServices: () => ({ tables: {} }),
  getAppwriteAdminClient: () => ({}),
}));

vi.mock("@/features/forms/server/lava-form-files", () => ({
  deleteLavaFormFile: vi.fn(),
  getLavaFormStorage: () => ({}),
  uploadLavaFormFile: vi.fn(),
}));

import { createLavaFormStore } from "../src/features/forms/server/lava-form-store";
import {
  diffFieldsForBulkSave,
  fieldWriteToRow,
  LAVA_FIELD_LIMITS,
  toFieldDefinition,
  uniqueReservationKey,
  uniquifyFieldKeys,
} from "../src/features/forms/lib/lava-form-mappers";
import { normalizeLavaScheduleInstant } from "../src/features/forms/lib/lava-schedule";
import type { SessionUser } from "../src/features/access-control/types";

function fakeUser(): SessionUser {
  return {
    authUser: { email: "chair@example.com", id: "user-a", name: "Chair" },
    eventRoles: [],
    isAdmin: true,
    profile: {
      $id: "user-a",
      authUserId: "user-a",
      googleEmail: "chair@example.com",
      status: "ACTIVE",
      uomVerified: true,
    },
    sbRoles: [],
  };
}

describe("lava form mappers", () => {
  it("maps a created field row including JSON options", () => {
    const row = fieldWriteToRow("form-1", {
      helpText: null,
      isUnique: true,
      key: "ieee_number",
      label: "IEEE number",
      options: [{ label: "Yes", value: "yes" }],
      placeholder: null,
      required: true,
      scope: "submission",
      sortOrder: 2,
      type: "select",
      uniqueCaseSensitive: false,
      validationPattern: null,
      validationPatternMessage: null,
    });

    expect(row.optionsJson).toBe(JSON.stringify([{ label: "Yes", value: "yes" }]));
    expect(
      toFieldDefinition({
        $id: "field-1",
        ...row,
      }),
    ).toMatchObject({
      formId: "form-1",
      id: "field-1",
      isUnique: true,
      key: "ieee_number",
      options: [{ label: "Yes", value: "yes" }],
      type: "select",
    });
  });

  it("builds a stable unique reservation key", () => {
    expect(uniqueReservationKey("form-1", "field-1", "abc")).toBe("form-1:field-1:abc");
  });

  it("truncates FormBuilder keys and labels to Appwrite column limits", () => {
    const row = fieldWriteToRow("form-1", {
      helpText: null,
      isUnique: false,
      key: "A".repeat(200),
      label: "Q".repeat(200),
      options: [],
      placeholder: null,
      required: false,
      scope: "submission",
      sortOrder: 0,
      type: "text",
      uniqueCaseSensitive: false,
      validationPattern: null,
      validationPatternMessage: null,
    });

    expect(row.key).toHaveLength(LAVA_FIELD_LIMITS.key);
    expect(row.label).toHaveLength(LAVA_FIELD_LIMITS.label);
  });

  it("uniquifies duplicate question keys so answers do not collide", () => {
    expect(
      uniquifyFieldKeys([
        { id: "a", key: "name", scope: "submission" as const },
        { id: "b", key: "name", scope: "submission" as const },
      ]).map((field) => field.key),
    ).toEqual(["name", "name_2"]);
  });

  it("keeps draft field ids as creates when bulk-saving new questions", () => {
    const diff = diffFieldsForBulkSave(
      [],
      [
        {
          id: "draft-1786470148261",
          key: "name",
          label: "Name",
          type: "text",
          scope: "submission",
          sortOrder: 0,
        },
      ],
    );

    expect(diff.creates).toHaveLength(1);
    expect(diff.creates[0]?.id).toBe("draft-1786470148261");
    expect(diff.updates).toHaveLength(0);
  });
});

describe("lava schedule parsing", () => {
  it("normalizes FormBuilder yyyy/mm/dd values to ISO instants", () => {
    expect(normalizeLavaScheduleInstant("2026/08/11")).toBe("2026-08-10T18:30:00.000Z");
    expect(normalizeLavaScheduleInstant("2026/08/11", true)).toBe("2026-08-11T18:29:59.999Z");
  });
});

describe("lava form store unique reservations", () => {
  const createRow = vi.fn();
  const tables = {
    createRow,
    deleteRow: vi.fn(),
    getRow: vi.fn(),
    listRows: vi.fn(),
    updateRow: vi.fn(),
  };

  beforeEach(() => {
    createRow.mockReset();
    tables.deleteRow.mockReset();
    tables.getRow.mockReset();
    permissionMocks.canManageFormConnectionsForEvent.mockResolvedValue(true);
    tables.getRow.mockResolvedValue({
      $id: "form-1",
      eventId: "event-1",
      status: "open",
    });
  });

  it("throws UniqueFieldConflictError when Appwrite reports a unique key conflict", async () => {
    tables.getRow.mockImplementation(async (_db: string, tableId: string) => {
      if (tableId === "lava_forms") {
        return {
          $id: "form-1",
          connectionId: "conn-1",
          eventId: "event-1",
          status: "open",
        };
      }

      throw new Error("unexpected table");
    });

    const connections = {
      create: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(async () => ({
        createdAt: "2026-01-01T00:00:00.000Z",
        createdBy: "user-a",
        eventId: "event-1",
        externalFormId: "form-1",
        id: "conn-1",
        provider: "lava" as const,
        purpose: "registration" as const,
        status: "active" as const,
        title: "Custom",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })),
      list: vi.fn(async () => []),
      update: vi.fn(),
    };

    createRow.mockRejectedValue(new AppwriteException("already exists", 409));

    const store = createLavaFormStore({
      connectionRepository: connections,
      databaseId: "db",
      eventId: "event-1",
      tables,
      user: fakeUser(),
    });

    await expect(
      store.reserveUniqueValues({
        entries: [
          {
            errorKey: "ieee_number",
            field: {
              formId: "form-1",
              helpText: null,
              id: "field-1",
              isUnique: true,
              key: "ieee_number",
              label: "IEEE number",
              options: [],
              placeholder: null,
              required: true,
              scope: "submission",
              sortOrder: 0,
              type: "text",
              uniqueCaseSensitive: false,
              validationPattern: null,
              validationPatternMessage: null,
            },
            value: "12345",
          },
        ],
        formId: "form-1",
      }),
    ).rejects.toBeInstanceOf(UniqueFieldConflictError);
  });

  it("creates a field against the event-scoped form", async () => {
    tables.getRow.mockResolvedValue({
      $id: "form-1",
      eventId: "event-1",
    });
    createRow.mockResolvedValue({ $id: "field-1" });

    const store = createLavaFormStore({
      connectionRepository: {
        create: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(),
        list: vi.fn(async () => []),
        update: vi.fn(),
      },
      databaseId: "db",
      eventId: "event-1",
      tables,
      user: fakeUser(),
    });

    await expect(
      store.createField({
        formId: "form-1",
        helpText: null,
        isUnique: false,
        key: "name",
        label: "Name",
        options: [],
        placeholder: null,
        required: true,
        scope: "submission",
        sortOrder: 0,
        type: "text",
        uniqueCaseSensitive: false,
        validationPattern: null,
        validationPatternMessage: null,
      }),
    ).resolves.toEqual({ id: "field-1" });

    expect(createRow).toHaveBeenCalledWith(
      "db",
      "lava_form_fields",
      expect.any(String),
      expect.objectContaining({
        formId: "form-1",
        key: "name",
        label: "Name",
      }),
    );
  });
});
