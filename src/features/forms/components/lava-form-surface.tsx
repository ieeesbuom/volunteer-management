"use client";

import { useEffect, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { lavaFillPath } from "@/features/forms/lib/lava-paths";
import { cn } from "@/lib/utils";

function elementText(node: Element) {
  return (node.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function closestSection(node: Element) {
  return (
    node.closest("div.sm\\:col-span-2") ??
    node.closest("div.rounded-lg") ??
    node.closest("div.rounded-xl") ??
    node.parentElement
  );
}

function hideMatchingSections(root: HTMLElement, matchers: string[]) {
  const labels = root.querySelectorAll("label, p, span, h3, h4, button");
  for (const label of labels) {
    const text = elementText(label);
    if (!matchers.some((matcher) => text.includes(matcher))) {
      continue;
    }

    const section = closestSection(label);
    if (section instanceof HTMLElement) {
      section.dataset.vmsHide = "true";
    }
  }
}

function hidePerMemberControls(root: HTMLElement) {
  const nodes = root.querySelectorAll("span, button, label, p");
  for (const node of nodes) {
    const text = elementText(node);
    if (text !== "per-member field" && text !== "per member") {
      continue;
    }

    const row =
      node.closest("div.flex") ??
      node.closest("div") ??
      node.parentElement;
    if (row instanceof HTMLElement) {
      row.dataset.vmsHide = "true";
    }
  }
}

function clearHidden(root: HTMLElement) {
  for (const node of root.querySelectorAll<HTMLElement>("[data-vms-hide]")) {
    delete node.dataset.vmsHide;
  }
}

export function LavaFormSurface({
  children,
  eventId,
  connectionId,
  fillPath,
  groupAnswersEnabled = false,
  responsesHash = "#responses",
  variant = "default",
}: {
  children: ReactNode;
  connectionId: string;
  eventId: string;
  fillPath?: string;
  groupAnswersEnabled?: boolean;
  responsesHash?: string;
  variant?: "default" | "builder";
}) {
  const router = useRouter();
  const livePath = fillPath ?? lavaFillPath(eventId, connectionId);

  useEffect(() => {
    if (variant !== "builder") {
      return;
    }

    const root = document.querySelector<HTMLElement>(".lfb-root--vms-builder");
    if (!root) {
      return;
    }

    const apply = () => {
      clearHidden(root);
      hideMatchingSections(root, [
        "form type",
        "confirmation email",
        "google sheets",
      ]);
      if (!groupAnswersEnabled) {
        hideMatchingSections(root, ["min / max team size", "team size"]);
        hidePerMemberControls(root);
      }
    };

    apply();
    const observer = new MutationObserver(() => apply());
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [groupAnswersEnabled, variant]);

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as HTMLElement | null)?.closest("a");
    if (!anchor) {
      return;
    }

    const href = anchor.getAttribute("href");
    if (!href) {
      return;
    }

    if (href.startsWith("/admin/registrations")) {
      event.preventDefault();
      const target = document.getElementById("responses");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        router.push(`${window.location.pathname}${responsesHash}`);
      }
      return;
    }

    if (href.startsWith("/admin")) {
      event.preventDefault();
      return;
    }

    const pathname = href.split("?")[0]?.split("#")[0] ?? href;
    const isSingleSegmentPath = /^\/[A-Za-z0-9_-]+\/?$/.test(pathname);
    if (
      anchor.getAttribute("title") === "View live form" ||
      (anchor.target === "_blank" && isSingleSegmentPath)
    ) {
      event.preventDefault();
      window.open(livePath, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div
      className={cn(
        "lfb-root",
        variant === "builder" && "lfb-root--vms-builder",
        variant === "builder" && (groupAnswersEnabled ? "lfb-root--group" : "lfb-root--solo"),
      )}
      onClickCapture={handleClickCapture}
    >
      {children}
    </div>
  );
}
