import { describe, expect, it } from "vitest";
import { retirePaper, summarizeRetirement } from "../src/lib/paper";
import type { CurrentPaper } from "../src/lib/types";

function makePaper(): CurrentPaper {
  return {
    paperIndex: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    themes: [
      { id: "t-live", text: "live theme", date: null, state: "live", statusAt: null, x: 100, y: 100 },
      { id: "t-done", text: "done theme", date: null, state: "done", statusAt: "2026-08-05", x: 300, y: 300 },
    ],
    items: [
      { id: "i-live-open", themeId: "t-live", text: "open item", date: null, state: "live", x: 150, y: 150, notes: [] },
      // An item can be "done" while its theme is still live — per the
      // wireframe's rule, carry-over is decided by the THEME's status,
      // not the item's own mark (a done item is presentation only).
      { id: "i-live-done", themeId: "t-live", text: "finished item", date: null, state: "done", x: 160, y: 160, notes: [{ text: "note", done: true }] },
      { id: "i-under-done-theme", themeId: "t-done", text: "stranded item", date: null, state: "live", x: 320, y: 320, notes: [] },
    ],
  };
}

describe("summarizeRetirement", () => {
  it("counts only items under live themes as carried, regardless of the item's own state", () => {
    const summary = summarizeRetirement(makePaper());
    expect(summary.liveThemeCount).toBe(1);
    expect(summary.carriedItemCount).toBe(2); // both items under t-live, including the done one
    expect(summary.leftBehindThemeCount).toBe(1);
    expect(summary.leftBehindItemCount).toBe(1); // the item under the done theme
  });
});

describe("retirePaper", () => {
  it("freezes the original objects into the archive untouched", () => {
    const original = makePaper();
    const { archived } = retirePaper(original);
    expect(archived.themes).toBe(original.themes);
    expect(archived.items).toBe(original.items);
    expect(archived.retiredAt).toBeTruthy();
  });

  it("clones carried-forward themes/items with new ids, never reusing the archived objects", () => {
    const original = makePaper();
    const { archived, nextPaper } = retirePaper(original);

    expect(nextPaper.themes).toHaveLength(1);
    expect(nextPaper.items).toHaveLength(2);

    const newTheme = nextPaper.themes[0];
    expect(newTheme.id).not.toBe("t-live");
    expect(newTheme.text).toBe("live theme");

    // No object identity is shared between the frozen archive and the new
    // live paper — this is the whole point: editing one must never be able
    // to reach the other.
    for (const item of nextPaper.items) {
      expect(archived.items).not.toContain(item);
      expect(archived.themes).not.toContain(newTheme);
    }
  });

  it("remaps a carried item's themeId to its theme's new cloned id", () => {
    const original = makePaper();
    const { nextPaper } = retirePaper(original);
    const newTheme = nextPaper.themes[0];
    for (const item of nextPaper.items) {
      expect(item.themeId).toBe(newTheme.id);
    }
  });

  it("mutating the new paper's item after retirement does not affect the archived snapshot", () => {
    const original = makePaper();
    const { archived, nextPaper } = retirePaper(original);
    nextPaper.items[0].text = "edited after retirement";
    nextPaper.items[0].notes.push({ text: "new note", done: false });

    const archivedEquivalent = archived.items.find((it) => it.id === "i-live-open");
    expect(archivedEquivalent?.text).toBe("open item");
    expect(archivedEquivalent?.notes).toHaveLength(0);
  });

  it("increments paperIndex and stamps a fresh createdAt", () => {
    const original = makePaper();
    const { nextPaper } = retirePaper(original);
    expect(nextPaper.paperIndex).toBe(2);
    expect(nextPaper.createdAt).not.toBe(original.createdAt);
  });

  it("drops themes/items left behind (done/cancelled) from the next paper entirely", () => {
    const original = makePaper();
    const { nextPaper } = retirePaper(original);
    expect(nextPaper.themes.find((t) => t.text === "done theme")).toBeUndefined();
    expect(nextPaper.items.find((it) => it.text === "stranded item")).toBeUndefined();
  });
});
