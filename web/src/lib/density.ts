import type { CurrentPaper } from "./types";

export interface DensitySummary {
  openCount: number;
  doneCount: number;
  cancelledCount: number;
  totalCount: number;
  /** 0..1 share of items that are still open — feeds the list view's
   * fill bar, a lightweight substitute for "glance at how cramped the
   * board looks" now that the phone view has no spatial map at all. */
  openFraction: number;
}

/** Counts items only, not themes — a theme with all-done items but itself
 * still "live" would otherwise skew the ratio; items are what you
 * actually check off day to day. */
export function summarizeDensity(paper: CurrentPaper): DensitySummary {
  const openCount = paper.items.filter((it) => it.state === "live").length;
  const doneCount = paper.items.filter((it) => it.state === "done").length;
  const cancelledCount = paper.items.filter((it) => it.state === "cancelled").length;
  const totalCount = paper.items.length;
  return {
    openCount,
    doneCount,
    cancelledCount,
    totalCount,
    openFraction: totalCount === 0 ? 0 : openCount / totalCount,
  };
}
