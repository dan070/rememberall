import { fmtDateTimeLong } from "../lib/date";
import type { CurrentPaper } from "../lib/types";
import { SyncStatus, type SyncState } from "./SyncStatus";
import "./TopBar.css";

interface TopBarProps {
  stackName: string;
  paper: CurrentPaper;
  readOnly: boolean;
  isMobile: boolean;
  syncStatus: SyncState;
  lastSyncedAt: number | null;
  onOpenStacks: () => void;
  onOpenPapers: () => void;
  onRearrange: () => void;
  onNewPaper: () => void;
  onRetrySync: () => void;
}

export function TopBar({
  stackName,
  paper,
  readOnly,
  isMobile,
  syncStatus,
  lastSyncedAt,
  onOpenStacks,
  onOpenPapers,
  onRearrange,
  onNewPaper,
  onRetrySync,
}: TopBarProps) {
  return (
    <div id="topbar">
      <div className="stackinfo" onClick={onOpenStacks}>
        <span className="title">{stackName}</span>
        <span className="paperno">Paper #{paper.paperIndex}</span>
      </div>
      <div className="btns">
        <button onClick={onOpenStacks}>Stacks ▾</button>
        <button onClick={onOpenPapers}>Papers ▾</button>
        {/* Rearrange nudges overlapping canvas bubbles apart — meaningless
            once there's no canvas, so it's board-only. */}
        {!readOnly && !isMobile && (
          <button onClick={onRearrange} title="Nudge overlapping bubbles apart">
            Rearrange ⤨
          </button>
        )}
        {!readOnly && <button onClick={onNewPaper}>New paper →</button>}
      </div>
      <div className="meta">
        <span>{readOnly ? `archived — ${fmtDateTimeLong(paper.createdAt)}` : `started ${fmtDateTimeLong(paper.createdAt)}`}</span>
        <SyncStatus status={syncStatus} lastSyncedAt={lastSyncedAt} onRetry={onRetrySync} />
      </div>
    </div>
  );
}
