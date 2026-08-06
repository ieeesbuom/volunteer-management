import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const eventHelperMocks = vi.hoisted(() => ({
  getPermissionsForUser: vi.fn(),
  requireVisibleEvent: vi.fn(),
}));

vi.mock("@/features/events/server/event-route-helpers", () => eventHelperMocks);

import {
  canListFormConnections,
  canManageFormConnections,
  canListFormConnectionsForEvent,
} from "../src/features/forms/server/permissions";
import { createFormConnectionService } from "../src/features/forms/server/form-connection-service";
import { createFormConnectionSchema, updateFormConnectionSchema } from "../src/features/forms/validation";
import type { FormConnectionRepository } from "../src/features/forms/server/form-connection-repository";
import type {
  CreateFormConnectionInput,
  FormConnection,
} from "../src/features/forms/types";
import type { SessionUser } from "../src/features/access-control/types";

describe("form connections", () => {
  beforeEach(() => {
    eventHelperMocks.requireVisibleEvent.mockResolvedValue({
      event: {
        $createdAt: "2026-06-01T00:00:00.000Z",
        $id: "event-1",
        $updatedAt: "2026-06-01T00:00:00.000Z",
        conclusion_status: "not_submitted",
        created_at: "2026-06-01T00:00:00.000Z",
        created_by: "chair-a",
        reference: "EVT-1",
        start_date: "2026-06-01T00:00:00.000Z",
        status: "published",
        term: "26/27",
        title: "MoraForesight",
        updated_at: "2026-06-01T00:00:00.000Z",
        year: 2026,
      },
      userEventRole: "Chair",
    });
    eventHelperMocks.getPermissionsForUser.mockReturnValue({
      canApproveConclusion: false,
      canAssignRoles: true,
      canDelete: false,
      canEdit: false,
      canManageCommittee: true,
      canPublish: false,
      canSubmitConclusion: true,
    });
  });

  it("stores external form references instead of builder definitions", async () => {
    const repository = createFakeFormConnectionRepository();
    const service = createFormConnectionService({
      now: fixedNow,
      repository,
    });

    const connection = await service.createFormConnection({
      input: {
        eventId: "event-1",
        externalFormId: "google-form-id",
        formUrl: "https://docs.google.com/forms/d/example/viewform",
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      },
      user: fakeUser({ isAdmin: true }),
    });

    expect(connection).toMatchObject({
      createdBy: "user-a",
      eventId: "event-1",
      externalFormId: "google-form-id",
      formUrl: "https://docs.google.com/forms/d/example/viewform",
      provider: "google_forms",
      purpose: "registration",
    });
    expect("fields" in connection).toBe(false);
    expect(eventHelperMocks.requireVisibleEvent).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ isAdmin: true }),
    );
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        fields: [{ label: "Name" }],
        formUrl: "https://docs.google.com/forms/d/example/viewform",
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      }),
    ).toThrow();
  });

  it("rejects secrets and unsupported provider or status values", () => {
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        formUrl: "https://docs.google.com/forms/d/example/viewform?token=secret",
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      }),
    ).toThrow();
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        formUrl: "https://docs.google.com/forms/d/example/viewform",
        metadata: { apiKey: "secret" },
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      }),
    ).toThrow();
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        formUrl: "https://docs.google.com/forms/d/example/viewform",
        provider: "typeform",
        purpose: "registration",
        title: "Registration form",
      }),
    ).toThrow();
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        formUrl: "https://docs.google.com/forms/d/example/viewform",
        provider: "google_forms",
        purpose: "registration",
        status: "enabled",
        title: "Registration form",
      }),
    ).toThrow();
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        formUrl: "http://docs.google.com/forms/d/example/viewform",
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      }),
    ).toThrow("HTTPS");
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        formUrl: "https://example.com/forms/d/example/viewform",
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      }),
    ).toThrow("selected provider");
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        formUrl: "https://forms.gle/example?access_token=secret",
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      }),
    ).toThrow("secret");
    expect(() =>
      createFormConnectionSchema.parse({
        eventId: "event-1",
        externalFormId: "https://docs.google.com/forms/d/secret-token/viewform",
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      }),
    ).toThrow("stable references");
  });

  it("validates updates with updateFormConnectionSchema supporting partial payloads", () => {
    const valid = updateFormConnectionSchema.parse({
      title: "Updated Title",
    });
    expect(valid.title).toBe("Updated Title");

    const validUrl = updateFormConnectionSchema.parse({
      formUrl: "https://docs.google.com/forms/d/example/viewform",
      provider: "google_forms",
    });
    expect(validUrl.formUrl).toBe("https://docs.google.com/forms/d/example/viewform");

    expect(() =>
      updateFormConnectionSchema.parse({
        formUrl: "https://example.com/invalid-provider-url",
        provider: "google_forms",
      }),
    ).toThrow("selected provider");
  });

  it("updates status and metadata without deleting other fields like formUrl", async () => {
    const repository = createFakeFormConnectionRepository();
    const service = createFormConnectionService({
      now: fixedNow,
      repository,
    });

    const conn = await service.createFormConnection({
      input: {
        eventId: "event-1",
        formUrl: "https://docs.google.com/forms/d/example/viewform",
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      },
      user: fakeUser({ isAdmin: true }),
    });

    const updated = await service.updateFormConnection({
      id: conn.id,
      input: {
        status: "disabled",
      },
      user: fakeUser({ isAdmin: true }),
    });

    expect(updated.status).toBe("disabled");
    expect(updated.formUrl).toBe("https://docs.google.com/forms/d/example/viewform");
  });

  it("rejects form URL updates that do not match the stored provider when provider is omitted", async () => {
    const repository = createFakeFormConnectionRepository();
    const service = createFormConnectionService({
      now: fixedNow,
      repository,
    });

    const conn = await service.createFormConnection({
      input: {
        eventId: "event-1",
        formUrl: "https://docs.google.com/forms/d/example/viewform",
        provider: "google_forms",
        purpose: "registration",
        title: "Registration form",
      },
      user: fakeUser({ isAdmin: true }),
    });

    await expect(
      service.updateFormConnection({
        id: conn.id,
        input: {
          formUrl: "https://example.com/not-google-forms",
        },
        user: fakeUser({ isAdmin: true }),
      }),
    ).rejects.toThrow("approved for the selected provider");
  });

  it("keeps all-event listing conservative for non-admins", async () => {
    const user = fakeUser({ isAdmin: false });
    const service = createFormConnectionService({
      now: fixedNow,
      repository: createFakeFormConnectionRepository(),
    });

    expect(canListFormConnections(user)).toBe(false);
    expect(canManageFormConnections(user, "event-1")).toBe(false);
    await expect(
      service.listFormConnections({
        user,
      }),
    ).rejects.toThrow("access is required");
  });

  it("uses event visibility helpers for event-scoped listing", async () => {
    const user = fakeUser({ isAdmin: false });
    const service = createFormConnectionService({
      now: fixedNow,
      repository: createFakeFormConnectionRepository(),
    });

    await expect(canListFormConnectionsForEvent(user, "event-1")).resolves.toBe(true);
    await expect(
      service.listFormConnections({
        eventId: "event-1",
        user,
      }),
    ).resolves.toEqual([]);
    expect(eventHelperMocks.requireVisibleEvent).toHaveBeenCalledWith(
      "event-1",
      user,
    );
  });

  it("requires active verified users for form management, including admins", () => {
    expect(
      canManageFormConnections(
        fakeUser({
          isAdmin: true,
          profile: {
            $id: "admin-a",
            authUserId: "admin-a",
            googleEmail: "admin@example.com",
            status: "ACTIVE",
            uomVerified: false,
          },
        }),
        "event-1",
      ),
    ).toBe(false);
    expect(
      canManageFormConnections(
        fakeUser({
          isAdmin: true,
          profile: {
            $id: "admin-a",
            authUserId: "admin-a",
            googleEmail: "admin@example.com",
            status: "DISABLED",
            uomVerified: true,
          },
        }),
        "event-1",
      ),
    ).toBe(false);
  });
});

function createFakeFormConnectionRepository(): FormConnectionRepository {
  const connections: FormConnection[] = [];

  return {
    async create(input: CreateFormConnectionInput & {
      createdAt: string;
      createdBy: string;
      updatedAt: string;
    }) {
      const connection: FormConnection = {
        ...input,
        createdAt: input.createdAt,
        createdBy: input.createdBy,
        id: `form-${connections.length + 1}`,
        status: input.status ?? "active",
        updatedAt: input.updatedAt,
      };
      connections.push(connection);
      return connection;
    },
    async list(options = {}) {
      return options.eventId
        ? connections.filter((connection) => connection.eventId === options.eventId)
        : connections;
    },
    async get(id) {
      return connections.find((c) => c.id === id) ?? null;
    },
    async update(id, input) {
      const index = connections.findIndex((c) => c.id === id);
      if (index === -1) throw new Error("Not found");
      const updated = {
        ...connections[index],
        ...input,
      };
      connections[index] = updated;
      return updated;
    },
    async delete(id) {
      const index = connections.findIndex((c) => c.id === id);
      if (index !== -1) connections.splice(index, 1);
    },
  };
}

function fakeUser(input: Partial<SessionUser> = {}): SessionUser {
  return {
    authUser: {
      email: "user@example.com",
      id: "user-a",
      name: "User A",
    },
    eventRoles: [],
    isAdmin: false,
    profile: {
      $id: "user-a",
      authUserId: "user-a",
      googleEmail: "user@example.com",
      status: "ACTIVE",
      uomVerified: true,
    },
    sbRoles: [],
    ...input,
  };
}

function fixedNow() {
  return new Date("2026-06-01T10:00:00.000Z");
}
