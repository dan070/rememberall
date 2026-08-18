import { useState } from "react";

interface NewThemeDialogProps {
  onCreate: (text: string) => void;
}

/** Items can only be created via a theme's own "+" button (see
 * QuickAddPopup), so tapping empty paper always means "new theme" — a
 * single text input, Enter (or the button) creates it right there at the
 * tapped spot. No date prompt; due date and everything else is set
 * afterwards by opening the theme. */
export function NewThemeDialog({ onCreate }: NewThemeDialogProps) {
  const [text, setText] = useState("");

  function commit() {
    const v = text.trim();
    if (!v) return;
    onCreate(v);
  }

  return (
    <>
      <h3>New theme</h3>
      <input
        type="text"
        placeholder="type it, then press Enter…"
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
      <button className="create-btn" onClick={commit}>
        Add to paper
      </button>
    </>
  );
}
