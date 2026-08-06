"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, LayoutGrid, Plus, RotateCcw, Search, X } from "lucide-react";
import type { SessionUser } from "@/features/access-control/types";
import type { DashboardWidgetType } from "@/features/dashboard/types";
import {
  getWidgetDefinition,
  listWidgetsForUser,
  type WidgetDefinition,
} from "@/features/dashboard/lib/widget-registry";
import { WidgetCatalogPreview } from "@/features/dashboard/components/widget-catalog-preview";
import { cn } from "@/lib/utils";

type CatalogDragData = {
  kind: "catalog-widget";
  widgetType: DashboardWidgetType;
};

function CatalogWidgetRow({
  widget,
  onAdd,
}: {
  widget: WidgetDefinition;
  onAdd: (type: DashboardWidgetType) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `catalog-${widget.type}`,
    data: { kind: "catalog-widget", widgetType: widget.type } satisfies CatalogDragData,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-border-subtle bg-bg-base overflow-hidden transition-colors hover:border-border-default",
        isDragging && "opacity-40",
      )}
    >
      <WidgetCatalogPreview widgetType={widget.type} />

      <div className="flex items-start gap-2 border-t border-border-subtle p-3 bg-surface-raised">
        <button
          type="button"
          className="mt-0.5 p-1 text-text-muted hover:text-text-strong cursor-grab active:cursor-grabbing"
          aria-label={`Drag ${widget.title}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-text-strong">{widget.title}</p>
          <p className="text-[12px] text-text-muted mt-0.5 leading-snug line-clamp-2">
            {widget.description}
          </p>
          <p className="text-[11px] text-text-placeholder mt-1 uppercase tracking-widest">
            {widget.category}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(widget.type)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-primary hover:bg-primary-soft transition-colors cursor-pointer"
          aria-label={`Add ${widget.title}`}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

const emptySubscribe = () => () => {};

export function WidgetCatalogDrawer({
  open,
  onClose,
  user,
  onAddWidget,
  onResetLayout,
}: {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
  onAddWidget: (type: DashboardWidgetType) => void;
  onResetLayout?: () => void;
}) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [query, setQuery] = useState("");
  const widgets = useMemo(() => listWidgetsForUser(user), [user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return widgets;
    }
    return widgets.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q),
    );
  }, [query, widgets]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Full screen backdrop overlay attached directly to document body */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        aria-hidden
        onClick={onClose}
      />

      {/* Right Drawer Panel stretching 100% viewport height */}
      <aside
        className="fixed top-0 bottom-0 right-0 z-50 flex h-full h-[100dvh] w-full max-w-lg flex-col border-l border-border-subtle bg-surface-overlay shadow-overlay"
        role="dialog"
        aria-label="Widget catalog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-4 text-primary" />
            <h2 className="text-[15px] font-semibold text-text-strong">Add widgets</h2>
          </div>

          <div className="flex items-center gap-2">
            {onResetLayout && (
              <button
                type="button"
                onClick={onResetLayout}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border-subtle bg-bg-base text-text-body hover:bg-neutral-soft hover:text-text-strong text-[12px] font-semibold transition-colors cursor-pointer"
                title="Reset dashboard layout to default"
              >
                <RotateCcw className="size-3.5 text-text-muted" />
                <span>Reset Layout</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-bg-base hover:text-text-strong cursor-pointer"
              aria-label="Close widget catalog"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-border-subtle shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-placeholder" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search widgets"
              className="h-[38px] w-full rounded-md border border-border-subtle bg-surface-raised pl-9 pr-3 text-[13px] text-text-body placeholder:text-text-placeholder focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/0.12)]"
            />
          </div>
          <p className="text-[12px] text-text-muted mt-2">
            Drag a widget onto the dashboard or click + to add.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
          {filtered.length === 0 ? (
            <p className="text-[13px] text-text-muted py-6 text-center">No widgets match your search.</p>
          ) : (
            filtered.map((widget) => (
              <CatalogWidgetRow key={widget.type} widget={widget} onAdd={onAddWidget} />
            ))
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export type { CatalogDragData };

export function getCatalogDragWidgetType(data: unknown): DashboardWidgetType | null {
  if (
    typeof data === "object" &&
    data !== null &&
    "kind" in data &&
    data.kind === "catalog-widget" &&
    "widgetType" in data &&
    typeof data.widgetType === "string"
  ) {
    return data.widgetType as DashboardWidgetType;
  }
  return null;
}

export function CatalogDragOverlayLabel({ widgetType }: { widgetType: DashboardWidgetType }) {
  const widget = getWidgetDefinition(widgetType);
  return (
    <div className="rounded-lg border border-primary-mid bg-surface-raised px-4 py-3 shadow-lg text-[13px] font-semibold text-text-strong">
      {widget.title}
    </div>
  );
}
