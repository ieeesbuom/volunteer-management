import { describe, expect, it, vi } from "vitest";
import {
  SupabaseAccount,
  SupabaseStorage,
  SupabaseTablesDB,
  SupabaseUsers,
} from "@/server/supabase-adapter";
import { InputFile } from "node-appwrite/file";

vi.mock("server-only", () => ({}));

// Mock Supabase admin and server clients
const mockFrom = vi.fn();
const mockStorageFrom = vi.fn();
const mockAdminAuth = {
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
};

vi.mock("@/server/supabase", () => ({
  getSupabaseAdminClient: () => ({
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
    auth: {
      admin: mockAdminAuth,
    },
  }),
  getSupabaseServerClient: async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "test@example.com",
            user_metadata: {
              full_name: "Test User",
              labels: ["admin"],
            },
          },
        },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  }),
}));

describe("SupabaseTablesDB Adapter", () => {
  it("translates startsWith query correctly into a SQL LIKE filter", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [{ id: "uec_1", key: "uom_email_claim:test@uom.lk", value: "{}" }],
        count: 1,
        error: null,
      }),
    };
    mockFrom.mockReturnValue(builder);

    const tables = new SupabaseTablesDB();
    const result = await tables.listRows({
      tableId: "system_settings",
      queries: [
        { method: "startsWith", attribute: "key", values: ["uom_email_claim:"] },
      ],
    });

    expect(builder.like).toHaveBeenCalledWith("key", "uom_email_claim:%");
    expect(result.total).toBe(1);
    expect(result.rows[0].$id).toBe("uec_1");
  });

  it("resolves table-specific timestamp columns correctly (audit_logs uses createdAt)", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [{ id: "log_1", action: "UPDATE_SETTING", createdAt: "2026-01-01T00:00:00Z" }],
        count: 1,
        error: null,
      }),
    };
    mockFrom.mockReturnValue(builder);

    const tables = new SupabaseTablesDB();
    await tables.listRows({
      tableId: "audit_logs",
      queries: [
        { method: "orderDesc", attribute: "$createdAt" },
      ],
    });

    // In audit_logs, $createdAt must resolve to "createdAt" (camelCase)
    expect(builder.order).toHaveBeenCalledWith("createdAt", { ascending: false });
  });

  it("resolves table-specific timestamp columns correctly (events uses created_at)", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [{ id: "ev_1", title: "Test Event", created_at: "2026-01-01T00:00:00Z" }],
        count: 1,
        error: null,
      }),
    };
    mockFrom.mockReturnValue(builder);

    const tables = new SupabaseTablesDB();
    await tables.listRows({
      tableId: "events",
      queries: [
        { method: "orderDesc", attribute: "$createdAt" },
      ],
    });

    // In events, $createdAt must resolve to "created_at" (snake_case)
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("supports cursorAfter pagination with keyset comparison", async () => {
    // 1. Cursor row lookup returns cursor record
    const cursorLookupBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "cursor_1", createdAt: "2026-01-01T12:00:00.000Z" },
        error: null,
      }),
    };

    // 2. Main query builder
    const mainBuilder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [{ id: "log_2", createdAt: "2026-01-01T11:00:00.000Z" }],
        count: 1,
        error: null,
      }),
    };

    mockFrom
      .mockReturnValueOnce(mainBuilder) // for listRows initial query builder
      .mockReturnValueOnce(cursorLookupBuilder); // for cursor lookup

    const tables = new SupabaseTablesDB();
    await tables.listRows({
      tableId: "audit_logs",
      queries: [
        { method: "orderDesc", attribute: "createdAt" },
        { method: "cursorAfter", values: ["cursor_1"] },
      ],
    });

    expect(mainBuilder.lt).toHaveBeenCalledWith("createdAt", "2026-01-01T12:00:00.000Z");
  });
});

describe("SupabaseStorage Adapter", () => {
  it("properly extracts raw binary buffer from an InputFile instance", async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({
      upload: uploadMock,
    });

    const storage = new SupabaseStorage();
    const inputFile = InputFile.fromBuffer(Buffer.from("raw image data"), "avatar.webp");

    await storage.createFile({
      bucketId: "profile_avatars",
      fileId: "user_avatar_1",
      file: inputFile,
    });

    expect(uploadMock).toHaveBeenCalled();
    const [calledFileId, calledBuffer, options] = uploadMock.mock.calls[0];
    expect(calledFileId).toBe("user_avatar_1");
    expect(Buffer.isBuffer(calledBuffer)).toBe(true);
    expect(calledBuffer.toString()).toBe("raw image data");
    expect(options.contentType).toBe("image/webp");
  });

  it("properly extracts buffer from a direct Buffer instance", async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({
      upload: uploadMock,
    });

    const storage = new SupabaseStorage();
    const rawBuffer = Buffer.from("%PDF-1.4 report content");

    await storage.createFile({
      bucketId: "conclusion_report_files",
      fileId: "report_1.pdf",
      file: rawBuffer,
    });

    expect(uploadMock).toHaveBeenCalled();
    const [, calledBuffer, options] = uploadMock.mock.calls[0];
    expect(Buffer.isBuffer(calledBuffer)).toBe(true);
    expect(calledBuffer.toString()).toBe("%PDF-1.4 report content");
    expect(options.contentType).toBe("application/pdf");
  });
});

describe("SupabaseUsers Adapter", () => {
  it("retrieves user and metadata from Supabase Auth admin", async () => {
    mockAdminAuth.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: "u-99",
          email: "admin@uom.lk",
          user_metadata: {
            full_name: "Admin User",
            labels: ["admin"],
          },
        },
      },
    });

    const users = new SupabaseUsers();
    const user = await users.get("u-99");

    expect(user.$id).toBe("u-99");
    expect(user.email).toBe("admin@uom.lk");
    expect(user.labels).toEqual(["admin"]);
  });

  it("updates labels in Supabase Auth user metadata", async () => {
    mockAdminAuth.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: "u-99",
          user_metadata: { labels: [] },
        },
      },
    });
    mockAdminAuth.updateUserById.mockResolvedValueOnce({ data: {} });

    const users = new SupabaseUsers();
    await users.updateLabels({ userId: "u-99", labels: ["admin"] });

    expect(mockAdminAuth.updateUserById).toHaveBeenCalledWith("u-99", {
      user_metadata: { labels: ["admin"] },
    });
  });
});

describe("SupabaseAccount Adapter", () => {
  it("retrieves current authenticated user session", async () => {
    const account = new SupabaseAccount();
    const user = await account.get();

    expect(user.$id).toBe("user-123");
    expect(user.email).toBe("test@example.com");
    expect(user.labels).toEqual(["admin"]);
  });
});
