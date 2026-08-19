import { describe, expect, it } from "vitest";
import { summarizeDensity } from "../src/lib/density";
import type { CurrentPaper, Item } from "../src/lib/types";

function makeItem(id: string, state: Item["state"]): Item {
  return { id, themeId: "t1", text: id, date: null, state, x: 0, y: 0, notes: [] };
}

function makePaper(items: Item[]): CurrentPaper {
  return { paperIndex: 1, createdAt: "2026-08-01", themes: [], items };
}

describe("summarizeDensity", () => {
  it("counts items by state", () => {
    const paper = makePaper([makeItem("i1", "live"), makeItem("i2", "live"), makeItem("i3", "done"), makeItem("i4", "cancelled")]);
    const s = summarizeDensity(paper);
    expect(s.openCount).toBe(2);
    expect(s.doneCount).toBe(1);
    expect(s.cancelledCount).toBe(1);
    expect(s.totalCount).toBe(4);
  });

  it("computes openFraction as a share of total items", () => {
    const paper = makePaper([makeItem("i1", "live"), makeItem("i2", "done")]);
    expect(summarizeDensity(paper).openFraction).toBeCloseTo(0.5);
  });

  it("returns 0 openFraction for an empty paper instead of dividing by zero", () => {
    const paper = makePaper([]);
    const s = summarizeDensity(paper);
    expect(s.totalCount).toBe(0);
    expect(s.openFraction).toBe(0);
    expect(Number.isNaN(s.openFraction)).toBe(false);
  });
});
