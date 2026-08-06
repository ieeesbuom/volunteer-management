import { NextResponse } from "next/server";
import { AdminGradeOverrideSchema } from "@/features/scoring/lib/schemas";
import { adminOverrideGrade } from "@/features/scoring/server/actions";
import { jsonError, routeErrorStatus , routeErrorMessage} from "@/server/errors";

export async function POST(request: Request) {
  try {
    const body = AdminGradeOverrideSchema.parse(await request.json());
    const review = await adminOverrideGrade(
      body.gradeReviewId,
      body.newGradeValue,
      body.reason
    );
    return NextResponse.json({ review });
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Failed to override grade."),
      routeErrorStatus(error)
    );
  }
}
