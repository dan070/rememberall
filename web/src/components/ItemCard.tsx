import { useState } from "react";
import type { BubbleState, Item, Theme } from "../lib/types";
import { DateField } from "./DateField";
import { StateToggle } from "./StateToggle";

interface ItemCardProps {
  item: Item;
  theme: Theme | undefined;
  onTextChange: (text: string) => void;
  onDateChange: (date: string | null) => void;
  onStateChange: (state: BubbleState) => void;
  onSwitchTheme: () => void;
  onAddNote: (text: string) => void;
  onToggleNote: (index: number) => void;
  onClose: () => void;
}

/** The item card's header shows the theme's name in the same muted style
 * "Item" used to sit in — reassigning theme is rare, so it's a small
 * "Switch" link into a separate picker, not an always-visible dropdown. */
export function ItemCard({
  item,
  theme,
  onTextChange,
  onDateChange,
  onStateChange,
  onSwitchTheme,
  onAddNote,
  onToggleNote,
  onClose,
}: ItemCardProps) {
  const [text, setText] = useState(item.text);
  const [noteInput, setNoteInput] = useState("");

  function commitNote() {
    const v = noteInput.trim();
    if (!v) return;
    onAddNote(v);
    setNoteInput("");
  }

  return (
    <>
      <div className="card-kind">
        <span>{theme ? theme.text : "no theme"}</span>
        <span className="switch-link" onClick={onSwitchTheme}>
          Switch
        </span>
      </div>
      <StateToggle state={item.state} onChange={onStateChange} />
      <input
        type="text"
        className="card-text-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onTextChange(text)}
      />
      <DateField date={item.date} onChange={onDateChange} />
      <div id="notesList">
        {item.notes.map((n, idx) => (
          <div key={idx} className={`note ${n.done ? "done" : ""}`} onClick={() => onToggleNote(idx)}>
            <div className="dot" />
            <div className="txt">{n.text}</div>
          </div>
        ))}
        <div className="note-input-row">
          <input
            type="text"
            placeholder="add a note, press Enter…"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitNote();
            }}
          />
        </div>
      </div>
      <div className="card-actions">
        <button className="close" onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}
