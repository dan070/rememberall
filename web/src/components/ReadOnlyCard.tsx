import { fmtDateLong } from "../lib/date";
import type { Item, Theme } from "../lib/types";
import "./ReadOnlyCard.css";

interface ReadOnlyCardProps {
  kind: "theme" | "item";
  obj: Theme | Item;
  theme: Theme | undefined;
  onClose: () => void;
}

/** Opened instead of the editable card when tapping a bubble on an
 * archived paper — same information, no inputs, no way to change state. */
export function ReadOnlyCard({ kind, obj, theme, onClose }: ReadOnlyCardProps) {
  const stateLabel = obj.state === "done" ? "Done" : obj.state === "cancelled" ? "Cancelled" : null;
  const statusAt = "statusAt" in obj ? obj.statusAt : null;
  const notes = "notes" in obj ? obj.notes : [];

  return (
    <>
      {kind === "item" && theme && <div className="ro-meta">{theme.text}</div>}
      <h3>{obj.text}</h3>
      {obj.date && <div className="ro-meta">Due {fmtDateLong(obj.date)}</div>}
      {stateLabel && (
        <div className={`ro-state ${obj.state}`}>
          {stateLabel}
          {statusAt ? ` — ${fmtDateLong(statusAt)}` : ""}
        </div>
      )}
      {kind === "item" &&
        notes.map((n, idx) => (
          <div key={idx} className={`ro-note ${n.done ? "done" : ""}`}>
            <div className="dot" />
            <div>{n.text}</div>
          </div>
        ))}
      <div className="card-actions">
        <button className="close" onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}
