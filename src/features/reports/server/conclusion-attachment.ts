import "server-only";

import { Storage } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { APPWRITE_BUCKETS } from "@/lib/appwrite/constants";
import { getAppwriteAdminClient } from "@/server/appwrite";
import { isAppwriteNotFound, ValidationError } from "@/server/errors";
import { CONCLUSION_REPORT_PDF_MAX_BYTES } from "@/features/reports/lib/conclusion-attachment";

function getAdminStorage() {
  return new Storage(getAppwriteAdminClient());
}

export function conclusionReportFileId(reportId: string) {
  return `conclusion-report-${reportId}`;
}

export function isPdfBuffer(buffer: Buffer) {
  return buffer.byteLength >= 4 && buffer.subarray(0, 4).toString() === "%PDF";
}

function sanitizeUploadedFilename(value: string) {
  const basename = value.split(/[/\\]/).pop()?.trim() ?? "report.pdf";
  const normalized = basename.replace(/[^\w.\-() ]+/g, "_");

  return normalized.toLowerCase().endsWith(".pdf") ? normalized : `${normalized}.pdf`;
}

export async function deleteConclusionReportFile(fileId: string) {
  const storage = getAdminStorage();

  try {
    await storage.deleteFile({
      bucketId: APPWRITE_BUCKETS.conclusionReportFiles,
      fileId,
    });
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }
  }
}

export async function uploadConclusionReportFile({
  bytes,
  fileId,
  filename,
}: {
  bytes: Buffer;
  fileId: string;
  filename: string;
}) {
  if (bytes.byteLength === 0) {
    throw new ValidationError("Choose a PDF report to upload.");
  }

  if (bytes.byteLength > CONCLUSION_REPORT_PDF_MAX_BYTES) {
    throw new ValidationError("Report PDF must be 10 MB or smaller.");
  }

  if (!isPdfBuffer(bytes)) {
    throw new ValidationError("Only PDF files are allowed.");
  }

  const storage = getAdminStorage();
  await deleteConclusionReportFile(fileId);

  await storage.createFile({
    bucketId: APPWRITE_BUCKETS.conclusionReportFiles,
    fileId,
    file: InputFile.fromBuffer(bytes, sanitizeUploadedFilename(filename)),
    permissions: [],
  });
}

export async function downloadConclusionReportFile(fileId: string) {
  const storage = getAdminStorage();
  const file = await storage.getFile({
    bucketId: APPWRITE_BUCKETS.conclusionReportFiles,
    fileId,
  });
  const buffer = Buffer.from(
    await storage.getFileDownload({
      bucketId: APPWRITE_BUCKETS.conclusionReportFiles,
      fileId,
    }),
  );

  return {
    buffer,
    filename: file.name || "conclusion-report.pdf",
    mimeType: file.mimeType || "application/pdf",
  };
}
