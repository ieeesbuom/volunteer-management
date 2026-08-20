import "server-only";

import { AppwriteException } from "node-appwrite";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ConclusionManagedStatusError } from "@/features/events/lib/event-status-transitions";
import { formatUserFacingError } from "@/lib/utils";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class TooManyRequestsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TooManyRequestsError";
  }
}

export function isAppwriteNotFound(error: unknown) {
  return error instanceof AppwriteException && error.code === 404;
}

export function isAppwriteConflict(error: unknown) {
  return error instanceof AppwriteException && error.code === 409;
}

export function isAppwriteUnauthorized(error: unknown) {
  const code = getErrorProperty(error, "code");
  const type = getErrorProperty(error, "type");

  return (
    code === 401 &&
    (type === "user_unauthorized"
      || type === "general_unauthorized_scope"
      || type === "general_unauthorized")
  );
}

export function isInvalidOAuthRedirect(error: unknown) {
  const message = error instanceof Error ? error.message : getErrorProperty(error, "message");

  return message === "Invalid redirect";
}

function getErrorProperty(error: unknown, key: string) {
  if (typeof error !== "object" || error === null || !(key in error)) {
    return undefined;
  }

  return (error as Record<string, unknown>)[key];
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const UNEXPECTED_FORMATTED_MESSAGES = new Set([
  "We encountered a technical issue while saving this record. Please refresh the page and try again.",
  "Could not connect to the server. Please check your internet connection and try again.",
  "Received an invalid response from the server. Please refresh and try again.",
]);

function isKnownDomainError(error: unknown) {
  return (
    error instanceof ForbiddenError ||
    error instanceof NotFoundError ||
    error instanceof ConflictError ||
    error instanceof ValidationError ||
    error instanceof TooManyRequestsError ||
    error instanceof ConclusionManagedStatusError
  );
}

function isExpectedErrorMessage(message: string) {
  return (
    message === "Authentication required." ||
    message === "Admin access required." ||
    message.endsWith("permission is required.") ||
    message.endsWith("access is required.") ||
    message.startsWith("Required ") ||
    message.startsWith("Verified UoM") ||
    message.startsWith("Invalid verification") ||
    message.startsWith("Verification ") ||
    message.startsWith("Too many requests") ||
    message === "This account has been disabled." ||
    message === "An extra score evaluation has already been given to this volunteer for this event." ||
    message === "Only admins can submit extra scores for chairs." ||
    message === "Only the event chair or an admin can submit extra scores." ||
    message === "Only admins can approve extra scores."
  );
}

export function isExpectedRouteError(error: unknown) {
  if (isKnownDomainError(error) || error instanceof ZodError) {
    return true;
  }

  if (error instanceof AppwriteException) {
    return error.code === 404 || error.code === 409;
  }

  if (
    error instanceof TypeError ||
    error instanceof RangeError ||
    error instanceof ReferenceError ||
    error instanceof SyntaxError
  ) {
    return false;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message === "APPWRITE_API_KEY_UNAUTHORIZED") {
    return false;
  }

  if (isExpectedErrorMessage(error.message)) {
    return true;
  }

  const formatted = formatUserFacingError(error, "__sentry_unexpected__");
  return formatted !== "__sentry_unexpected__" && !UNEXPECTED_FORMATTED_MESSAGES.has(formatted);
}

export function reportUnexpectedError(error: unknown) {
  if (isExpectedRouteError(error) || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureException(error);
    })
    .catch(() => {
      // Never fail the API response because of Sentry.
    });
}

export function jsonRouteError(error: unknown, fallback: string, status = routeErrorStatus(error)) {
  reportUnexpectedError(error);
  return jsonError(routeErrorMessage(error, fallback), status);
}

export function routeErrorMessage(error: unknown, fallback: string): string {
  if (isKnownDomainError(error)) {
    return (error as Error).message;
  }

  const message = error instanceof Error ? error.message : fallback;

  if (isExpectedErrorMessage(message)) {
    return message;
  }

  return formatUserFacingError(error, fallback);
}

export function routeErrorStatus(error: unknown, fallback = 400) {
  if (error instanceof ConclusionManagedStatusError) {
    return 409;
  }

  if (error instanceof NotFoundError) {
    return 404;
  }

  if (error instanceof ForbiddenError) {
    return 403;
  }

  if (error instanceof ConflictError) {
    return 409;
  }

  if (error instanceof ValidationError) {
    return 400;
  }

  if (error instanceof TooManyRequestsError) {
    return 429;
  }

  const message = error instanceof Error ? error.message : "";

  if (message === "Authentication required.") {
    return 401;
  }

  if (message === "This account has been disabled.") {
    return 403;
  }

  if (
    message === "Admin access required." ||
    message === "Required event role is missing." ||
    message === "You do not have access to this report." ||
    message === "You do not have access to export this report." ||
    message === "You do not have access to export this volunteer profile." ||
    message === "Unauthorized access to point ledger."
  ) {
    return 403;
  }

  if (message === "Conclusion report was not found." || message === "Volunteer profile was not found.") {
    return 404;
  }

  if (message === "Verified UoM email is required before volunteering.") {
    return 403;
  }

  if (message === "Verified UoM email is required before requesting recommendations.") {
    return 403;
  }

  if (message === "Verified UoM email is required before responding to recommendations.") {
    return 403;
  }

  if (
    message === "A pending recommendation request already exists for this volunteer." ||
    message === "A recommendation request already exists for this volunteer."
  ) {
    return 409;
  }

  if (message === "Requested volunteer profile was not found.") {
    return 404;
  }

  if (
    message.endsWith("access is required.") ||
    message.endsWith("permission is required.") ||
    message.startsWith("Required ")
  ) {
    return 403;
  }

  return fallback;
}
