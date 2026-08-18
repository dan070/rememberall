// Ported from wireframe/board.html — a small hand-drawn-feeling identity
// (tilt, corner wobble, ink weight) derived from a bubble's own id, fixed
// at creation, stable forever. This is what makes each square visually
// distinct without relying on color (the paper original is black-and-white).

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return function () {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Fingerprint {
  rot: number;
  br: [number, number, number, number];
  scale: number;
  inkAlpha: number;
  borderW: number;
}

export function fingerprint(id: string, kind: "theme" | "item"): Fingerprint {
  const rng = mulberry32(hashStr(id));
  const rotRange = kind === "theme" ? 5 : 8;
  const rot = (rng() * 2 - 1) * rotRange;
  const brBase = kind === "theme" ? 16 : 10;
  const brSpread = kind === "theme" ? 20 : 16;
  const br = [0, 1, 2, 3].map(() => Math.round(brBase + rng() * brSpread)) as Fingerprint["br"];
  const scaleMin = kind === "theme" ? 0.95 : 0.9;
  const scaleSpread = kind === "theme" ? 0.13 : 0.22;
  const scale = scaleMin + rng() * scaleSpread;
  const inkAlpha = 0.72 + rng() * 0.28;
  const borderW = kind === "theme" ? 2.6 + rng() * 0.8 : 1.3 + rng() * 0.6;
  return { rot, br, scale, inkAlpha, borderW };
}

/** Longer text gets a smaller font instead of spilling past the fixed box
 * — the box size never changes, only how densely the label packs. */
export function fontSizeFor(kind: "theme" | "item", text: string): number {
  const base = kind === "theme" ? 13.5 : 12;
  const len = text.length;
  if (len <= 10) return base;
  const shrink = Math.min(4.5, (len - 10) * 0.18);
  return Math.max(kind === "theme" ? 9.5 : 8.5, base - shrink);
}
