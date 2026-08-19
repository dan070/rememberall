import { useEffect, useState } from "react";

// Matches the breakpoint the rest of the app already uses for modals
// (bottom-sheet below 700px, centered dialog above) — see Modal.css.
const QUERY = "(max-width: 699px)";

/** True on phone-sized/touch-primary screens. Drives the split between
 * the desktop pan/zoom canvas (Board) and the phone list view (ListView)
 * — a canvas fights iOS for pinch-gesture ownership in a way a plain
 * scrollable list never has to. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
