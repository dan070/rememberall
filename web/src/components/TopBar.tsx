import { fmtDateTimeLong } from "../lib/date";
import type { CurrentPaper } from "../lib/types";
import "./TopBar.css";

interface TopBarProps {
  stackName: string;
  paper: CurrentPaper;
  readOnly: boolean;
  onOpenStacks: () => void;
  onOpenPapers: () => void;
  onRearrange: () => void;
  onNewPaper: () => void;
}

export function TopBar({ stackName, paper, readOnly, onOpenStacks, onOpenPapers, onRearrange, onNewPaper }: TopBarProps) {
  return (
    <div id="topbar">
      <div className="stackinfo" onClick={onOpenStacks}>
        <span className="title">{stackName}</span>
        <span className="paperno">Paper #{paper.paperIndex}</span>
      </div>
      <div className="btns">
        <button onClick={onOpenStacks}>Stacks ▾</button>
        <button onClick={onOpenPapers}>Papers ▾</button>
        {!readOnly && (
          <button onClick={onRearrange} title="Nudge overlapping bubbles apart">
            Rearrange ⤨
          </button>
        )}
        {!readOnly && <button onClick={onNewPaper}>New paper →</button>}
      </div>
      <div className="meta">
        {readOnly ? `archived — ${fmtDateTimeLong(paper.createdAt)}` : `started ${fmtDateTimeLong(paper.createdAt)}`}
      </div>
    </div>
  );
}
