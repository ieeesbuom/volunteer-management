import { describe, expect, it } from "vitest";
import {
  canEditReportContent,
  canSubmitReport,
  canTransitionReportStatus,
} from "@/features/reports/lib/approval-rules";

describe("report approval rules", () => {
  it("allows draft reports to move to submitted only when a PDF is uploaded", () => {
    expect(canTransitionReportStatus("DRAFT", "SUBMITTED")).toBe(true);
    expect(
      canSubmitReport({
        content: {
          additionalInfo: "Extra notes",
          reportFileId: "conclusion-report-report-1",
        },
        status: "DRAFT",
      }),
    ).toBe(true);
    expect(
      canSubmitReport({
        content: {
          additionalInfo: "",
        },
        status: "DRAFT",
      }),
    ).toBe(false);
  });

  it("allows editing only for draft and rejected reports", () => {
    expect(canEditReportContent({ status: "DRAFT" })).toBe(true);
    expect(canEditReportContent({ status: "REJECTED" })).toBe(true);
    expect(canEditReportContent({ status: "SUBMITTED" })).toBe(false);
    expect(canEditReportContent({ status: "APPROVED" })).toBe(false);
  });
});
