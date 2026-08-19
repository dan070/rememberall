import { useEffect, useReducer, useRef, useState } from "react";
import { ulid } from "ulid";
import { Board } from "./components/Board";
import { ItemCard } from "./components/ItemCard";
import { ListView } from "./components/ListView";
import { Modal } from "./components/Modal";
import { NewThemeDialog } from "./components/NewThemeDialog";
import { PapersPanel } from "./components/PapersPanel";
import { QuickAddPopup } from "./components/QuickAddPopup";
import { ReadOnlyCard } from "./components/ReadOnlyCard";
import { ReadonlyBanner } from "./components/ReadonlyBanner";
import { StacksPanel } from "./components/StacksPanel";
import { ThemeCard } from "./components/ThemeCard";
import { ThemeSwitchDialog } from "./components/ThemeSwitchDialog";
import { TopBar } from "./components/TopBar";
import { getAllStacks, getMeta, putStacks, setMeta } from "./lib/db";
import { useIsMobile } from "./lib/useIsMobile";
import { activePaper, activeStack, isReadOnly, reducer, type AppState } from "./lib/reducer";
import { seedStacks } from "./lib/seed";
import { summarizeRetirement } from "./lib/paper";
import "./App.css";

type ModalState =
  | { kind: "none" }
  | { kind: "theme"; id: string }
  | { kind: "item"; id: string }
  | { kind: "newTheme"; x: number; y: number }
  | { kind: "themeSwitch"; itemId: string }
  | { kind: "stacks" }
  | { kind: "papers" }
  | { kind: "readonly"; objKind: "theme" | "item"; id: string };

const EMPTY_STATE: AppState = { stacks: [], activeStackId: "", viewingArchiveIndex: null };

function App() {
  const [state, dispatch] = useReducer(reducer, EMPTY_STATE);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [quickAddTheme, setQuickAddTheme] = useState<{ id: string; anchorEl: HTMLElement } | null>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useIsMobile();

  // Initial load: read persisted stacks, or seed on first run.
  useEffect(() => {
    (async () => {
      const stacks = await getAllStacks();
      if (stacks.length > 0) {
        const activeStackId = (await getMeta<string>("activeStackId")) ?? stacks[0].id;
        dispatch({ type: "hydrate", stacks, activeStackId, viewingArchiveIndex: null });
      } else {
        const seeded = seedStacks();
        await putStacks(seeded);
        dispatch({ type: "hydrate", stacks: seeded, activeStackId: seeded[0].id, viewingArchiveIndex: null });
      }
      setLoaded(true);
    })();
  }, []);

  // Persist on every change, once initial hydration has happened — avoids
  // an initial empty-state write racing the load above.
  useEffect(() => {
    if (!loaded) return;
    void putStacks(state.stacks);
    void setMeta("activeStackId", state.activeStackId);
  }, [loaded, state.stacks, state.activeStackId]);

  if (!loaded) return null;

  const stack = activeStack(state);
  const paper = activePaper(state);
  const readOnly = isReadOnly(state);

  function pulse(id: string) {
    setPulseId(id);
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = setTimeout(() => setPulseId(null), 900);
  }

  function closeModal() {
    setModal({ kind: "none" });
  }

  return (
    <div className="app">
      <TopBar
        stackName={stack.name}
        paper={paper}
        readOnly={readOnly}
        isMobile={isMobile}
        onOpenStacks={() => setModal({ kind: "stacks" })}
        onOpenPapers={() => setModal({ kind: "papers" })}
        onRearrange={() => dispatch({ type: "rearrange" })}
        onNewPaper={() => {
          const summary = summarizeRetirement(stack.currentPaper);
          const ok = window.confirm(
            `Retire "${stack.name}" paper #${stack.currentPaper.paperIndex} and start #${stack.currentPaper.paperIndex + 1}?\n\n` +
              `Carries forward: ${summary.liveThemeCount} live theme(s), ${summary.carriedItemCount} item(s) under them (done/cancelled included).\n` +
              `Left behind as a static, frozen record: ${summary.leftBehindThemeCount} theme(s), ${summary.leftBehindItemCount} item(s).\n\n` +
              `Paper #${stack.currentPaper.paperIndex} will stay browsable under Papers ▾, exactly as it looks now — nothing on it can be edited again.`,
          );
          if (!ok) return;
          dispatch({ type: "retireCurrentPaper" });
        }}
      />

      {readOnly && <ReadonlyBanner onReturn={() => dispatch({ type: "setViewingArchiveIndex", index: null })} />}

      {isMobile ? (
        // Phone: no canvas at all — see lib/useIsMobile.ts and ListView.tsx
        // for why a plain scrollable list replaces the pan/zoom board here.
        <ListView
          paper={paper}
          readOnly={readOnly}
          onOpenTheme={(id) => setModal(readOnly ? { kind: "readonly", objKind: "theme", id } : { kind: "theme", id })}
          onOpenItem={(id) => setModal(readOnly ? { kind: "readonly", objKind: "item", id } : { kind: "item", id })}
          onToggleItemDone={(id) => {
            const item = paper.items.find((it) => it.id === id);
            if (!item) return;
            dispatch({ type: "setItemState", id, state: item.state === "done" ? "live" : "done" });
          }}
          onAddItemToTheme={(themeId, text) => {
            const id = ulid();
            dispatch({ type: "createItem", id, themeId, text });
            pulse(id);
          }}
          onCreateTheme={(text) => {
            const id = ulid();
            // No tap coordinate exists in list view — place new themes at a
            // fixed default; declutter() (run inside the reducer) settles
            // it apart from anything already there, same as the canvas does.
            dispatch({ type: "createTheme", id, text, x: 400, y: 400 });
            pulse(id);
          }}
        />
      ) : (
        <Board
          paper={paper}
          readOnly={readOnly}
          pulseId={pulseId}
          onOpenTheme={(id) => setModal(readOnly ? { kind: "readonly", objKind: "theme", id } : { kind: "theme", id })}
          onOpenItem={(id) => setModal(readOnly ? { kind: "readonly", objKind: "item", id } : { kind: "item", id })}
          onAddItemToTheme={(themeId, anchorEl) => setQuickAddTheme({ id: themeId, anchorEl })}
          onTapEmpty={(x, y) => setModal({ kind: "newTheme", x, y })}
        />
      )}

      {!isMobile && quickAddTheme && (
        <QuickAddPopup
          anchorEl={quickAddTheme.anchorEl}
          onDismiss={() => setQuickAddTheme(null)}
          onCommit={(text) => {
            const id = ulid();
            dispatch({ type: "createItem", id, themeId: quickAddTheme.id, text });
            setQuickAddTheme(null);
            pulse(id);
          }}
        />
      )}

      <Modal open={modal.kind === "theme"} onClose={closeModal}>
        {modal.kind === "theme" &&
          (() => {
            const theme = paper.themes.find((t) => t.id === modal.id);
            if (!theme) return null;
            return (
              <ThemeCard
                theme={theme}
                onTextChange={(text) => dispatch({ type: "updateThemeText", id: theme.id, text })}
                onDateChange={(date) => dispatch({ type: "updateThemeDate", id: theme.id, date })}
                onStateChange={(state) => dispatch({ type: "setThemeState", id: theme.id, state })}
                onClose={closeModal}
              />
            );
          })()}
      </Modal>

      <Modal open={modal.kind === "item"} onClose={closeModal}>
        {modal.kind === "item" &&
          (() => {
            const item = paper.items.find((it) => it.id === modal.id);
            if (!item) return null;
            const theme = paper.themes.find((t) => t.id === item.themeId);
            return (
              <ItemCard
                item={item}
                theme={theme}
                onTextChange={(text) => dispatch({ type: "updateItemText", id: item.id, text })}
                onDateChange={(date) => dispatch({ type: "updateItemDate", id: item.id, date })}
                onStateChange={(state) => dispatch({ type: "setItemState", id: item.id, state })}
                onSwitchTheme={() => setModal({ kind: "themeSwitch", itemId: item.id })}
                onAddNote={(text) => dispatch({ type: "addNote", itemId: item.id, text })}
                onToggleNote={(idx) => dispatch({ type: "toggleNote", itemId: item.id, noteIndex: idx })}
                onClose={closeModal}
              />
            );
          })()}
      </Modal>

      <Modal open={modal.kind === "newTheme"} onClose={closeModal}>
        {modal.kind === "newTheme" && (
          <NewThemeDialog
            onCreate={(text) => {
              const id = ulid();
              dispatch({ type: "createTheme", id, text, x: modal.x, y: modal.y });
              closeModal();
              pulse(id);
            }}
          />
        )}
      </Modal>

      <Modal open={modal.kind === "themeSwitch"} onClose={closeModal}>
        {modal.kind === "themeSwitch" &&
          (() => {
            const item = paper.items.find((it) => it.id === modal.itemId);
            if (!item) return null;
            return (
              <ThemeSwitchDialog
                itemText={item.text}
                currentThemeId={item.themeId}
                themes={paper.themes}
                onPick={(newThemeId) => {
                  if (newThemeId !== item.themeId) {
                    dispatch({ type: "switchItemTheme", itemId: item.id, newThemeId });
                  }
                  setModal({ kind: "item", id: item.id });
                }}
              />
            );
          })()}
      </Modal>

      <Modal open={modal.kind === "stacks"} onClose={closeModal}>
        <StacksPanel
          stacks={state.stacks}
          activeStackId={state.activeStackId}
          onSelect={(stackId) => {
            dispatch({ type: "setActiveStack", stackId });
            closeModal();
          }}
          onCreate={(name) => {
            dispatch({ type: "createStack", id: ulid(), name });
            closeModal();
          }}
        />
      </Modal>

      <Modal open={modal.kind === "papers"} onClose={closeModal}>
        <PapersPanel
          stack={stack}
          onSelect={(archiveIndex) => {
            dispatch({ type: "setViewingArchiveIndex", index: archiveIndex });
            closeModal();
          }}
        />
      </Modal>

      <Modal open={modal.kind === "readonly"} onClose={closeModal}>
        {modal.kind === "readonly" &&
          (() => {
            const obj = modal.objKind === "theme" ? paper.themes.find((t) => t.id === modal.id) : paper.items.find((it) => it.id === modal.id);
            if (!obj) return null;
            const theme = modal.objKind === "item" ? paper.themes.find((t) => t.id === (obj as { themeId: string }).themeId) : undefined;
            return <ReadOnlyCard kind={modal.objKind} obj={obj} theme={theme} onClose={closeModal} />;
          })()}
      </Modal>
    </div>
  );
}

export default App;
