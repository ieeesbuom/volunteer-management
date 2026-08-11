import { z } from "zod";

export const draftContentSchema = z.object({
  additionalInfo: z.string().trim().max(4000).optional(),
  reportFileId: z.string().trim().max(128).optional(),
  reportFileName: z.string().trim().max(256).optional(),
});

export const createConclusionReportSchema = z.object({
  content: draftContentSchema.optional(),
  eventId: z.string().trim().min(1).max(128),
});

export const updateConclusionReportSchema = z.object({
  content: draftContentSchema.optional(),
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(),
});

export const adminReopenConclusionReportSchema = z.object({
  status: z.literal("DRAFT"),
});

export const approveConclusionReportSchema = z.object({
  reviewNote: z.string().trim().max(1000).optional(),
  status: z.enum(["APPROVED", "REJECTED"]),
});

export type DraftContentInput = z.infer<typeof draftContentSchema>;
export type CreateConclusionReportInput = z.infer<typeof createConclusionReportSchema>;
export type UpdateConclusionReportInput = z.infer<typeof updateConclusionReportSchema>;
export type ApproveConclusionReportInput = z.infer<typeof approveConclusionReportSchema>;
