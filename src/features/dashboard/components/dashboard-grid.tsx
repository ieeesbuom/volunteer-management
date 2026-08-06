"use client";

import { useMemo } from "react";
import ReactGridLayout, {
  useContainerWidth,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { GripVertical, Trash2 } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import type { DashboardLayout, DashboardLayoutItem } from "@/features/dashboard/types";
import { getWidgetDefinition } from "@/features/dashboard/lib/widget-registry";
import { DashboardWidgetRenderer } from "@/features/dashboard/components/dashboard-widget-renderer";
import { cn } from "@/lib/utils";

function toGridLayout(items: DashboardLayoutItem[]): Layout {
  return items.map((item) => {
    const def = getWidgetDefinition(item.widgetType);
    return {
      i: item.instanceId,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: def.defaultSize.minW,
      minH: def.defaultSize.minH,
    };
  });
}

function mergeGridLayout(items: DashboardLayoutItem[], gridLayout: Layout): DashboardLayoutItem[] {
  const byId = new Map(gridLayout.map((cell) => [cell.i, cell]));

  return items.map((item) => {
    const cell = byId.get(item.instanceId);
    if (!cell) {
      return item;
    }
    return {
      ...item,
      x: cell.x,
      y: cell.y,
      w: cell.w,
      h: cell.h,
    };
  });
}

export function DashboardGrid({
  layout,
  editMode,
  onLayoutChange,
  onRemoveWidget,
  dropHighlight,
}: {
  layout: DashboardLayout;
  editMode: boolean;
  onLayoutChange: (layout: DashboardLayout) => void;
  onRemoveWidget: (instanceId: string) => void;
  dropHighlight?: boolean;
}) {
  const { width, containerRef, mounted } = useContainerWidth();
  const gridLayout = useMemo(() => toGridLayout(layout.items), [layout.items]);

  const { setNodeRef, isOver } = useDroppable({
    id: "dashboard-grid-drop-zone",
  });

  function setContainerNode(element: HTMLDivElement | null) {
    containerRef.current = element;
    setNodeRef(element);
  }

  function handleLayoutChange(next: Layout) {
    onLayoutChange({
      version: layout.version,
      items: mergeGridLayout(layout.items, next),
    });
  }

  return (
    <div
      ref={setContainerNode}
      className={cn(
        "dashboard-grid min-h-[200px] rounded-xl transition-shadow",
        editMode && "edit-mode ring-1 ring-border-subtle ring-inset",
        (isOver || dropHighlight) && editMode && "ring-2 ring-primary/30 bg-primary-soft/30",
      )}
    >
      {layout.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center border border-dashed border-border-subtle rounded-xl bg-bg-base">
          <p className="text-[14px] font-semibold text-text-strong">Your dashboard is empty</p>
          <p className="text-[13px] text-text-muted mt-1 max-w-sm">
            Open the widget catalog and add components to build your overview.
          </p>
        </div>
      ) : (
        mounted && (
          <ReactGridLayout
            width={width}
            layout={gridLayout}
            gridConfig={{
              cols: 12,
              rowHeight: 48,
              margin: [16, 16] as const,
              containerPadding: [0, 0] as const,
            }}
            dragConfig={{
              enabled: editMode,
              handle: ".widget-drag-handle",
            }}
            resizeConfig={{
              enabled: editMode,
              handles: editMode ? ["se"] : [],
            }}
            compactor={verticalCompactor}
            onLayoutChange={handleLayoutChange}
          >
            {layout.items.map((item) => (
              <div
                key={item.instanceId}
                className={cn(
                  "relative h-full overflow-hidden rounded-2xl transition-all",
                  editMode && "ring-2 ring-primary/40 border-2 border-dashed border-primary/30 shadow-md",
                )}
              >
                {editMode && (
                  <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 pointer-events-none">
                    <button
                      type="button"
                      className="widget-drag-handle pointer-events-auto inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-primary-mid bg-surface-raised/95 text-primary hover:bg-primary-soft text-[11px] font-bold shadow-xs cursor-grab active:cursor-grabbing"
                      title="Drag to Move Widget"
                      aria-label="Move widget"
                    >
                      <GripVertical className="size-3.5" />
                      <span>Move</span>
                    </button>

                    {/* Placeholder slot for top-right Resize handle */}
                    <div className="w-[72px] h-8 pointer-events-none" aria-hidden />

                    <button
                      type="button"
                      onClick={() => onRemoveWidget(item.instanceId)}
                      className="pointer-events-auto inline-flex size-8 items-center justify-center rounded-lg border border-rose-200 bg-surface-raised/95 text-danger hover:bg-danger-soft shadow-xs cursor-pointer"
                      title="Remove Widget"
                      aria-label="Remove widget"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
                <div className="h-full min-h-0 flex flex-col">
                  <DashboardWidgetRenderer widgetType={item.widgetType} />
                </div>
              </div>
            ))}
          </ReactGridLayout>
        )
      )}
    </div>
  );
}

export function layoutItemFromDrop(
  widgetType: DashboardLayoutItem["widgetType"],
  instanceId: string,
  items: DashboardLayoutItem[],
): DashboardLayoutItem {
  const def = getWidgetDefinition(widgetType);
  const y = items.length === 0 ? 0 : Math.max(...items.map((i) => i.y + i.h));
  return {
    instanceId,
    widgetType,
    x: 0,
    y,
    w: def.defaultSize.w,
    h: def.defaultSize.h,
  };
}

export type { LayoutItem };
