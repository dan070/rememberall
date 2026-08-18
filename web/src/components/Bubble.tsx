import { useMemo } from "react";
import { fingerprint, fontSizeFor } from "../lib/fingerprint";
import { fmtDateShort } from "../lib/date";
import { ITEM_H, ITEM_W, THEME_H, THEME_W } from "../lib/layout";
import type { Item, Theme } from "../lib/types";
import "./Bubble.css";

interface ThemeBubbleProps {
  kind: "theme";
  obj: Theme;
  readOnly: boolean;
  pulsing: boolean;
  onOpen: () => void;
  onAddItem: (anchorEl: HTMLElement) => void;
}

interface ItemBubbleProps {
  kind: "item";
  obj: Item;
  readOnly: boolean;
  pulsing: boolean;
  onOpen: () => void;
}

type BubbleProps = ThemeBubbleProps | ItemBubbleProps;

/** Renders one theme or item bubble. Position/size/rotation are applied as
 * inline styles (not CSS classes) since they're per-instance and derived
 * from live layout state (declutter()) or a deterministic per-id
 * fingerprint — see lib/fingerprint.ts for why no two bubbles look quite
 * alike despite sharing one component. */
export function Bubble(props: BubbleProps) {
  const { obj, readOnly, pulsing, onOpen } = props;
  const kind = props.kind;
  const fp = useMemo(() => fingerprint(obj.id, kind), [obj.id, kind]);
  const w = kind === "theme" ? THEME_W : ITEM_W;
  const h = kind === "theme" ? THEME_H : ITEM_H;
  const fontSize = fontSizeFor(kind, obj.text);

  const style: React.CSSProperties = {
    left: obj.x - w / 2,
    top: obj.y - h / 2,
    width: w,
    height: h,
    borderRadius: `${fp.br[0]}px ${fp.br[1]}px ${fp.br[2]}px ${fp.br[3]}px`,
    borderWidth: fp.borderW.toFixed(1) + "px",
    borderColor: `rgba(38,34,32,${fp.inkAlpha.toFixed(2)})`,
    transform: `rotate(${fp.rot.toFixed(1)}deg) scale(${fp.scale.toFixed(2)})`,
    fontSize,
  };

  const classes = ["bubble", kind, `state-${obj.state}`, pulsing ? "pulse-in" : ""].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <div className="txt">{obj.text}</div>
      {kind === "theme" && obj.date && <div className="theme-date">{fmtDateShort(obj.date)}</div>}
      {kind === "item" && obj.date && <div className="date-tag">{fmtDateShort(obj.date)}</div>}
      {kind === "theme" && !readOnly && (
        <div
          className="theme-add-btn"
          title="Add item to this theme"
          onClick={(e) => {
            e.stopPropagation();
            props.onAddItem(e.currentTarget);
          }}
        >
          +
        </div>
      )}
      {obj.state === "cancelled" && (
        <div className="x-mark">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="12" y1="12" x2="88" y2="88" />
            <line x1="88" y1="12" x2="12" y2="88" />
          </svg>
        </div>
      )}
    </div>
  );
}
