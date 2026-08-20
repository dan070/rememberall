// Mirrors web/src/lib/types.ts plus the one field only the server assigns.
export type BubbleState = "live" | "done" | "cancelled";

export interface Note {
  text: string;
  done: boolean;
}

export interface Theme {
  id: string;
  text: string;
  date: string | null;
  state: BubbleState;
  statusAt: string | null;
  x: number;
  y: number;
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
}

export interface CurrentPaper {
  paperIndex: number;
  createdAt: string;
  themes: Theme[];
  items: Item[];
}

export interface ArchivedPaper extends CurrentPaper {
  retiredAt: string;
}

/** A whole stack, synced as one blob (see stacks.ts for why: the data is a
 * nested tree — Stack -> CurrentPaper -> Themes/Items, plus an Archive —
 * not flat rows like WeightWatcher's entries, so item-level sync would
 * mean either denormalizing themes/items into their own rows now or
 * shipping a coarser whole-stack sync first and refining later. Step 2's
 * plan is deliberately the coarse version; Step 3 is where the merge
 * granularity gets revisited if it's ever needed). */
export interface Stack {
  id: string;
  name: string;
  lastInteractionAt: string;
  currentPaper: CurrentPaper;
  archive: ArchivedPaper[];
  /** Server-assigned epoch ms. Drives the GSI1 sort key and last-write-wins merge. */
  updatedAt: number;
}
