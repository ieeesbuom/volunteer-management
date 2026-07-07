import { z } from "zod";

function isLinkedInUrl(value: string) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === "https:" &&
      (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com"))
    );
  } catch {
    return false;
  }
}

export const volunteerProfileDetailsSchema = z.object({
  batchYear: z.string().trim().min(1, "Batch/year is required.").max(40),
  bio: z.string().trim().max(1200).optional().default(""),
  department: z.string().trim().min(1, "Department is required.").max(120),
  faculty: z.string().trim().min(1, "Faculty is required.").max(120),
  headline: z.string().trim().max(160).optional().default(""),
  linkedinUrl: z
    .string()
    .trim()
    .max(240)
    .optional()
    .default("")
    .refine(isLinkedInUrl, {
      message: "LinkedIn URL must be an https://linkedin.com URL.",
    }),
  skills: z.string().trim().max(500).optional().default(""),
  universityIndex: z
    .string()
    .trim()
    .min(1, "University index is required.")
    .regex(
      /^\d{6}[A-Za-z]$/,
      "University index must be 6 digits followed by an English letter (e.g., 245013Z)."
    )
    .max(40),
}).refine(
  (data) => {
    const batchDigitsMatch = data.batchYear.match(/\d{2}$/);
    if (!batchDigitsMatch) return true;
    const batchDigits = batchDigitsMatch[0];
    return data.universityIndex.startsWith(batchDigits);
  },
  {
    message: "University index must start with the selected batch digits.",
    path: ["universityIndex"],
  }
);

export type VolunteerProfileDetailsInput = z.infer<typeof volunteerProfileDetailsSchema>;
