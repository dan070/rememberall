import { useState } from "react";
import { fmtDateLong } from "../lib/date";
import type { BubbleState, Theme } from "../lib/types";
import { DateField } from "./DateField";
import { StateToggle } from "./StateToggle";

interface ThemeCardProps {
  theme: Theme;
  onTextChange: (text: string) => void;
  onDateChange: (date: string | null) => void;
  onStateChange: (state: BubbleState) => void;
  onClose: () => void;
}

export function ThemeCard({ theme, onTextChange, onDateChange, onStateChange, onClose }: ThemeCardProps) {
  const [text, setText] = useState(theme.text);

  return (
    <>
      <div className="card-kind">Theme</div>
      <StateToggle state={theme.state} onChange={onStateChange} />
      <input
        type="text"
        className="card-text-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onTextChange(text)}
      />
      {theme.state !== "live" && theme.statusAt && (
        <div className="status-at">
          Marked {theme.state} on {fmtDateLong(theme.statusAt)}
        </div>
      )}
      <DateField date={theme.date} onChange={onDateChange} />
      <div className="future-slot">✳ Start a coaching conversation about this theme (coming soon)</div>
      <div className="card-actions">
        <button className="close" onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}
