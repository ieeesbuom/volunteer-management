"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DashboardOpportunityItem } from "@/features/dashboard/lib/opportunity-types";

type AppPageNavContextValue = {
  defaultTitle: string;
  description: string | null;
  displayTitle: string;
  extras: ReactNode;
  navHeight: number;
  opportunityList: DashboardOpportunityItem[];
  setNavExtras: (extras: ReactNode) => void;
  setNavHeight: (height: number) => void;
  setOpportunityList: (items: DashboardOpportunityItem[]) => void;
  setPageNav: (patch: { title?: string | null; description?: string | null }) => void;
  titleOverride: string | null;
};

const AppPageNavContext = createContext<AppPageNavContextValue | null>(null);

export function AppPageNavProvider({
  children,
  defaultTitle,
}: Readonly<{
  children: ReactNode;
  defaultTitle: string;
}>) {
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [extras, setExtras] = useState<ReactNode>(null);
  const [navHeight, setNavHeight] = useState(0);
  const [opportunityList, setOpportunityList] = useState<DashboardOpportunityItem[]>([]);

  const setPageNav = useCallback(
    (patch: { title?: string | null; description?: string | null }) => {
      if ("title" in patch) {
        setTitleOverride(patch.title ?? null);
      }
      if ("description" in patch) {
        setDescription(patch.description ?? null);
      }
    },
    [],
  );

  const displayTitle = titleOverride ?? defaultTitle;

  const value = useMemo(
    () => ({
      defaultTitle,
      description,
      displayTitle,
      extras,
      navHeight,
      opportunityList,
      setNavExtras: setExtras,
      setNavHeight,
      setOpportunityList,
      setPageNav,
      titleOverride,
    }),
    [
      defaultTitle,
      description,
      displayTitle,
      extras,
      navHeight,
      opportunityList,
      setPageNav,
      titleOverride,
    ],
  );

  return <AppPageNavContext.Provider value={value}>{children}</AppPageNavContext.Provider>;
}

export function useAppPageNav() {
  const ctx = useContext(AppPageNavContext);
  if (!ctx) {
    throw new Error("useAppPageNav must be used within AppPageNavProvider");
  }
  return ctx;
}

export function AppTopNavSpacer() {
  const { navHeight } = useAppPageNav();
  return <div aria-hidden className="shrink-0" style={{ height: navHeight }} />;
}
