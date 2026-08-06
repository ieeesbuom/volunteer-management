import { describe, expect, it } from "vitest";
import { dashboardLayoutSchema } from "@/features/dashboard/validation";

describe("dashboardLayoutSchema", () => {
  it("accepts a valid layout", () => {
    const parsed = dashboardLayoutSchema.parse({
      version: 1,
      items: [
        {
          instanceId: "a",
          widgetType: "quick_links",
          x: 0,
          y: 0,
          w: 4,
          h: 3,
        },
      ],
    });

    expect(parsed.items).toHaveLength(1);
  });

  it("rejects unknown widget types", () => {
    expect(() =>
      dashboardLayoutSchema.parse({
        version: 1,
        items: [
          {
            instanceId: "a",
            widgetType: "unknown_widget",
            x: 0,
            y: 0,
            w: 4,
            h: 3,
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects widgets that extend past 12 columns", () => {
    expect(() =>
      dashboardLayoutSchema.parse({
        version: 1,
        items: [
          {
            instanceId: "a",
            widgetType: "quick_links",
            x: 10,
            y: 0,
            w: 4,
            h: 3,
          },
        ],
      }),
    ).toThrow(/extends past the grid/);
  });

  it("rejects duplicate instance ids", () => {
    expect(() =>
      dashboardLayoutSchema.parse({
        version: 1,
        items: [
          {
            instanceId: "dup",
            widgetType: "quick_links",
            x: 0,
            y: 0,
            w: 4,
            h: 3,
          },
          {
            instanceId: "dup",
            widgetType: "schedule",
            x: 0,
            y: 3,
            w: 6,
            h: 4,
          },
        ],
      }),
    ).toThrow(/Duplicate instanceId/);
  });

  it("rejects more than 24 widgets", () => {
    const items = Array.from({ length: 25 }, (_, index) => ({
      instanceId: `w-${index}`,
      widgetType: "quick_links" as const,
      x: 0,
      y: index,
      w: 4,
      h: 1,
    }));

    expect(() =>
      dashboardLayoutSchema.parse({
        version: 1,
        items,
      }),
    ).toThrow();
  });
});
