"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ChevronDown,
  Plus,
  LayoutGrid,
  RotateCcw,
  Check,
  Loader2,
} from "lucide-react";
import { useAppPageNav } from "@/components/layout/app-page-nav-context";
import type { SessionUser } from "@/features/access-control/types";
import type { DashboardLayout, DashboardWidgetType } from "@/features/dashboard/types";
import type { DashboardOpportunityItem } from "@/features/dashboard/lib/opportunity-types";
import { DEFAULT_DASHBOARD_LAYOUT } from "@/features/dashboard/lib/default-layout";
import { DashboardDataProvider } from "@/features/dashboard/components/dashboard-data-context";
import { DashboardGrid, layoutItemFromDrop } from "@/features/dashboard/components/dashboard-grid";
import {
  CatalogDragOverlayLabel,
  getCatalogDragWidgetType,
  WidgetCatalogDrawer,
} from "@/features/dashboard/components/widget-catalog-drawer";

function createInstanceId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const emptySubscribe = () => () => {};

function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onCancel} aria-hidden />
      <div
        role="alertdialog"
        aria-labelledby="dashboard-confirm-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-border-subtle bg-surface-overlay p-6 shadow-overlay"
      >
        <h3 id="dashboard-confirm-title" className="text-[15px] font-bold text-text-strong">
          {title}
        </h3>
        <p className="text-[13px] text-text-muted mt-2 leading-relaxed">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-xl border border-border-subtle bg-surface-raised px-4 text-[13px] font-semibold text-text-body hover:bg-bg-base cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-[13px] font-semibold text-white hover:bg-primary-hover cursor-pointer transition-colors shadow-xs"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function CustomizableDashboard({
  user,
  opportunityList,
  initialLayout,
}: {
  user: SessionUser;
  opportunityList: DashboardOpportunityItem[];
  initialLayout: DashboardLayout | null;
}) {
  const { registerCommandCustomize, setNavExtras, setOpportunityList } = useAppPageNav();
  const [layout, setLayout] = useState<DashboardLayout>(
    initialLayout ?? DEFAULT_DASHBOARD_LAYOUT,
  );
  const [editMode, setEditMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [dragWidgetType, setDragWidgetType] = useState<DashboardWidgetType | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openCommandPalette = useCallback(() => {
    setEditMode(true);
    setDrawerOpen(true);
  }, []);

  useLayoutEffect(() => {
    registerCommandCustomize(openCommandPalette);
    return () => registerCommandCustomize(null);
  }, [openCommandPalette, registerCommandCustomize]);

  useLayoutEffect(() => {
    setOpportunityList(opportunityList);
    return () => setOpportunityList([]);
  }, [opportunityList, setOpportunityList]);

  useLayoutEffect(() => {
    setNavExtras(
      <>
        <button
          type="button"
          onClick={() => {
            const next = !editMode;
            setEditMode(next);
            if (next) {
              setDrawerOpen(true);
            }
          }}
          className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition-all ${
            editMode
              ? "border-primary bg-primary-soft text-primary"
              : "border-border-subtle bg-surface-raised text-text-body hover:bg-bg-base"
          }`}
        >
          <LayoutGrid className="size-4" />
          {editMode ? "Done customizing" : "Customize"}
        </button>

        {editMode ? (
          <>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-raised px-4 text-[13px] font-semibold text-text-body hover:bg-bg-base"
            >
              <Plus className="size-4" />
              Widgets
            </button>
            <button
              type="button"
              onClick={() => setResetConfirmOpen(true)}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-raised px-4 text-[13px] font-semibold text-text-body hover:bg-bg-base"
            >
              <RotateCcw className="size-4" />
              Reset
            </button>
          </>
        ) : null}

        {saveState === "saving" ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-text-muted">
            <Loader2 className="size-3.5 animate-spin" /> Saving…
          </span>
        ) : null}
        {saveState === "saved" ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-success">
            <Check className="size-3.5" /> Saved
          </span>
        ) : null}
        {saveState === "error" ? (
          <span className="text-[12px] text-danger">Could not save layout</span>
        ) : null}

        <Link
          href="/events"
          className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[13px] font-semibold text-white transition-all hover:bg-primary-hover"
        >
          <Plus className="size-4 stroke-3" />
          <span>New Project</span>
          <ChevronDown className="size-3.5 opacity-80" />
        </Link>
      </>,
    );
    return () => setNavExtras(null);
  }, [editMode, saveState, setNavExtras]);

  const persistLayout = useCallback(async (next: DashboardLayout) => {
    setSaveState("saving");
    try {
      const res = await fetch("/api/dashboard/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: next }),
      });
      if (!res.ok) {
        throw new Error("Save failed");
      }
      const data = (await res.json()) as { layout?: DashboardLayout };
      if (data.layout) {
        setLayout(data.layout);
      }
      setSaveState("saved");
      if (savedFlashRef.current) {
        clearTimeout(savedFlashRef.current);
      }
      savedFlashRef.current = setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }, []);

  const scheduleSave = useCallback(
    (next: DashboardLayout) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        void persistLayout(next);
      }, 500);
    },
    [persistLayout],
  );

  const updateLayout = useCallback(
    (next: DashboardLayout) => {
      setLayout(next);
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const addWidget = useCallback(
    (widgetType: DashboardWidgetType) => {
      setLayout((prev) => {
        const instanceId = createInstanceId();
        const next: DashboardLayout = {
          version: 1,
          items: [...prev.items, layoutItemFromDrop(widgetType, instanceId, prev.items)],
        };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  function confirmRemoveWidget() {
    if (!pendingRemoveId) {
      return;
    }
    const id = pendingRemoveId;
    setPendingRemoveId(null);
    setLayout((prev) => {
      const next: DashboardLayout = {
        version: 1,
        items: prev.items.filter((item) => item.instanceId !== id),
      };
      scheduleSave(next);
      return next;
    });
  }

  function confirmResetLayout() {
    setResetConfirmOpen(false);
    updateLayout(DEFAULT_DASHBOARD_LAYOUT);
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (savedFlashRef.current) {
        clearTimeout(savedFlashRef.current);
      }
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    const type = getCatalogDragWidgetType(event.active.data.current);
    setDragWidgetType(type);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragWidgetType(null);
    const type = getCatalogDragWidgetType(event.active.data.current);
    if (type && event.over?.id === "dashboard-grid-drop-zone") {
      addWidget(type);
    }
  }

  return (
    <DashboardDataProvider value={{ user, opportunityList }}>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-4 pb-6 text-text-strong antialiased">
          <DashboardGrid
            layout={layout}
            editMode={editMode}
            onLayoutChange={updateLayout}
            onRemoveWidget={setPendingRemoveId}
          />

          <WidgetCatalogDrawer
            open={drawerOpen && editMode}
            onClose={() => setDrawerOpen(false)}
            user={user}
            onAddWidget={addWidget}
            onResetLayout={() => setResetConfirmOpen(true)}
          />

          <DragOverlay>
            {dragWidgetType ? <CatalogDragOverlayLabel widgetType={dragWidgetType} /> : null}
          </DragOverlay>
        </div>

        <ConfirmationDialog
          open={pendingRemoveId !== null}
          title="Remove widget?"
          message="This widget will be removed from your dashboard. You can add it again from the catalog."
          confirmLabel="Remove"
          onConfirm={confirmRemoveWidget}
          onCancel={() => setPendingRemoveId(null)}
        />

        <ConfirmationDialog
          open={resetConfirmOpen}
          title="Reset dashboard?"
          message="Your layout will be restored to the default overview widgets."
          confirmLabel="Reset layout"
          onConfirm={confirmResetLayout}
          onCancel={() => setResetConfirmOpen(false)}
        />

      </DndContext>
    </DashboardDataProvider>
  );
}
