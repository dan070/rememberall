import { useCallback, useEffect, useReducer, useRef, useState } from "react";
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
import { API_URL } from "./lib/config";
import { clearAllLocalData, enqueueOp, getAllStacks, getMeta, putStacks, setMeta } from "./lib/db";
import { makePutStackOp } from "./lib/outbox";
import { useIsMobile } from "./lib/useIsMobile";
import { activePaper, activeStack, isReadOnly, reducer, type AppState } from "./lib/reducer";
import { seedStacks } from "./lib/seed";
import { summarizeRetirement } from "./lib/paper";
import { getAuthToken, pullSync, runSync, setAuthToken } from "./lib/sync";
import "./App.css";

const SYNC_INTERVAL_MS = 15_000;

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
  const tokenRef = useRef<string | undefined>(undefined);
  // Visible sync state — the earlier version of this failed completely
  // silently (a misconfigured gate meant sync() always returned before
  // attempting a request, in exactly the deployed environment where it
  // needed to run), with nothing in the UI to say so. This is what makes
  // that class of failure visible without reading Lambda logs.
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error" | "no-token">("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  // Tracks which Stack object each stack id last pointed to, so an outbox
  // op is enqueued only for stacks whose reference actually changed since
  // the previous render — reducer.ts's withStack() always returns a new
  // object for a touched stack (and only that stack), so identity is a
  // reliable, cheap "did this change" signal without diffing every field.
  const lastStackRefs = useRef<Map<string, object>>(new Map());
  // hydrate (initial load AND every post-sync pull) replaces the whole
  // stacks array wholesale, which would otherwise look identical to "every
  // stack just got edited" to the ref-diff below — re-enqueueing an outbox
  // op for every stack and re-triggering sync after every sync completes,
  // looping forever. Set right before any hydrate dispatch; the persist
  // effect below consumes and clears it.
  const suppressNextDiffRef = useRef(false);

  const sync = useCallback(async () => {
    const token = tokenRef.current;
    // Gated on the token alone, NOT on API_URL — API_URL is "" in
    // production on purpose (same-origin relative /api/... paths through
    // CloudFront; see lib/config.ts), so `!API_URL` was true in exactly
    // the deployed environment where sync was supposed to run. That bug
    // meant sync() always returned before ever attempting a request —
    // completely silently, with no error, no failed fetch, nothing to see
    // in a network tab. See setSyncStatus below for the visible indicator
    // that should make this class of failure obvious next time.
    if (!token) {
      setSyncStatus("no-token");
      return;
    }
    setSyncStatus("syncing");
    try {
      await runSync(API_URL, token);
      const stacks = await getAllStacks();
      suppressNextDiffRef.current = true;
      // Deliberately not "hydrate" — see reducer.ts's mergeStacksFromSync
      // doc comment for why restating activeStackId/viewingArchiveIndex
      // from a closure here would go stale.
      dispatch({ type: "mergeStacksFromSync", stacks });
      setSyncStatus("idle");
      setLastSyncedAt(Date.now());
    } catch (err) {
      // Sync failures are expected offline — the outbox/cursor persist
      // locally and retry on the next trigger. Never surface this as a
      // blocking error; the local write already succeeded.
      console.error("sync failed", err);
      setSyncStatus("error");
    }
  }, []);

  // Initial load: read persisted stacks. Resolve the token and try a
  // server pull BEFORE ever seeding — a brand-new device (empty local
  // IndexedDB) otherwise can't tell "first run, nothing exists anywhere"
  // apart from "this device just hasn't synced yet, and the server
  // already has real data" — seeding blindly in the second case creates
  // fake local stacks whose outbox writes can then race the pull and
  // overwrite whatever the server actually had.
  useEffect(() => {
    (async () => {
      let stacks = await getAllStacks();

      let token = await getAuthToken();
      if (!token) {
        const entered = window.prompt("Enter your access token:");
        if (entered) {
          await setAuthToken(entered);
          token = entered;
        }
      }
      tokenRef.current = token;

      if (stacks.length === 0 && token) {
        try {
          const pulled = await pullSync(API_URL, token);
          if (pulled.length > 0) stacks = await getAllStacks();
        } catch (err) {
          console.error("initial pull failed", err);
        }
      }

      suppressNextDiffRef.current = true;
      if (stacks.length > 0) {
        const activeStackId = (await getMeta<string>("activeStackId")) ?? stacks[0].id;
        dispatch({ type: "hydrate", stacks, activeStackId, viewingArchiveIndex: null });
      } else {
        // Genuinely nothing anywhere (server included, or unreachable/no
        // token) — this is the actual first-run case.
        stacks = seedStacks();
        await putStacks(stacks);
        dispatch({ type: "hydrate", stacks, activeStackId: stacks[0].id, viewingArchiveIndex: null });
      }
      setLoaded(true);

      // Backfill: any stack with no `updatedAt` has never reached the
      // server (it predates this sync code, was just seeded, or was
      // created offline before a token existed). The reference-diff in
      // the persist effect below only fires on a NEW edit, so without
      // this, pre-existing local data would sit invisible to sync forever
      // unless the user happened to touch it again.
      for (const s of stacks.filter((s) => s.updatedAt === undefined)) {
        await enqueueOp(makePutStackOp(s, ulid(), Date.now()));
      }

      void sync();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fires while the tab is open, on regaining connectivity, and on
  // becoming visible again — iOS Safari has no Background Sync API, so
  // the outbox flush has to be driven by the page itself.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void sync();
    }
    function onOnline() {
      void sync();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    const interval = window.setInterval(() => void sync(), SYNC_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
    };
  }, [sync]);

  // Persist on every change, once initial hydration has happened — avoids
  // an initial empty-state write racing the load above. Also enqueues an
  // outbox op for any stack whose object reference changed since the last
  // render (a real local edit), then kicks a sync — mirrors the local-
  // write-first, sync-after pattern the rest of the app already uses.
  useEffect(() => {
    if (!loaded) return;
    void putStacks(state.stacks);
    void setMeta("activeStackId", state.activeStackId);

    const suppressed = suppressNextDiffRef.current;
    suppressNextDiffRef.current = false;

    let changed = false;
    if (!suppressed) {
      for (const stack of state.stacks) {
        if (lastStackRefs.current.get(stack.id) !== stack) {
          changed = true;
          void enqueueOp(makePutStackOp(stack, ulid(), Date.now()));
        }
      }
    }
    lastStackRefs.current = new Map(state.stacks.map((s) => [s.id, s]));
    if (changed) void sync();
  }, [loaded, state.stacks, state.activeStackId, sync]);

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

  async function retrySync() {
    if (!tokenRef.current) {
      const entered = window.prompt("Enter your access token:");
      if (!entered) return;
      await setAuthToken(entered);
      tokenRef.current = entered;
    }
    void sync();
  }

  return (
    <div className="app">
      <TopBar
        stackName={stack.name}
        paper={paper}
        readOnly={readOnly}
        isMobile={isMobile}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onOpenStacks={() => setModal({ kind: "stacks" })}
        onOpenPapers={() => setModal({ kind: "papers" })}
        onRearrange={() => dispatch({ type: "rearrange" })}
        onRetrySync={() => void retrySync()}
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
          onResetLocalData={() => {
            void clearAllLocalData().then(() => window.location.reload());
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
