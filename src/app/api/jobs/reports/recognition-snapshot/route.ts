import { NextResponse } from "next/server";
import {
  refreshRecognitionSnapshotJob,
  type RefreshRecognitionSnapshotJobInput,
} from "@/jobs/refresh-recognition-snapshot-job";
import { jsonRouteError } from "@/server/errors";
import { assertTrustedJobRequest, readOptionalJsonBody } from "@/server/internal-job-auth";

export async function POST(request: Request) {
  try {
    assertTrustedJobRequest(request);
    const input = (await readOptionalJsonBody(request)) as RefreshRecognitionSnapshotJobInput;
    const result = await refreshRecognitionSnapshotJob(input);

    return NextResponse.json(result);
  } catch (error) {
    return jsonRouteError(error, "Recognition snapshot job failed.");
  }
}
