import { useState } from "react";
import { relTime } from "../lib/date";
import type { Stack } from "../lib/types";
import "./StacksPanel.css";

interface StacksPanelProps {
  stacks: Stack[];
  activeStackId: string;
  onSelect: (stackId: string) => void;
  onCreate: (name: string) => void;
  onResetLocalData: () => void;
}

/** Lists stacks sorted by lastInteractionAt (adding/changing something —
 * never just viewing), fading progressively; anything past the top 5
 * collapses behind an "older stacks" toggle so a long-neglected stack
 * naturally drops out of sight without being deleted. */
export function StacksPanel({ stacks, activeStackId, onSelect, onCreate, onResetLocalData }: StacksPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState("");

  const sorted = [...stacks].sort((a, b) => new Date(b.lastInteractionAt).getTime() - new Date(a.lastInteractionAt).getTime());
  const visibleCount = 5;
  const visible = sorted.slice(0, visibleCount);
  const older = sorted.slice(visibleCount);
  const shown = expanded ? sorted : visible;

  function row(s: Stack, rank: number) {
    const fade = Math.max(0.45, 1 - rank * 0.09);
    return (
      <div
        key={s.id}
        className={`stack-row ${s.id === activeStackId ? "active" : ""}`}
        style={{ opacity: fade }}
        onClick={() => onSelect(s.id)}
      >
        <div>
          <div className="sname">{s.name}</div>
          <div className="spaper">Paper #{s.currentPaper.paperIndex}</div>
        </div>
        <div className="stouch">
          touched
          <br />
          {relTime(s.lastInteractionAt)}
        </div>
      </div>
    );
  }

  return (
    <>
      <h3>Stacks</h3>
      <div className="new-stack-row">
        <input type="text" placeholder="new stack name, e.g. Renovation" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button
          onClick={() => {
            const v = newName.trim();
            if (!v) return;
            onCreate(v);
            setNewName("");
          }}
        >
          Create
        </button>
      </div>
      {shown.map((s, i) => row(s, i))}
      {older.length > 0 && (
        <div className="older-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "▴ hide older stacks" : `▾ ${older.length} older stack(s)`}
        </div>
      )}
      <div
        className="reset-local-data"
        onClick={() => {
          const ok = window.confirm(
            "Reset local data on this device?\n\n" +
              "This clears everything stored locally (stacks, outbox, sync cursor) and reloads. " +
              "Nothing on the server is touched — a fresh sync repopulates from there.\n\n" +
              "Only do this if the local copy on this device seems stuck or wrong.",
          );
          if (ok) onResetLocalData();
        }}
      >
        Reset local data on this device
      </div>
    </>
  );
}
