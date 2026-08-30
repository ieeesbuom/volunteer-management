import "server-only";

import { cookies } from "next/headers";
import { VIEW_MODE_COOKIE, parseViewModeCookie, type ViewMode } from "@/features/access-control/lib/view-mode";

export async function getServerViewMode(): Promise<ViewMode> {
  try {
    const cookieStore = await cookies();
    return parseViewModeCookie(cookieStore.get(VIEW_MODE_COOKIE)?.value);
  } catch {
    return "admin";
  }
}

export async function isVolunteerPreviewActive(isAdmin: boolean): Promise<boolean> {
  if (!isAdmin) {
    return false;
  }
  const mode = await getServerViewMode();
  return mode === "volunteer";
}
