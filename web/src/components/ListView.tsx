import { useState } from "react";
import { fmtDateShort } from "../lib/date";
import { summarizeDensity } from "../lib/density";
import type { CurrentPaper, Item, Theme } from "../lib/types";
import "./ListView.css";

interface ListViewProps {
  paper: CurrentPaper;
  readOnly: boolean;
  onOpenTheme: (id: string) => void;
  onOpenItem: (id: string) => void;
  onToggleItemDone: (id: string) => void;
  onAddItemToTheme: (themeId: string, text: string) => void;
  onCreateTheme: (text: string) => void;
}

/** Phone-sized replacement for the pan/zoom canvas board. A canvas fights
 * iOS for pinch-gesture ownership in a way that a plain scrollable list
 * never has to (see the App.css note on the iOS pinch-zoom hang this
 * shipped alongside) — this trades the board's spatial "glance at how
 * cramped it looks" signal for a lightweight density header plus native,
 * one-thumb scrolling. Desktop keeps the full canvas (see Board.tsx);
 * both render the exact same underlying paper/reducer, just differently. */
export function ListView({ paper, readOnly, onOpenTheme, onOpenItem, onToggleItemDone, onAddItemToTheme, onCreateTheme }: ListViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addingItemText, setAddingItemText] = useState("");
  const [newThemeOpen, setNewThemeOpen] = useState(false);
  const [newThemeText, setNewThemeText] = useState("");

  const density = summarizeDensity(paper);

  function toggle(themeId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(themeId)) next.delete(themeId);
      else next.add(themeId);
      return next;
    });
  }

  function itemsFor(theme: Theme): Item[] {
    return paper.items.filter((it) => it.themeId === theme.id);
  }

  function commitAddItem(themeId: string) {
    const text = addingItemText.trim();
    if (text) onAddItemToTheme(themeId, text);
    setAddingItemText("");
    setAddingTo(null);
  }

  function commitNewTheme() {
    const text = newThemeText.trim();
    if (text) onCreateTheme(text);
    setNewThemeText("");
    setNewThemeOpen(false);
  }

  return (
    <div id="listview" className={readOnly ? "has-banner" : ""}>
      <div className="density-bar">
        <div className="density-fill" style={{ width: `${Math.round(density.openFraction * 100)}%` }} />
        <div className="density-text">
          {density.openCount} open · {density.doneCount} done{density.cancelledCount > 0 ? ` · ${density.cancelledCount} cancelled` : ""}
        </div>
      </div>

      <div className="theme-list">
        {paper.themes.map((theme) => {
          const items = itemsFor(theme);
          const openItems = items.filter((it) => it.state === "live").length;
          const isOpen = expanded.has(theme.id);
          return (
            <div key={theme.id} className={`theme-row-wrap state-${theme.state}`}>
              <div className="theme-row" onClick={() => toggle(theme.id)}>
                <span className="chevron">{isOpen ? "▾" : "▸"}</span>
                <span className="theme-name">{theme.text}</span>
                {theme.date && <span className="theme-date">{fmtDateShort(theme.date)}</span>}
                <span className="theme-count">{openItems > 0 ? `${openItems} open` : items.length === 0 ? "empty" : "all done"}</span>
                <span
                  className="theme-edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTheme(theme.id);
                  }}
                >
                  ⚙
                </span>
              </div>

              {isOpen && (
                <div className="item-list">
                  {items.map((item) => (
                    <div key={item.id} className={`item-row state-${item.state}`}>
                      {!readOnly ? (
                        <div className="item-checkbox" onClick={() => onToggleItemDone(item.id)}>
                          {item.state === "done" ? "☑" : item.state === "cancelled" ? "✕" : "☐"}
                        </div>
                      ) : (
                        <div className="item-checkbox readonly">{item.state === "done" ? "☑" : item.state === "cancelled" ? "✕" : "☐"}</div>
                      )}
                      <div className="item-text" onClick={() => onOpenItem(item.id)}>
                        {item.text}
                      </div>
                      {item.date && <div className="item-date">{fmtDateShort(item.date)}</div>}
                    </div>
                  ))}

                  {!readOnly &&
                    (addingTo === theme.id ? (
                      <div className="item-add-row">
                        <input
                          type="text"
                          autoFocus
                          placeholder="new item, press Enter…"
                          value={addingItemText}
                          onChange={(e) => setAddingItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitAddItem(theme.id);
                            if (e.key === "Escape") {
                              setAddingItemText("");
                              setAddingTo(null);
                            }
                          }}
                          onBlur={() => commitAddItem(theme.id)}
                        />
                      </div>
                    ) : (
                      <div className="item-add-trigger" onClick={() => setAddingTo(theme.id)}>
                        + add item
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly &&
        (newThemeOpen ? (
          <div className="new-theme-row">
            <input
              type="text"
              autoFocus
              placeholder="new theme, press Enter…"
              value={newThemeText}
              onChange={(e) => setNewThemeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNewTheme();
                if (e.key === "Escape") {
                  setNewThemeText("");
                  setNewThemeOpen(false);
                }
              }}
              onBlur={commitNewTheme}
            />
          </div>
        ) : (
          <button className="new-theme-trigger" onClick={() => setNewThemeOpen(true)}>
            + New theme
          </button>
        ))}
    </div>
  );
}
