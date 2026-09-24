import { fieldInputClasses, fieldTextareaClasses } from "@/components/ui/field";
import type { ConclusionStatus, EventStatus } from "@/features/events/types";
import { getOperationalStatusTransitions } from "@/features/events/lib/event-status-transitions";

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";

export const eventInputClasses = fieldInputClasses;
export const eventTextareaClasses = fieldTextareaClasses;

export function formatEventStatus(status: EventStatus) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatConclusionStatus(status: ConclusionStatus) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getEventStatusBadgeTone(status: EventStatus): BadgeTone {
  switch (status) {
    case "draft":
      return "neutral";
    case "planning":
      return "primary";
    case "published":
      return "primary";
    case "ongoing":
      return "success";
    case "pending_conclusion":
      return "warning";
    case "closed":
      return "neutral";
    default:
      return "neutral";
  }
}

export function getConclusionStatusBadgeTone(status: ConclusionStatus): BadgeTone {
  switch (status) {
    case "not_submitted":
      return "neutral";
    case "submitted":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

export function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isoToDateInput(value?: string) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

export function dateInputToIso(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

export function getAvailableStatusTransitions(
  current: EventStatus,
  { isAdmin }: { isAdmin: boolean },
): EventStatus[] {
  return getOperationalStatusTransitions(current, { isAdmin });
}

export function formatEventRole(role: string, displayRole?: string) {
  if (displayRole) {
    return displayRole;
  }

  return role;
}
