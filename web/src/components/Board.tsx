import { useRef } from "react";
import { usePanZoom } from "../lib/usePanZoom";
import { CANVAS_H, CANVAS_W } from "../lib/layout";
import type { CurrentPaper } from "../lib/types";
import { Bubble } from "./Bubble";
import "./Board.css";

interface BoardProps {
  paper: CurrentPaper;
  readOnly: boolean;
  pulseId: string | null;
  onOpenTheme: (id: string) => void;
  onOpenItem: (id: string) => void;
  onAddItemToTheme: (themeId: string, anchorEl: HTMLElement) => void;
  onTapEmpty: (canvasX: number, canvasY: number) => void;
}

export interface BoardControls {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

export function Board({ paper, readOnly, pulseId, onOpenTheme, onOpenItem, onAddItemToTheme, onTapEmpty }: BoardProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { transform, isPanning, wasDragged, handlers, zoomAtCenter, fitToViewport } = usePanZoom(viewportRef);

  function handleCanvasClick(e: React.MouseEvent) {
    if (wasDragged()) return;
    if (readOnly) return; // archived paper: pan/zoom to look, but nothing new can be added
    if ((e.target as HTMLElement).closest(".bubble")) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    onTapEmpty((e.clientX - rect.left) / transform.scale, (e.clientY - rect.top) / transform.scale);
  }

  return (
    <>
      <div
        ref={viewportRef}
        id="viewport"
        className={[isPanning ? "panning" : "", readOnly ? "has-banner" : ""].filter(Boolean).join(" ")}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerUp}
        onWheel={handlers.onWheel}
        onClick={handleCanvasClick}
      >
        <div
          ref={canvasRef}
          id="canvas"
          className={readOnly ? "readonly" : ""}
          style={{ transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.scale})` }}
        >
          <svg id="lines" width={CANVAS_W} height={CANVAS_H}>
            {paper.items.map((it) => {
              const theme = paper.themes.find((t) => t.id === it.themeId);
              if (!theme) return null;
              return (
                <line
                  key={it.id}
                  x1={theme.x}
                  y1={theme.y}
                  x2={it.x}
                  y2={it.y}
                  className={it.state !== "live" ? "done-line" : ""}
                />
              );
            })}
          </svg>

          {paper.themes.map((t) => (
            <Bubble
              key={t.id}
              kind="theme"
              obj={t}
              readOnly={readOnly}
              pulsing={t.id === pulseId}
              onOpen={() => onOpenTheme(t.id)}
              onAddItem={(anchorEl) => onAddItemToTheme(t.id, anchorEl)}
            />
          ))}
          {paper.items.map((it) => (
            <Bubble key={it.id} kind="item" obj={it} readOnly={readOnly} pulsing={it.id === pulseId} onOpen={() => onOpenItem(it.id)} />
          ))}
        </div>
      </div>

      <div id="zoomctl">
        <button onClick={() => zoomAtCenter(transform.scale + 0.195)} aria-label="Zoom in">
          +
        </button>
        <button onClick={() => zoomAtCenter(transform.scale - 0.195)} aria-label="Zoom out">
          −
        </button>
        <button onClick={fitToViewport} aria-label="Fit to screen" title="fit">
          ⤢
        </button>
      </div>

      {!readOnly && <div id="hint">Tap empty space to add · pinch/scroll to zoom · drag to pan</div>}
    </>
  );
}
