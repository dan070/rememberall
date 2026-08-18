import { declutter, placeNearTheme } from "./layout";
import { retirePaper } from "./paper";
import type { BubbleState, Item, Note, Stack, Theme } from "./types";

export interface AppState {
  stacks: Stack[];
  activeStackId: string;
  /** Index into the active stack's archive[], or null for its currentPaper. */
  viewingArchiveIndex: number | null;
}

export type Action =
  | { type: "hydrate"; stacks: Stack[]; activeStackId: string; viewingArchiveIndex: number | null }
  | { type: "setActiveStack"; stackId: string }
  | { type: "setViewingArchiveIndex"; index: number | null }
  | { type: "createTheme"; id: string; text: string; x: number; y: number }
  | { type: "createItem"; id: string; themeId: string; text: string }
  | { type: "updateThemeText"; id: string; text: string }
  | { type: "updateItemText"; id: string; text: string }
  | { type: "updateThemeDate"; id: string; date: string | null }
  | { type: "updateItemDate"; id: string; date: string | null }
  | { type: "setThemeState"; id: string; state: BubbleState }
  | { type: "setItemState"; id: string; state: BubbleState }
  | { type: "switchItemTheme"; itemId: string; newThemeId: string }
  | { type: "addNote"; itemId: string; text: string }
  | { type: "toggleNote"; itemId: string; noteIndex: number }
  | { type: "retireCurrentPaper" }
  | { type: "createStack"; id: string; name: string }
  | { type: "rearrange" };

function findStack(stacks: Stack[], id: string): Stack {
  const stack = stacks.find((s) => s.id === id);
  if (!stack) throw new Error(`unknown stack: ${id}`);
  return stack;
}

/** Applies an update to a single stack, marking it interacted-with, and
 * returns a new stacks array. `viewingArchiveIndex` gates which paper
 * (current, or a frozen archived one) the update is even allowed to
 * touch — callers must check isReadOnly() before dispatching a mutation,
 * this is just the data-level enforcement backstop. */
function withStack(stacks: Stack[], stackId: string, fn: (stack: Stack) => Stack): Stack[] {
  return stacks.map((s) => (s.id === stackId ? { ...fn(s), lastInteractionAt: new Date().toISOString() } : s));
}

function withCurrentPaper(stack: Stack, fn: (themes: Theme[], items: Item[]) => { themes: Theme[]; items: Item[] }): Stack {
  const { themes, items } = fn(stack.currentPaper.themes, stack.currentPaper.items);
  return { ...stack, currentPaper: { ...stack.currentPaper, themes, items } };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return { stacks: action.stacks, activeStackId: action.activeStackId, viewingArchiveIndex: action.viewingArchiveIndex };

    case "setActiveStack":
      // Always land on the new stack's current (editable) paper.
      return { ...state, activeStackId: action.stackId, viewingArchiveIndex: null };

    case "setViewingArchiveIndex":
      return { ...state, viewingArchiveIndex: action.index };

    case "createTheme": {
      const theme: Theme = { id: action.id, text: action.text, date: null, state: "live", statusAt: null, x: action.x, y: action.y };
      const stacks = withStack(state.stacks, state.activeStackId, (stack) =>
        withCurrentPaper(stack, (themes, items) => {
          const nextThemes = [...themes, theme];
          declutter(nextThemes, items);
          return { themes: nextThemes, items };
        }),
      );
      return { ...state, stacks };
    }

    case "createItem": {
      const stacks = withStack(state.stacks, state.activeStackId, (stack) =>
        withCurrentPaper(stack, (themes, items) => {
          const theme = themes.find((t) => t.id === action.themeId);
          const pos = theme ? placeNearTheme(theme) : { x: 400, y: 400 };
          const item: Item = { id: action.id, themeId: action.themeId, text: action.text, date: null, state: "live", x: pos.x, y: pos.y, notes: [] };
          const nextItems = [...items, item];
          declutter(themes, nextItems);
          return { themes, items: nextItems };
        }),
      );
      return { ...state, stacks };
    }

    case "updateThemeText": {
      const stacks = withStack(state.stacks, state.activeStackId, (stack) =>
        withCurrentPaper(stack, (themes, items) => ({
          themes: themes.map((t) => (t.id === action.id ? { ...t, text: action.text } : t)),
          items,
        })),
      );
      return { ...state, stacks };
    }

    case "updateItemText": {
      const stacks = withStack(state.stacks, state.activeStackId, (stack) =>
        withCurrentPaper(stack, (themes, items) => ({
          themes,
          items: items.map((it) => (it.id === action.id ? { ...it, text: action.text } : it)),
        })),
      );
      return { ...state, stacks };
    }

    case "updateThemeDate": {
      const stacks = withStack(state.stacks, state.activeStackId, (stack) =>
        withCurrentPaper(stack, (themes, items) => ({
          themes: themes.map((t) => (t.id === action.id ? { ...t, date: action.date } : t)),
          items,
        })),
      );
      return { ...state, stacks };
    }

    case "updateItemDate": {
      const stacks = withStack(state.stacks, state.activeStackId, (stack) =>
        withCurrentPaper(stack, (themes, items) => ({
          themes,
          items: items.map((it) => (it.id === action.id ? { ...it, date: action.date } : it)),
        })),
      );
      return { ...state, stacks };
    }

    case "setThemeState": {
      const stacks = withStack(state.stacks, state.activeStackId, (stack) =>
        withCurrentPaper(stack, (themes, items) => ({
          themes: themes.map((t) =>
            t.id === action.id
              ? { ...t, state: action.state, statusAt: action.state === "live" ? null : new Date().toISOString().slice(0, 10) }
              : t,
          ),
          items,
        })),
      );
      return { ...state, stacks };
    }

    case "setItemState": {
      const stacks = withStack(state.stacks, state.activeStackId, (stack) =>
        withCurrentPaper(stack, (themes, items) => ({
          themes,
          items: items.map((it) => (it.id === action.id ? { ...it, state: action.state } : it)),
        })),
      );
      return { ...state, stacks };
    }

    case "switchItemTheme": {
      const stacks = withStack(state.stacks, state.activeStackId, (stack) =>
        withCurrentPaper(stack, (themes, items) => {
          const newTheme = themes.find((t) => t.id === action.newThemeId);
          if (!newTheme) return { themes, items };
          const pos = placeNearTheme(newTheme);
          const nextItems = items.map((it) => (it.id === action.itemId ? { ...it, themeId: action.newThemeId, x: pos.x, y: pos.y } : it));
          declutter(themes, nextItems);
          return { themes, items: nextItems };
        }),
      );
      return { ...state, stacks };
    }

    case "addNote": {
      const stacks = withStack(state.stacks, state.activeStackId, (stack) =>
        withCurrentPaper(stack, (themes, items) => ({
          themes,
          items: items.map((it) => {
            if (it.id !== action.itemId) return it;
            const note: Note = { text: action.text, done: false };
            return { ...it, notes: [...it.notes, note] };
          }),
        })),
      );
      return { ...state, stacks };
    }

    case "toggleNote": {
      const stacks = withStack(state.stacks, state.activeStackId, (stack) =>
        withCurrentPaper(stack, (themes, items) => ({
          themes,
          items: items.map((it) => {
            if (it.id !== action.itemId) return it;
            const notes = it.notes.map((n, idx) => (idx === action.noteIndex ? { ...n, done: !n.done } : n));
            return { ...it, notes };
          }),
        })),
      );
      return { ...state, stacks };
    }

    case "retireCurrentPaper": {
      const stacks = withStack(state.stacks, state.activeStackId, (stack) => {
        const { archived, nextPaper } = retirePaper(stack.currentPaper);
        return { ...stack, currentPaper: nextPaper, archive: [...stack.archive, archived] };
      });
      return { ...state, stacks, viewingArchiveIndex: null };
    }

    case "createStack": {
      const stack: Stack = {
        id: action.id,
        name: action.name,
        lastInteractionAt: new Date().toISOString(),
        currentPaper: { paperIndex: 1, createdAt: new Date().toISOString(), themes: [], items: [] },
        archive: [],
      };
      return { ...state, stacks: [...state.stacks, stack], activeStackId: stack.id, viewingArchiveIndex: null };
    }

    case "rearrange": {
      const stacks = withStack(state.stacks, state.activeStackId, (stack) =>
        withCurrentPaper(stack, (themes, items) => {
          const nextThemes = themes.map((t) => ({ ...t }));
          const nextItems = items.map((it) => ({ ...it }));
          declutter(nextThemes, nextItems, 24);
          return { themes: nextThemes, items: nextItems };
        }),
      );
      return { ...state, stacks };
    }

    default:
      return state;
  }
}

export function activeStack(state: AppState): Stack {
  return findStack(state.stacks, state.activeStackId);
}

export function isReadOnly(state: AppState): boolean {
  return state.viewingArchiveIndex !== null;
}

/** The paper actually being displayed: the stack's live paper, or a frozen
 * one pulled up from the archive for viewing. */
export function activePaper(state: AppState) {
  const stack = activeStack(state);
  return state.viewingArchiveIndex === null ? stack.currentPaper : stack.archive[state.viewingArchiveIndex];
}
