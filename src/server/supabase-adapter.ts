/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { getSupabaseAdminClient, getSupabaseServerClient } from "@/server/supabase";

function formatRow<T extends Record<string, any>>(row: T): T & { $id: string; $createdAt: string; $updatedAt: string } {
  if (!row || typeof row !== "object") return row as any;
  const id = row.id ?? row.$id ?? "";
  const createdAt = row.created_at ?? row.createdAt ?? row.$createdAt ?? new Date().toISOString();
  const updatedAt = row.updated_at ?? row.updatedAt ?? row.$updatedAt ?? new Date().toISOString();

  return {
    ...row,
    $id: id,
    $createdAt: String(createdAt),
    $updatedAt: String(updatedAt),
  };
}

export class SupabaseTablesDB {
  async createTransaction() {
    return { $id: `tx_${Date.now()}` };
  }

  async updateTransaction() {
    return {};
  }

  async getRow<T = any>(paramsOrFirst: any, ...rest: any[]): Promise<T> {
    const params =
      paramsOrFirst && typeof paramsOrFirst === "object" && !Array.isArray(paramsOrFirst)
        ? paramsOrFirst
        : { databaseId: paramsOrFirst, tableId: rest[0], rowId: rest[1] };

    const { tableId, rowId } = params;
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(tableId)
      .select("*")
      .eq("id", rowId)
      .maybeSingle();

    if (error) {
      const err = new Error(error.message);
      (err as any).code = 500;
      throw err;
    }

    if (!data) {
      const err = new Error(`Row with ID '${rowId}' could not be found in '${tableId}'.`);
      (err as any).code = 404;
      (err as any).type = "row_not_found";
      throw err;
    }

    return formatRow(data) as unknown as T;
  }

  async listRows<T = any>(paramsOrFirst: any, ...rest: any[]): Promise<{ total: number; rows: T[] }> {
    const params =
      paramsOrFirst && typeof paramsOrFirst === "object" && !Array.isArray(paramsOrFirst)
        ? paramsOrFirst
        : { databaseId: paramsOrFirst, tableId: rest[0], queries: rest[1] };

    const { tableId, queries = [] } = params;
    const supabase = getSupabaseAdminClient();
    let builder: any = supabase.from(tableId).select("*", { count: "exact" });

    let limit = 100;
    let offset = 0;

    for (const q of queries) {
      if (!q) continue;
      let parsed = q;
      if (typeof q === "string") {
        try {
          parsed = JSON.parse(q);
        } catch {
          continue;
        }
      }

      const { method, attribute, values } = parsed;
      const attr = attribute === "$id" ? "id" : attribute;

      if (method === "equal") {
        if (Array.isArray(values) && values.length > 1) {
          builder = builder.in(attr, values);
        } else {
          const val = Array.isArray(values) ? values[0] : values;
          builder = builder.eq(attr, val);
        }
      } else if (method === "notEqual") {
        const val = Array.isArray(values) ? values[0] : values;
        builder = builder.neq(attr, val);
      } else if (method === "lessThan") {
        builder = builder.lt(attr, values[0]);
      } else if (method === "lessThanEqual") {
        builder = builder.lte(attr, values[0]);
      } else if (method === "greaterThan") {
        builder = builder.gt(attr, values[0]);
      } else if (method === "greaterThanEqual") {
        builder = builder.gte(attr, values[0]);
      } else if (method === "orderDesc") {
        const col = attr === "$createdAt" ? "created_at" : attr === "$updatedAt" ? "updated_at" : attr;
        builder = builder.order(col, { ascending: false });
      } else if (method === "orderAsc") {
        const col = attr === "$createdAt" ? "created_at" : attr === "$updatedAt" ? "updated_at" : attr;
        builder = builder.order(col, { ascending: true });
      } else if (method === "limit") {
        limit = Number(values[0]);
      } else if (method === "offset") {
        offset = Number(values[0]);
      } else if (method === "isNull") {
        builder = builder.is(attr, null);
      } else if (method === "isNotNull") {
        builder = builder.not(attr, "is", null);
      } else if (method === "contains") {
        builder = builder.ilike(attr, `%${values[0]}%`);
      }
    }

    builder = builder.range(offset, offset + limit - 1);

    const { data, count, error } = await builder;

    if (error) {
      const err = new Error(error.message);
      (err as any).code = 500;
      throw err;
    }

    return {
      total: count ?? (data?.length ?? 0),
      rows: (data ?? []).map(formatRow) as unknown as T[],
    };
  }

  async createRow<T = any>(paramsOrFirst: any, ...rest: any[]): Promise<T> {
    const params =
      paramsOrFirst && typeof paramsOrFirst === "object" && !Array.isArray(paramsOrFirst)
        ? paramsOrFirst
        : { databaseId: paramsOrFirst, tableId: rest[0], rowId: rest[1], data: rest[2] };

    const { tableId, rowId, data: payload } = params;
    const supabase = getSupabaseAdminClient();
    const insertData: Record<string, any> = { ...payload };

    if (rowId && rowId !== "unique()") {
      insertData.id = rowId;
    }

    const { data, error } = await supabase
      .from(tableId)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      const err = new Error(error.message);
      if (error.code === "23505") {
        (err as any).code = 409;
        (err as any).type = "document_already_exists";
      } else {
        (err as any).code = 500;
      }
      throw err;
    }

    return formatRow(data) as unknown as T;
  }

  async updateRow<T = any>(paramsOrFirst: any, ...rest: any[]): Promise<T> {
    const params =
      paramsOrFirst && typeof paramsOrFirst === "object" && !Array.isArray(paramsOrFirst)
        ? paramsOrFirst
        : { databaseId: paramsOrFirst, tableId: rest[0], rowId: rest[1], data: rest[2] };

    const { tableId, rowId, data: payload } = params;
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(tableId)
      .update(payload)
      .eq("id", rowId)
      .select()
      .single();

    if (error) {
      const err = new Error(error.message);
      (err as any).code = 500;
      throw err;
    }

    return formatRow(data) as unknown as T;
  }

  async deleteRow(paramsOrFirst: any, ...rest: any[]): Promise<Record<string, never>> {
    const params =
      paramsOrFirst && typeof paramsOrFirst === "object" && !Array.isArray(paramsOrFirst)
        ? paramsOrFirst
        : { databaseId: paramsOrFirst, tableId: rest[0], rowId: rest[1] };

    const { tableId, rowId } = params;
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from(tableId)
      .delete()
      .eq("id", rowId);

    if (error) {
      const err = new Error(error.message);
      (err as any).code = 500;
      throw err;
    }

    return {};
  }
}

export class SupabaseStorage {
  async createFile(params: {
    bucketId: string;
    fileId: string;
    file: { buffer?: Buffer; filename?: string; mimeType?: string } | any;
    permissions?: any[];
  }) {
    const supabase = getSupabaseAdminClient();
    const { bucketId, fileId, file } = params;

    const buffer = Buffer.isBuffer(file) ? file : file?.buffer ?? file;
    const contentType = file?.mimeType ?? "application/octet-stream";

    const { error } = await supabase.storage
      .from(bucketId)
      .upload(fileId, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      const err = new Error(error.message);
      (err as any).code = 500;
      throw err;
    }

    return { $id: fileId, name: fileId };
  }

  async getFile(params: { bucketId: string; fileId: string } | string, maybeFileId?: string) {
    const fileId = typeof params === "string" ? maybeFileId! : params.fileId;
    const now = new Date().toISOString();

    return {
      $id: fileId,
      name: fileId,
      mimeType: fileId.endsWith(".pdf")
        ? "application/pdf"
        : fileId.endsWith(".webp")
          ? "image/webp"
          : "application/octet-stream",
      sizeOriginal: 0,
      $createdAt: now,
      $updatedAt: now,
    };
  }

  async getFileDownload(params: { bucketId: string; fileId: string } | string, maybeFileId?: string) {
    const supabase = getSupabaseAdminClient();
    const bucketId = typeof params === "string" ? params : params.bucketId;
    const fileId = typeof params === "string" ? maybeFileId! : params.fileId;

    const { data, error } = await supabase.storage.from(bucketId).download(fileId);

    if (error || !data) {
      const err = new Error(error?.message ?? `File '${fileId}' not found.`);
      (err as any).code = 404;
      (err as any).type = "storage_file_not_found";
      throw err;
    }

    return await data.arrayBuffer();
  }

  async deleteFile(params: { bucketId: string; fileId: string } | string, maybeFileId?: string) {
    const supabase = getSupabaseAdminClient();
    const bucketId = typeof params === "string" ? params : params.bucketId;
    const fileId = typeof params === "string" ? maybeFileId! : params.fileId;

    const { error } = await supabase.storage.from(bucketId).remove([fileId]);

    if (error) {
      const err = new Error(error.message);
      (err as any).code = 500;
      throw err;
    }

    return {};
  }
}

export class SupabaseUsers {
  async get(userId: string) {
    const supabase = getSupabaseAdminClient();
    const { data: authData } = await supabase.auth.admin.getUserById(userId);
    if (authData?.user) {
      const u = authData.user;
      return {
        $id: u.id,
        email: u.email ?? "",
        name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? "",
        labels: Array.isArray(u.user_metadata?.labels) ? u.user_metadata.labels : [],
        prefs: u.user_metadata?.prefs ?? {},
      };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profile) {
      return {
        $id: profile.id,
        email: profile.googleEmail ?? "",
        name: profile.name ?? "",
        labels: [],
        prefs: {},
      };
    }

    const err = new Error(`User with ID '${userId}' could not be found.`);
    (err as any).code = 404;
    (err as any).type = "user_not_found";
    throw err;
  }

  async list(queries: any[] = []) {
    const supabase = getSupabaseAdminClient();
    let emailFilter: string | null = null;
    for (const q of queries) {
      if (q && q.method === "equal" && q.attribute === "email") {
        emailFilter = Array.isArray(q.values) ? q.values[0] : q.values;
      }
    }

    let profQuery = supabase.from("profiles").select("*");
    if (emailFilter) {
      profQuery = profQuery.eq("googleEmail", emailFilter);
    }
    const { data: profiles } = await profQuery;

    const users = (profiles ?? []).map((p: any) => ({
      $id: p.id,
      email: p.googleEmail ?? "",
      name: p.name ?? "",
      labels: [],
      prefs: {},
    }));

    return { total: users.length, users };
  }

  async updateLabels(params: { userId: string; labels: string[] }) {
    const supabase = getSupabaseAdminClient();
    const { userId, labels } = params;
    const { data: user } = await supabase.auth.admin.getUserById(userId);
    if (user?.user) {
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { ...user.user.user_metadata, labels },
      });
    }
    return { labels };
  }

  async updatePrefs(params: { userId: string; prefs: Record<string, any> }) {
    const supabase = getSupabaseAdminClient();
    const { userId, prefs } = params;
    const { data: user } = await supabase.auth.admin.getUserById(userId);
    if (user?.user) {
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { ...user.user.user_metadata, prefs },
      });
    }
    return { prefs };
  }
}

export class SupabaseAccount {
  constructor(private sessionUser: any = null) {}

  async get() {
    if (this.sessionUser) {
      return this.sessionUser;
    }

    const supabase = await getSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      const err = new Error("User unauthorized");
      (err as any).code = 401;
      (err as any).type = "user_unauthorized";
      throw err;
    }

    return {
      $id: user.id,
      email: user.email ?? "",
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? "",
      labels: Array.isArray(user.user_metadata?.labels) ? user.user_metadata.labels : [],
      prefs: user.user_metadata?.prefs ?? {},
    };
  }

  async deleteSession() {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();
    return {};
  }
}
