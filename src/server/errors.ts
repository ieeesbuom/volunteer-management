import "server-only";

import { AppwriteException } from "node-appwrite";
import { NextResponse } from "next/server";
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

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function routeErrorMessage(error: unknown, fallback: string): string {
  if (
    error instanceof ForbiddenError ||
    error instanceof NotFoundError ||
    error instanceof ConflictError ||
    error instanceof ValidationError ||
    error instanceof TooManyRequestsError
  ) {
    return error.message;
  }

  const message = error instanceof Error ? error.message : fallback;

  if (
    message === "Authentication required." ||
    message === "Admin access required." ||
    message.endsWith("permission is required.") ||
    message.endsWith("access is required.") ||
    message.startsWith("Required ") ||
    message.startsWith("Verified UoM") ||
    message.startsWith("Invalid verification") ||
    message.startsWith("Verification ") ||
    message.startsWith("Too many requests") ||
    message === "This account has been disabled."
  ) {
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
