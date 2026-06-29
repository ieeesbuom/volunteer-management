import "server-only";

import { z } from "zod";
import {
  buildRecognitionSnapshot,
  writeRecognitionSnapshot,
} from "@/features/reports/server/recognition";

export type RefreshRecognitionSnapshotJobInput = {
  dryRun?: boolean;
  generatedBy?: string;
  referenceDate?: string;
};

type RecognitionSnapshot = Awaited<ReturnType<typeof buildRecognitionSnapshot>>;

const refreshRecognitionSnapshotJobInputSchema = z
  .object({
    dryRun: z.boolean().default(true),
    generatedBy: z.string().trim().min(1).max(64).default("scheduler"),
    referenceDate: z.string().datetime().optional(),
  })
  .strict();

export async function refreshRecognitionSnapshotJob(
  input: RefreshRecognitionSnapshotJobInput = {},
  deps: {
    buildSnapshot?: (date: Date) => Promise<RecognitionSnapshot>;
    writeSnapshot?: (input: {
      date: Date;
      generatedBy: string;
    }) => Promise<{ snapshot: RecognitionSnapshot; storedAt: string }>;
  } = {},
) {
  const { dryRun, generatedBy, referenceDate } =
    refreshRecognitionSnapshotJobInputSchema.parse(input);
  const date = referenceDate ? new Date(referenceDate) : new Date();
  const buildSnapshot = deps.buildSnapshot ?? buildRecognitionSnapshot;
  const writeSnapshot = deps.writeSnapshot ?? writeRecognitionSnapshot;

  if (dryRun) {
    return {
      dryRun,
      persisted: false,
      snapshot: await buildSnapshot(date),
    };
  }

  const result = await writeSnapshot({
    date,
    generatedBy,
  });

  return {
    dryRun,
    persisted: true,
    snapshot: result.snapshot,
    storedAt: result.storedAt,
  };
}
