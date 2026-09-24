import { NextResponse } from "next/server";
import {
  cleanupLeftoverGeneralCommitteesJob,
  type CleanupLeftoverGeneralCommitteesJobInput,
} from "@/jobs/cleanup-leftover-general-committees-job";
import { jsonRouteError } from "@/server/errors";
import { assertTrustedJobRequest, readOptionalJsonBody } from "@/server/internal-job-auth";

export async function POST(request: Request) {
  try {
    assertTrustedJobRequest(request);
    const input = (await readOptionalJsonBody(request)) as CleanupLeftoverGeneralCommitteesJobInput;
    const result = await cleanupLeftoverGeneralCommitteesJob(input);

    return NextResponse.json(result);
  } catch (error) {
    return jsonRouteError(error, "Leftover General committee cleanup job failed.");
  }
}
