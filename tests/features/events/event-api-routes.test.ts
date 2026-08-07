import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/features/access-control/types";
import type { Event } from "@/features/events/types";

const mockGetCurrentUser = vi.fn<() => Promise<SessionUser | null>>();
const mockGetEvents = vi.fn();
const mockCreateEvent = vi.fn();
const mockGetEventById = vi.fn();
const mockGetEventWithRoleAssignments = vi.fn();
const mockUpdateEvent = vi.fn();
const mockDeleteEvent = vi.fn();
const mockUpdateEventStatus = vi.fn();
const mockSubmitConclusion = vi.fn();
const mockApproveConclusion = vi.fn();
const mockRejectConclusion = vi.fn();
const mockGetUserEventRole = vi.fn();
const mockAssignEventRole = vi.fn();
const mockGetRoleAssignmentsForEvent = vi.fn();
const mockRemoveEventRole = vi.fn();
const mockNotifyEventUpdateWorkflow = vi.fn();
const mockNotifyRoleAssignmentWorkflow = vi.fn();
const mockGetEventNotificationContext = vi.fn();

vi.mock("@/features/access-control/server/current-user", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock("@/features/events/server/event-service", () => ({
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
  deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
  filterUpdateInputForRole: (input: Record<string, unknown>) => input,
  getEventById: (...args: unknown[]) => mockGetEventById(...args),
  getEventWithRoleAssignments: (...args: unknown[]) =>
    mockGetEventWithRoleAssignments(...args),
  getEvents: (...args: unknown[]) => mockGetEvents(...args),
  updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
  updateEventStatus: (...args: unknown[]) => mockUpdateEventStatus(...args),
  submitConclusion: (...args: unknown[]) => mockSubmitConclusion(...args),
  approveConclusion: (...args: unknown[]) => mockApproveConclusion(...args),
  rejectConclusion: (...args: unknown[]) => mockRejectConclusion(...args),
}));

vi.mock("@/features/events/server/event-roles.server", () => ({
  assignEventRole: (...args: unknown[]) => mockAssignEventRole(...args),
  getRoleAssignmentsForEvent: (...args: unknown[]) =>
    mockGetRoleAssignmentsForEvent(...args),
  getUserEventRole: (...args: unknown[]) => mockGetUserEventRole(...args),
  removeEventRole: (...args: unknown[]) => mockRemoveEventRole(...args),
}));

vi.mock("@/features/notifications/server/workflow-notifications", () => ({
  notifyEventUpdateWorkflow: (...args: unknown[]) =>
    mockNotifyEventUpdateWorkflow(...args),
  notifyRoleAssignmentWorkflow: (...args: unknown[]) =>
    mockNotifyRoleAssignmentWorkflow(...args),
}));

vi.mock("@/features/notifications/server/workflow-recipients", () => ({
  getEventNotificationContext: (...args: unknown[]) =>
    mockGetEventNotificationContext(...args),
}));

function createSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    authUser: { email: "user@uom.lk", id: "user-1", name: "Volunteer" },
    eventRoles: [],
    isAdmin: false,
    profile: {
      $id: "profile-1",
      authUserId: "user-1",
      googleEmail: "user@uom.lk",
      status: "ACTIVE",
      uomVerified: true,
    },
    sbRoles: [],
    ...overrides,
  };
}

function createEventFixture(overrides: Partial<Event> = {}): Event {
  return {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $id: "event-1",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    conclusion_status: "not_submitted",
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: "creator-user",
    reference: "MF-4",
    start_date: "2026-06-01T00:00:00.000Z",
    status: "draft",
    term: "25/26",
    title: "MoraForesight 4.0",
    updated_at: "2026-01-01T00:00:00.000Z",
    year: 2026,
    ...overrides,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("event API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEvents.mockResolvedValue({ events: [], total: 0 });
    mockGetUserEventRole.mockResolvedValue(null);
    mockNotifyEventUpdateWorkflow.mockResolvedValue([]);
    mockNotifyRoleAssignmentWorkflow.mockResolvedValue({ notification: null });
    mockGetEventNotificationContext.mockResolvedValue({
      eventTitle: "MoraForesight 4.0",
      recipientUserIds: ["user-2"],
    });
  });

  describe("GET /api/events", () => {
    it("returns 401 when unauthenticated", async () => {
      mockGetCurrentUser.mockResolvedValueOnce(null);
      const { GET } = await import("@/app/api/events/route");

      const response = await GET(new Request("http://localhost/api/events"));

      expect(response.status).toBe(401);
      expect(await readJson<{ error: string }>(response)).toEqual({
        error: "Authentication required.",
      });
    });

    it("returns 403 for verified volunteers without event creation permissions", async () => {
      mockGetCurrentUser.mockResolvedValueOnce(createSessionUser());
      const { GET } = await import("@/app/api/events/route");

      const response = await GET(new Request("http://localhost/api/events"));

      expect(response.status).toBe(403);
      expect(mockGetEvents).not.toHaveBeenCalled();
    });

    it("returns 200 for admins and passes admin context to getEvents", async () => {
      mockGetCurrentUser.mockResolvedValueOnce(
        createSessionUser({
          authUser: { email: "admin@example.com", id: "admin-1", name: "Admin" },
          isAdmin: true,
          profile: {
            $id: "profile-admin",
            authUserId: "admin-1",
            googleEmail: "admin@example.com",
            status: "ACTIVE",
            uomVerified: false,
          },
        }),
      );
      const { GET } = await import("@/app/api/events/route");

      const response = await GET(new Request("http://localhost/api/events?status=draft"));

      expect(response.status).toBe(200);
      expect(mockGetEvents).toHaveBeenCalledWith({
        isAdmin: true,
        limit: 50,
        offset: 0,
        status: "draft",
        term: undefined,
        userId: "admin-1",
      });
    });

    it("returns 403 for verified ExCom users because listing requires admin", async () => {
      mockGetCurrentUser.mockResolvedValueOnce(
        createSessionUser({ sbRoles: ["Chairperson"] }),
      );
      const { GET } = await import("@/app/api/events/route");

      const response = await GET(new Request("http://localhost/api/events"));

      expect(response.status).toBe(403);
      expect(mockGetEvents).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid status filters", async () => {
      mockGetCurrentUser.mockResolvedValueOnce(
        createSessionUser({
          authUser: { email: "admin@example.com", id: "admin-1", name: "Admin" },
          isAdmin: true,
          profile: {
            $id: "profile-admin",
            authUserId: "admin-1",
            googleEmail: "admin@example.com",
            status: "ACTIVE",
            uomVerified: false,
          },
        }),
      );
      const { GET } = await import("@/app/api/events/route");

      const response = await GET(
        new Request("http://localhost/api/events?status=invalid"),
      );

      expect(response.status).toBe(400);
      expect(mockGetEvents).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/events", () => {
    it("returns 403 when the user cannot create events", async () => {
      mockGetCurrentUser.mockResolvedValueOnce(createSessionUser());
      const { POST } = await import("@/app/api/events/route");

      const response = await POST(
        new Request("http://localhost/api/events", {
          body: JSON.stringify({ title: "New Event" }),
          method: "POST",
        }),
      );

      expect(response.status).toBe(403);
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it("returns 403 for verified ExCom creators because creation is admin-only", async () => {
      mockGetCurrentUser.mockResolvedValueOnce(
        createSessionUser({ sbRoles: ["Chairperson"] }),
      );
      const { POST } = await import("@/app/api/events/route");

      const response = await POST(
        new Request("http://localhost/api/events", {
          body: JSON.stringify({
            reference: "MF-5",
            start_date: "2026-07-01T00:00:00.000Z",
            status: "draft",
            term: "25/26",
            title: "Created Event",
            year: 2026,
          }),
          method: "POST",
        }),
      );

      expect(response.status).toBe(403);
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it("returns 201 for admin creators", async () => {
      const createdEvent = createEventFixture({ title: "Created Event" });
      mockGetCurrentUser.mockResolvedValueOnce(
        createSessionUser({
          authUser: { email: "admin@example.com", id: "admin-1", name: "Admin" },
          isAdmin: true,
          profile: {
            $id: "profile-admin",
            authUserId: "admin-1",
            googleEmail: "admin@example.com",
            status: "ACTIVE",
            uomVerified: false,
          },
        }),
      );
      mockCreateEvent.mockResolvedValueOnce(createdEvent);
      const { POST } = await import("@/app/api/events/route");

      const response = await POST(
        new Request("http://localhost/api/events", {
          body: JSON.stringify({
            reference: "MF-5",
            start_date: "2026-07-01T00:00:00.000Z",
            status: "draft",
            term: "25/26",
            title: "Created Event",
            year: 2026,
          }),
          method: "POST",
        }),
      );

      expect(response.status).toBe(201);
      expect(mockCreateEvent).toHaveBeenCalled();
    });
  });

  describe("GET /api/events/[eventId]", () => {
    it("returns 404 for closed events hidden from the requester", async () => {
      const closedEvent = createEventFixture({ status: "closed" });
      mockGetCurrentUser.mockResolvedValueOnce(createSessionUser());
      mockGetEventWithRoleAssignments.mockResolvedValueOnce(closedEvent);
      const { GET } = await import("@/app/api/events/[eventId]/route");

      const response = await GET(new Request("http://localhost/api/events/event-1"), {
        params: Promise.resolve({ eventId: "event-1" }),
      });

      expect(response.status).toBe(404);
    });

    it("returns 200 for admins viewing closed events", async () => {
      const closedEvent = createEventFixture({ status: "closed" });
      mockGetCurrentUser.mockResolvedValueOnce(
        createSessionUser({
          authUser: { email: "admin@example.com", id: "admin-1", name: "Admin" },
          isAdmin: true,
          profile: {
            $id: "profile-admin",
            authUserId: "admin-1",
            googleEmail: "admin@example.com",
            status: "ACTIVE",
            uomVerified: false,
          },
        }),
      );
      mockGetEventWithRoleAssignments.mockResolvedValueOnce(closedEvent);
      const { GET } = await import("@/app/api/events/[eventId]/route");

      const response = await GET(new Request("http://localhost/api/events/event-1"), {
        params: Promise.resolve({ eventId: "event-1" }),
      });

      expect(response.status).toBe(200);
      expect((await readJson<{ event: Event }>(response)).event.$id).toBe("event-1");
    });
  });

  describe("PATCH /api/events/[eventId]", () => {
    it("returns 403 when a chair cannot edit the current event status", async () => {
      const ongoingEvent = createEventFixture({ status: "ongoing" });
      mockGetCurrentUser.mockResolvedValueOnce(createSessionUser());
      mockGetEventById.mockResolvedValueOnce(ongoingEvent);
      mockGetUserEventRole.mockResolvedValueOnce("Chair");
      const { PATCH } = await import("@/app/api/events/[eventId]/route");

      const response = await PATCH(
        new Request("http://localhost/api/events/event-1", {
          body: JSON.stringify({ title: "Updated title" }),
          method: "PATCH",
        }),
        { params: Promise.resolve({ eventId: "event-1" }) },
      );

      expect(response.status).toBe(403);
      expect(mockUpdateEvent).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/events/[eventId]", () => {
    it("returns 403 for non-admin users", async () => {
      mockGetCurrentUser.mockResolvedValueOnce(
        createSessionUser({ sbRoles: ["Chairperson"] }),
      );
      const { DELETE } = await import("@/app/api/events/[eventId]/route");

      const response = await DELETE(new Request("http://localhost/api/events/event-1"), {
        params: Promise.resolve({ eventId: "event-1" }),
      });

      expect(response.status).toBe(403);
      expect(mockDeleteEvent).not.toHaveBeenCalled();
    });

    it("returns 204 for admins", async () => {
      mockGetCurrentUser.mockResolvedValueOnce(
        createSessionUser({
          authUser: { email: "admin@example.com", id: "admin-1", name: "Admin" },
          isAdmin: true,
          profile: {
            $id: "profile-admin",
            authUserId: "admin-1",
            googleEmail: "admin@example.com",
            status: "ACTIVE",
            uomVerified: false,
          },
        }),
      );
      mockGetEventById.mockResolvedValueOnce(createEventFixture());
      const { DELETE } = await import("@/app/api/events/[eventId]/route");

      const response = await DELETE(new Request("http://localhost/api/events/event-1"), {
        params: Promise.resolve({ eventId: "event-1" }),
      });

      expect(response.status).toBe(204);
      expect(mockDeleteEvent).toHaveBeenCalledWith("event-1", "admin-1");
    });
  });

  describe("PATCH /api/events/[eventId]/status", () => {
    it("returns 403 for chairs attempting status changes", async () => {
      const ongoingEvent = createEventFixture({ status: "ongoing" });
      mockGetCurrentUser.mockResolvedValueOnce(createSessionUser());
      mockGetEventById.mockResolvedValueOnce(ongoingEvent);
      const { PATCH } = await import("@/app/api/events/[eventId]/status/route");

      const response = await PATCH(
        new Request("http://localhost/api/events/event-1/status", {
          body: JSON.stringify({ status: "closed" }),
          method: "PATCH",
        }),
        { params: Promise.resolve({ eventId: "event-1" }) },
      );

      expect(response.status).toBe(403);
      expect(mockUpdateEventStatus).not.toHaveBeenCalled();
    });

    it("returns 403 for admins on conclusion-managed transitions", async () => {
      const ongoingEvent = createEventFixture({ status: "ongoing" });
      mockGetCurrentUser.mockResolvedValueOnce(
        createSessionUser({
          authUser: { email: "admin@example.com", id: "admin-1", name: "Admin" },
          isAdmin: true,
          profile: {
            $id: "profile-admin",
            authUserId: "admin-1",
            googleEmail: "admin@example.com",
            status: "ACTIVE",
            uomVerified: false,
          },
        }),
      );
      mockGetEventById.mockResolvedValueOnce(ongoingEvent);
      const { PATCH } = await import("@/app/api/events/[eventId]/status/route");

      const response = await PATCH(
        new Request("http://localhost/api/events/event-1/status", {
          body: JSON.stringify({ status: "pending_conclusion" }),
          method: "PATCH",
        }),
        { params: Promise.resolve({ eventId: "event-1" }) },
      );

      expect(response.status).toBe(403);
      expect(mockUpdateEventStatus).not.toHaveBeenCalled();
    });

    it("returns 403 when admins try to skip required lifecycle states", async () => {
      const draftEvent = createEventFixture({ status: "draft" });
      mockGetCurrentUser.mockResolvedValueOnce(
        createSessionUser({
          authUser: { email: "admin@example.com", id: "admin-1", name: "Admin" },
          isAdmin: true,
          profile: {
            $id: "profile-admin",
            authUserId: "admin-1",
            googleEmail: "admin@example.com",
            status: "ACTIVE",
            uomVerified: false,
          },
        }),
      );
      mockGetEventById.mockResolvedValueOnce(draftEvent);
      const { PATCH } = await import("@/app/api/events/[eventId]/status/route");

      const response = await PATCH(
        new Request("http://localhost/api/events/event-1/status", {
          body: JSON.stringify({ status: "published" }),
          method: "PATCH",
        }),
        { params: Promise.resolve({ eventId: "event-1" }) },
      );

      expect(response.status).toBe(403);
      expect(mockUpdateEventStatus).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/events/[eventId]/conclude", () => {
    it("returns 409 because structured reports own conclusion decisions", async () => {
      const ongoingEvent = createEventFixture({ status: "ongoing" });
      mockGetCurrentUser.mockResolvedValueOnce(createSessionUser());
      mockGetEventById.mockResolvedValueOnce(ongoingEvent);
      mockGetUserEventRole.mockResolvedValueOnce("Chair");
      const { PATCH } = await import("@/app/api/events/[eventId]/conclude/route");

      const response = await PATCH(
        new Request("http://localhost/api/events/event-1/conclude", {
          body: JSON.stringify({ action: "approve" }),
          method: "PATCH",
        }),
        { params: Promise.resolve({ eventId: "event-1" }) },
      );

      expect(response.status).toBe(409);
      expect(await readJson<{ error: string }>(response)).toEqual({
        error: "Conclusion actions are managed through structured conclusion reports.",
      });
      expect(mockApproveConclusion).not.toHaveBeenCalled();
      expect(mockSubmitConclusion).not.toHaveBeenCalled();
      expect(mockRejectConclusion).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/events/[eventId]/roles", () => {
    it("returns 400 for invalid event role values", async () => {
      mockGetCurrentUser.mockResolvedValueOnce(
        createSessionUser({
          authUser: { email: "admin@example.com", id: "admin-1", name: "Admin" },
          isAdmin: true,
          profile: {
            $id: "profile-admin",
            authUserId: "admin-1",
            googleEmail: "admin@example.com",
            status: "ACTIVE",
            uomVerified: false,
          },
        }),
      );
      const { POST } = await import("@/app/api/events/[eventId]/roles/route");

      const response = await POST(
        new Request("http://localhost/api/events/event-1/roles", {
          body: JSON.stringify({
            event_id: "event-1",
            role: "Treasurer",
            user_id: "user-2",
          }),
          method: "POST",
        }),
        { params: Promise.resolve({ eventId: "event-1" }) },
      );

      expect(response.status).toBe(400);
      expect(mockAssignEventRole).not.toHaveBeenCalled();
      expect(mockGetEventById).not.toHaveBeenCalled();
    });

    it("allows admins to assign another Chair for co-chair events", async () => {
      const draftEvent = createEventFixture({ status: "draft" });
      mockGetCurrentUser.mockResolvedValueOnce(
        createSessionUser({
          authUser: { email: "admin@example.com", id: "admin-1", name: "Admin" },
          isAdmin: true,
          profile: {
            $id: "profile-admin",
            authUserId: "admin-1",
            googleEmail: "admin@example.com",
            status: "ACTIVE",
            uomVerified: false,
          },
        }),
      );
      mockGetEventById.mockResolvedValueOnce(draftEvent);
      mockAssignEventRole.mockResolvedValueOnce({
        $id: "assignment-chair-2",
        active: true,
        assignedAt: "2026-01-02T00:00:00.000Z",
        assignedBy: "admin-1",
        eventChairCount: 2,
        eventId: "event-1",
        eventTitle: "MoraForesight 4.0",
        role: "Chair",
        userId: "user-2",
      });
      const { POST } = await import("@/app/api/events/[eventId]/roles/route");

      const response = await POST(
        new Request("http://localhost/api/events/event-1/roles", {
          body: JSON.stringify({
            event_id: "event-1",
            role: "Chair",
            user_id: "user-2",
          }),
          method: "POST",
        }),
        { params: Promise.resolve({ eventId: "event-1" }) },
      );

      expect(response.status).toBe(201);
      expect(mockAssignEventRole).toHaveBeenCalledWith(
        {
          event_id: "event-1",
          role: "Chair",
          user_id: "user-2",
        },
        "admin-1",
      );
    });

    it("returns 403 when a chair tries to assign another chair", async () => {
      const draftEvent = createEventFixture({ status: "draft" });
      mockGetCurrentUser.mockResolvedValueOnce(createSessionUser());
      mockGetEventById.mockResolvedValueOnce(draftEvent);
      mockGetUserEventRole.mockResolvedValueOnce("Chair");
      const { POST } = await import("@/app/api/events/[eventId]/roles/route");

      const response = await POST(
        new Request("http://localhost/api/events/event-1/roles", {
          body: JSON.stringify({
            event_id: "event-1",
            role: "Chair",
            user_id: "user-2",
          }),
          method: "POST",
        }),
        { params: Promise.resolve({ eventId: "event-1" }) },
      );

      expect(response.status).toBe(403);
      expect(mockAssignEventRole).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/events/[eventId]/roles/[assignmentId]", () => {
    it("returns 403 when a chair tries to remove another chair", async () => {
      const draftEvent = createEventFixture({ status: "draft" });
      mockGetCurrentUser.mockResolvedValueOnce(createSessionUser());
      mockGetEventById.mockResolvedValueOnce(draftEvent);
      mockGetUserEventRole.mockResolvedValueOnce("Chair");
      mockGetRoleAssignmentsForEvent.mockResolvedValueOnce([
        {
          $id: "assignment-chair",
          active: true,
          assignedAt: "2026-01-01T00:00:00.000Z",
          assignedBy: "admin-user",
          eventId: "event-1",
          eventTitle: "MoraForesight 4.0",
          role: "Chair",
          userId: "user-2",
        },
      ]);
      const { DELETE } = await import(
        "@/app/api/events/[eventId]/roles/[assignmentId]/route"
      );

      const response = await DELETE(
        new Request("http://localhost/api/events/event-1/roles/assignment-chair"),
        {
          params: Promise.resolve({
            assignmentId: "assignment-chair",
            eventId: "event-1",
          }),
        },
      );

      expect(response.status).toBe(403);
      expect(mockRemoveEventRole).not.toHaveBeenCalled();
    });
  });
});
