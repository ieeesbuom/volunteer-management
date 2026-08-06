import { NextResponse } from "next/server";
import {
  sendUnreadNotificationDigestJob,
  type SendUnreadNotificationDigestJobInput,
} from "@/jobs/send-unread-notification-digest-job";
import { jsonError, routeErrorStatus , routeErrorMessage} from "@/server/errors";
import { assertTrustedJobRequest, readOptionalJsonBody } from "@/server/internal-job-auth";

export async function POST(request: Request) {
  try {
    assertTrustedJobRequest(request);
    const input = (await readOptionalJsonBody(request)) as SendUnreadNotificationDigestJobInput;
    const result = await sendUnreadNotificationDigestJob(input);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Unread digest job failed."),
      routeErrorStatus(error),
    );
  }
}
