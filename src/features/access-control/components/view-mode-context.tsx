"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { VIEW_MODE_COOKIE, parseViewModeCookie, type ViewMode } from "@/features/access-control/lib/view-mode";

interface ViewModeContextValue {
  viewMode: ViewMode;
  isAdmin: boolean;
  isVolunteerPreview: boolean;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

const viewModeListeners = new Set<() => void>();

function subscribeViewMode(callback: () => void) {
  viewModeListeners.add(callback);
  return () => {
    viewModeListeners.delete(callback);
  };
}

function notifyViewModeChange() {
  viewModeListeners.forEach((callback) => callback());
}

function getClientCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setClientCookie(name: string, value: string) {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

export function ViewModeProvider({
  children,
  isAdmin,
  initialViewMode,
}: {
  children: ReactNode;
  isAdmin: boolean;
  initialViewMode?: ViewMode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const viewMode = useSyncExternalStore(
    subscribeViewMode,
    () => parseViewModeCookie(getClientCookie(VIEW_MODE_COOKIE)),
    () => initialViewMode ?? "admin",
  );

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setClientCookie(VIEW_MODE_COOKIE, mode);
      notifyViewModeChange();

      if (mode === "volunteer") {
        const isAdminRoute =
          pathname.startsWith("/admin") ||
          pathname.startsWith("/reports") ||
          pathname === "/events/new";

        if (isAdminRoute) {
          router.push("/dashboard");
          return;
        }
      }

      router.refresh();
    },
    [pathname, router],
  );

  const toggleViewMode = useCallback(() => {
    setViewMode(viewMode === "volunteer" ? "admin" : "volunteer");
  }, [viewMode, setViewMode]);

  const isVolunteerPreview = isAdmin && viewMode === "volunteer";

  const value = useMemo<ViewModeContextValue>(
    () => ({
      viewMode,
      isAdmin,
      isVolunteerPreview,
      setViewMode,
      toggleViewMode,
    }),
    [viewMode, isAdmin, isVolunteerPreview, setViewMode, toggleViewMode],
  );

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    return {
      viewMode: "admin" as ViewMode,
      isAdmin: false,
      isVolunteerPreview: false,
      setViewMode: () => {},
      toggleViewMode: () => {},
    };
  }
  return context;
}
