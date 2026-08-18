import { useEffect, useRef, useState } from "react";
import "./QuickAddPopup.css";

interface QuickAddPopupProps {
  anchorEl: HTMLElement;
  onCommit: (text: string) => void;
  onDismiss: () => void;
}

/** Floating input opened from a theme's "+" button — type, press Enter,
 * an item is created under that theme with no extra dialog. Position is
 * computed once from the anchor's screen rect and clamped so it never
 * runs off the right/bottom edge. */
export function QuickAddPopup({ anchorEl, onCommit, onDismiss }: QuickAddPopupProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden" });

  useEffect(() => {
    const rect = anchorEl.getBoundingClientRect();
    const popW = 210;
    const popH = 44;
    let left = rect.right + 8;
    let top = rect.top - 6;
    if (left + popW > window.innerWidth) left = rect.left - popW - 8;
    if (top + popH > window.innerHeight) top = window.innerHeight - popH - 8;
    setStyle({ left: Math.max(6, left), top: Math.max(6, top) });
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onDismiss();
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [onDismiss]);

  function commit() {
    const v = text.trim();
    if (v) onCommit(v);
    else onDismiss();
  }

  return (
    <div id="quickAdd" ref={popupRef} style={style}>
      <input
        ref={inputRef}
        type="text"
        placeholder="new item, press Enter…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onDismiss();
        }}
      />
    </div>
  );
}
