import { NextResponse } from "next/server";
import {
  refreshRecognitionSnapshotJob,
  type RefreshRecognitionSnapshotJobInput,
} from "@/jobs/refresh-recognition-snapshot-job";
import { getServerEnv } from "@/lib/env";
import { ForbiddenError, ValidationError, jsonError, routeErrorStatus } from "@/server/errors";

export async function POST(request: Request) {
  try {
    assertTrustedJobRequest(request);
    const input = (await readJsonBody(request)) as RefreshRecognitionSnapshotJobInput;
    const result = await refreshRecognitionSnapshotJob(input);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Recognition snapshot job failed.",
      routeErrorStatus(error),
    );
  }
}

function assertTrustedJobRequest(request: Request) {
  const token = getServerEnv().INTERNAL_JOB_TOKEN;

  if (!token) {
    throw new ValidationError("INTERNAL_JOB_TOKEN must be configured before running jobs.");
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const headerToken = request.headers.get("x-internal-job-token") ?? "";

  if (bearerToken !== token && headerToken !== token) {
    throw new ForbiddenError("Job token is invalid.");
  }
}

async function readJsonBody(request: Request) {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as unknown;
}
