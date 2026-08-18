import type { Theme } from "../lib/types";

interface ThemeSwitchDialogProps {
  itemText: string;
  currentThemeId: string;
  themes: Theme[];
  onPick: (themeId: string) => void;
}

export function ThemeSwitchDialog({ itemText, currentThemeId, themes, onPick }: ThemeSwitchDialogProps) {
  return (
    <>
      <h3>Move &quot;{itemText}&quot; to…</h3>
      <div className="chip-list">
        {themes.map((t) => (
          <div key={t.id} className={`chip ${t.id === currentThemeId ? "current" : ""}`} onClick={() => onPick(t.id)}>
            {t.text}
            {t.id === currentThemeId ? " (current)" : ""}
          </div>
        ))}
      </div>
    </>
  );
}
