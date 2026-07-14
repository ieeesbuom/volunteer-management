import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUserFacingError(
  error: unknown,
  fallback = "An unexpected error occurred. Please try again.",
): string {
  if (!error) return fallback;
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
      ? error.message
      : typeof error === "object" && error && "error" in error && typeof (error as Record<string, unknown>).error === "string"
      ? String((error as Record<string, unknown>).error)
      : String(error);

  if (!message || message === "Error" || message === "[object Object]") {
    return fallback;
  }

  // Check for common technical / database / Appwrite errors and convert them to simple human-readable messages
  if (
    message.includes("rowId") ||
    message.includes("UID must contain") ||
    message.includes("Valid chars are") ||
    message.includes("document with the requested ID") ||
    message.includes("invalid param")
  ) {
    return "We encountered a technical issue while saving this record. Please refresh the page and try again.";
  }

  if (
    message.includes("AppwriteException") ||
    message.includes("ECONNREFUSED") ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("500 Internal") ||
    message.includes("fetch failed")
  ) {
    return "Could not connect to the server. Please check your internet connection and try again.";
  }

  if (
    message.includes("Unexpected token") ||
    message.includes("JSON") ||
    message.includes("syntax error")
  ) {
    return "Received an invalid response from the server. Please refresh and try again.";
  }

  if (message.includes("uomVerified") || message.includes("Verify UoM")) {
    return "Please verify the user's University email address before making changes.";
  }

  // Strip any leading error prefixes or technical codes
  let cleaned = message.replace(/^(Error:\s*|AppwriteException:\s*)/i, "").trim();

  // If the cleaned message still contains technical jargon like sql, appwrite, database, schema, return fallback
  if (
    /appwrite|database|table|column|schema|exception|stack trace|invalid param/i.test(cleaned)
  ) {
    return fallback;
  }

  // Capitalize first letter and ensure it ends with a period
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    if (!/[.!?]$/.test(cleaned)) {
      cleaned += ".";
    }
  }

  return cleaned || fallback;
}
