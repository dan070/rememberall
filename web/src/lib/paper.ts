import { ulid } from "ulid";
import { declutter } from "./layout";
import type { ArchivedPaper, CurrentPaper, Item, Stack, Theme } from "./types";

export interface RetireResult {
  archived: ArchivedPaper;
  nextPaper: CurrentPaper;
}

/** Retires a stack's current paper and builds the next one.
 *
 * Carry-over is decided purely by each theme's own status: every item
 * under a live theme moves — even if that item is itself done/cancelled,
 * since an item's mark is presentation, not a signal to strand it. Only
 * themes that are done/cancelled (and everything under them) stay behind.
 *
 * The retiring paper's own theme/item objects are frozen into the archive
 * completely untouched — that's what makes it a permanent, read-only
 * record. The new currentPaper does NOT reuse those objects for the
 * carried-forward themes/items: it clones them with brand-new ids.
 * Without that clone, the same object would sit in both the archived
 * paper's list and the live paper's list — editing it later (renaming,
 * marking done, moving) would silently rewrite history on the paper
 * that's supposed to be frozen. Cloning severs that link at the moment of
 * retirement, so each paper's objects are truly its own from then on. */
export function retirePaper(current: CurrentPaper): RetireResult {
  const retiredAt = new Date().toISOString();
  const archived: ArchivedPaper = { ...current, retiredAt };

  const liveThemes = current.themes.filter((t) => t.state === "live");
  const liveThemeIds = new Set(liveThemes.map((t) => t.id));
  const carriedItems = current.items.filter((it) => liveThemeIds.has(it.themeId));

  const themeIdMap = new Map<string, string>();
  const clonedThemes: Theme[] = liveThemes.map((t) => {
    const newId = ulid();
    themeIdMap.set(t.id, newId);
    return { ...t, id: newId };
  });
  const clonedItems: Item[] = carriedItems.map((it) => ({
    ...it,
    id: ulid(),
    themeId: themeIdMap.get(it.themeId) ?? it.themeId,
    notes: it.notes.map((n) => ({ ...n })),
  }));

  declutter(clonedThemes, clonedItems);

  const nextPaper: CurrentPaper = {
    paperIndex: current.paperIndex + 1,
    createdAt: retiredAt,
    themes: clonedThemes,
    items: clonedItems,
  };

  return { archived, nextPaper };
}

export interface RetireSummary {
  liveThemeCount: number;
  carriedItemCount: number;
  leftBehindThemeCount: number;
  leftBehindItemCount: number;
}

export function summarizeRetirement(current: CurrentPaper): RetireSummary {
  const liveThemes = current.themes.filter((t) => t.state === "live");
  const liveThemeIds = new Set(liveThemes.map((t) => t.id));
  const carriedItems = current.items.filter((it) => liveThemeIds.has(it.themeId));
  return {
    liveThemeCount: liveThemes.length,
    carriedItemCount: carriedItems.length,
    leftBehindThemeCount: current.themes.length - liveThemes.length,
    leftBehindItemCount: current.items.length - carriedItems.length,
  };
}

export function makeEmptyStack(name: string): Stack {
  return {
    id: ulid(),
    name,
    lastInteractionAt: new Date().toISOString(),
    currentPaper: {
      paperIndex: 1,
      createdAt: new Date().toISOString(),
      themes: [],
      items: [],
    },
    archive: [],
  };
}
