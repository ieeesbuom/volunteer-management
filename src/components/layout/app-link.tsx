"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import Link, { useLinkStatus } from "next/link";
import {
  finishNavigationProgress,
  startHeldNavigationProgress,
} from "@/components/layout/navigation-progress";

function AppLinkStatus() {
  const { pending } = useLinkStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending && !wasPending.current) {
      wasPending.current = true;
      startHeldNavigationProgress();
    } else if (!pending && wasPending.current) {
      wasPending.current = false;
      finishNavigationProgress();
    }
  }, [pending]);

  useEffect(() => {
    return () => {
      if (!wasPending.current) {
        return;
      }
      wasPending.current = false;
      finishNavigationProgress();
    };
  }, []);

  return null;
}

export function AppLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      <AppLinkStatus />
      {children}
    </Link>
  );
}
