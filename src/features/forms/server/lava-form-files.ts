import "server-only";

import { Storage } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { ID } from "node-appwrite";
import { APPWRITE_BUCKETS } from "@/lib/appwrite/constants";
import { getAppwriteAdminClient } from "@/server/appwrite";
import { isAppwriteNotFound, ValidationError } from "@/server/errors";

export const LAVA_FORM_FILE_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "pdf",
  "doc",
  "docx",
  "txt",
  "csv",
  "xlsx",
]);

export type LavaStorageClient = Pick<
  Storage,
  "createFile" | "deleteFile" | "getFile" | "getFileDownload"
>;

export function getLavaFormStorage(): LavaStorageClient {
  return new Storage(getAppwriteAdminClient());
}

function extensionOf(filename: string) {
  const basename = filename.split(/[/\\]/).pop()?.trim() ?? "upload";
  const dot = basename.lastIndexOf(".");
  return dot >= 0 ? basename.slice(dot + 1).toLowerCase() : "";
}

function sanitizeFilename(filename: string) {
  const basename = filename.split(/[/\\]/).pop()?.trim() || "upload";
  return basename.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
}

export async function uploadLavaFormFile(
  file: File,
  storage: LavaStorageClient = getLavaFormStorage(),
) {
  if (file.size <= 0) {
    throw new ValidationError("Choose a file to upload.");
  }

  if (file.size > LAVA_FORM_FILE_MAX_BYTES) {
    throw new ValidationError("Files must be 10 MB or smaller.");
  }

  const extension = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new ValidationError("That file type is not allowed.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const created = await storage.createFile({
    bucketId: APPWRITE_BUCKETS.lavaFormFiles,
    file: InputFile.fromBuffer(bytes, sanitizeFilename(file.name)),
    fileId: ID.unique(),
    permissions: [],
  });

  return created.$id;
}

export async function deleteLavaFormFile(
  fileId: string,
  storage: LavaStorageClient = getLavaFormStorage(),
) {
  try {
    await storage.deleteFile({
      bucketId: APPWRITE_BUCKETS.lavaFormFiles,
      fileId,
    });
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }
  }
}

export async function downloadLavaFormFile(
  fileId: string,
  storage: LavaStorageClient = getLavaFormStorage(),
) {
  const [meta, download] = await Promise.all([
    storage.getFile({
      bucketId: APPWRITE_BUCKETS.lavaFormFiles,
      fileId,
    }),
    storage.getFileDownload({
      bucketId: APPWRITE_BUCKETS.lavaFormFiles,
      fileId,
    }),
  ]);

  return {
    buffer: Buffer.from(download),
    filename: meta.name || "download",
    mimeType: meta.mimeType || "application/octet-stream",
  };
}
