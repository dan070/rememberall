import { fmtDateTimeLong } from "../lib/date";
import type { ArchivedPaper, CurrentPaper, Stack } from "../lib/types";
import "./PapersPanel.css";

function isArchived(paper: CurrentPaper | ArchivedPaper): paper is ArchivedPaper {
  return "retiredAt" in paper;
}

interface PapersPanelProps {
  stack: Stack;
  onSelect: (archiveIndex: number | null) => void;
}

/** Lists the active stack's currentPaper plus every archived paper, most
 * recent first — read-only per the archive contract in lib/paper.ts.
 * Picking the current paper's row (or the banner's "back to current"
 * button) is the only way back to editing. */
export function PapersPanel({ stack, onSelect }: PapersPanelProps) {
  const rows = [
    { label: "Current", isCurrent: true, archiveIndex: null as number | null, paper: stack.currentPaper },
    ...stack.archive.map((p, i) => ({ label: "Archived", isCurrent: false, archiveIndex: i, paper: p })),
  ].sort((a, b) => b.paper.paperIndex - a.paper.paperIndex);

  return (
    <>
      <h3>{stack.name} — papers</h3>
      <div className="sub">Archived papers are frozen the moment they're retired — nothing on them can change.</div>
      {rows.map((r) => (
        <div
          key={r.archiveIndex === null ? "current" : r.archiveIndex}
          className={`paper-row ${r.isCurrent ? "current" : ""}`}
          onClick={() => onSelect(r.archiveIndex)}
        >
          <div>
            <div className="pname">Paper #{r.paper.paperIndex}</div>
            <div className="pspan">
              {fmtDateTimeLong(r.paper.createdAt)}
              {isArchived(r.paper) ? ` – ${fmtDateTimeLong(r.paper.retiredAt)}` : " – now"}
            </div>
          </div>
          <div className="ptag">{r.isCurrent ? "current" : "archived"}</div>
        </div>
      ))}
    </>
  );
}
