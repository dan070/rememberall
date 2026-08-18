import { useCallback, useEffect, useRef, useState } from "react";
import { CANVAS_H, CANVAS_W } from "./layout";

const MIN_SCALE = 0.3;
const MAX_SCALE = 1.6;
// A finger's contact patch jitters far more than a mouse click — the
// wireframe's 3px tap/drag threshold misfired real taps as drags on a
// phone. 10px is comfortably past normal touch jitter without feeling
// laggy for an intentional drag.
const DRAG_THRESHOLD = 10;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

interface Transform {
  scale: number;
  panX: number;
  panY: number;
}

/** Pan/zoom over a fixed-size logical canvas, driven by mouse wheel, a
 * mouse/touch drag, AND real two-finger pinch (the wireframe only handled
 * wheel — pinch did nothing on a phone since touch-action:none disables
 * the browser's native pinch and nothing replaced it here). Also computes
 * an initial "fit the whole paper" transform from the actual viewport
 * size, instead of the wireframe's hardcoded scale/pan constants which
 * didn't adapt across phone screen sizes. */
export function usePanZoom(viewportRef: React.RefObject<HTMLDivElement | null>) {
  const [transform, setTransform] = useState<Transform>({ scale: 0.62, panX: -40, panY: -20 });
  const [isPanning, setIsPanning] = useState(false);
  const draggedRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  // Active pointers by pointerId, for pinch-detection (exactly 2 = pinch).
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; midX: number; midY: number; scale: number; panX: number; panY: number } | null>(null);

  const fitToViewport = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const scale = clamp(Math.min(vw / CANVAS_W, vh / CANVAS_H) * 1.05, MIN_SCALE, MAX_SCALE);
    const panX = (vw - CANVAS_W * scale) / 2;
    const panY = (vh - CANVAS_H * scale) / 2;
    setTransform({ scale, panX, panY });
  }, [viewportRef]);

  useEffect(() => {
    fitToViewport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, newScale: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      setTransform((prev) => {
        const cx = (mx - prev.panX) / prev.scale;
        const cy = (my - prev.panY) / prev.scale;
        const scale = clamp(newScale, MIN_SCALE, MAX_SCALE);
        return { scale, panX: mx - cx * scale, panY: my - cy * scale };
      });
    },
    [viewportRef],
  );

  const zoomAtCenter = useCallback(
    (newScale: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, newScale);
    },
    [viewportRef, zoomAt],
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      setTransform((prev) => {
        pinchStartRef.current = {
          dist,
          midX: (a.x + b.x) / 2,
          midY: (a.y + b.y) / 2,
          scale: prev.scale,
          panX: prev.panX,
          panY: prev.panY,
        };
        return prev;
      });
      setIsPanning(false);
      panStartRef.current = null;
    } else if (pointersRef.current.size === 1) {
      setIsPanning(true);
      draggedRef.current = false;
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: transform.panX, panY: transform.panY };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transform.panX, transform.panY]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 2 && pinchStartRef.current) {
        const [a, b] = [...pointersRef.current.values()];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const start = pinchStartRef.current;
        const nextScale = clamp((start.scale * dist) / start.dist, MIN_SCALE, MAX_SCALE);
        const el = viewportRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const mx = start.midX - rect.left;
          const my = start.midY - rect.top;
          const cx = (mx - start.panX) / start.scale;
          const cy = (my - start.panY) / start.scale;
          setTransform({ scale: nextScale, panX: mx - cx * nextScale, panY: my - cy * nextScale });
        }
        return;
      }

      if (!isPanning || !panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) draggedRef.current = true;
      setTransform((prev) => ({ ...prev, panX: panStartRef.current!.panX + dx, panY: panStartRef.current!.panY + dy }));
    },
    [isPanning, viewportRef],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
    if (pointersRef.current.size === 0) {
      setIsPanning(false);
      panStartRef.current = null;
      // Deferred so the click handler that fires right after pointerup can
      // still read the flag before it resets.
      setTimeout(() => (draggedRef.current = false), 0);
    }
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      // 0.0013 — the wireframe's 0.001 rate increased 30% per feedback.
      zoomAt(e.clientX, e.clientY, transform.scale - e.deltaY * 0.0013);
    },
    [transform.scale, zoomAt],
  );

  return {
    transform,
    isPanning,
    wasDragged: () => draggedRef.current,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onWheel },
    zoomAtCenter,
    fitToViewport,
  };
}
