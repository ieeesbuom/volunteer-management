export const CONCLUSION_REPORT_PDF_MAX_BYTES = 10 * 1024 * 1024;

export const CONCLUSION_REPORT_PDF_ACCEPT = "application/pdf,.pdf";

export function conclusionReportAttachmentPath(reportId: string) {
  return `/api/reports/conclusions/${reportId}/attachment`;
}
