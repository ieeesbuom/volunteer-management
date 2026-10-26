export const VIEW_MODE_COOKIE = "voluntieee_view_mode";

export type ViewMode = "admin" | "volunteer";

export function parseViewModeCookie(cookieValue?: string | null): ViewMode {
  return cookieValue === "volunteer" ? "volunteer" : "admin";
}
