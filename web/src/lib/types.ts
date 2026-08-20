// Mirrors the wireframe's data model (see wireframe/board.html) — a board
// is a "paper": theme bubbles as hubs, item bubbles connected to a theme.
// Status is presentation-only and fully reversible; nothing is ever
// deleted, only marked. Dates are optional everywhere — most bubbles never
// get one, matching the paper-and-pen original this app is modeled on.

export type BubbleState = "live" | "done" | "cancelled";

export interface Note {
  text: string;
  done: boolean;
}

export interface Theme {
  id: string;
  text: string;
  /** ISO date (YYYY-MM-DD), or null — most themes never get one. */
  date: string | null;
  state: BubbleState;
  /** When `state` last changed away from "live"; null while live. */
  statusAt: string | null;
  x: number;
  y: number;
  /** Server-assigned once synced (drives last-write-wins merge). */
  updatedAt?: number;
}

export interface Item {
  id: string;
  themeId: string;
  text: string;
  date: string | null;
  state: BubbleState;
  x: number;
  y: number;
  notes: Note[];
  updatedAt?: number;
}

/** A stack's single mutable, editable board. */
export interface CurrentPaper {
  paperIndex: number;
  createdAt: string;
  themes: Theme[];
  items: Item[];
}

/** A retired, permanently read-only snapshot — see the "new paper" flow in
 * lib/paper.ts for why its themes/items are clones, never the same object
 * references as anything in a later currentPaper. */
export interface ArchivedPaper extends CurrentPaper {
  retiredAt: string;
}

export interface Stack {
  id: string;
  name: string;
  lastInteractionAt: string;
  currentPaper: CurrentPaper;
  archive: ArchivedPaper[];
  /** Server-assigned once synced (drives last-write-wins merge). Whole
   * stacks sync as one blob — see api/src/types.ts's Stack doc comment for
   * why item-level sync isn't what Step 2 does. */
  updatedAt?: number;
}
