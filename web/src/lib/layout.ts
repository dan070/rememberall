// Ported from wireframe/board.html's collision solver — a minimal-movement
// rectangle-separation pass so themes/items never overlap, keeping themes
// as the anchors (they only ever move against each other) while items
// always yield to whatever they're near.

export const CANVAS_W = 1600;
export const CANVAS_H = 2000;
export const THEME_W = 118;
export const THEME_H = 98;
export const ITEM_W = 74;
export const ITEM_H = 74;
const THEME_THEME_PAD = 52;
const THEME_ITEM_PAD = 30;
const ITEM_ITEM_PAD = 18;

export interface Positioned {
  x: number;
  y: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function separate(
  a: Positioned,
  aw: number,
  ah: number,
  b: Positioned,
  bw: number,
  bh: number,
  pad: number,
  moveA: boolean,
  moveB: boolean,
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minX = (aw + bw) / 2 + pad;
  const minY = (ah + bh) / 2 + pad;
  const overlapX = minX - Math.abs(dx);
  const overlapY = minY - Math.abs(dy);
  if (overlapX <= 0 || overlapY <= 0) return false;

  let shiftX = 0;
  let shiftY = 0;
  if (overlapX < overlapY) {
    const sign = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
    shiftX = overlapX * sign;
  } else {
    const sign = dy === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dy);
    shiftY = overlapY * sign;
  }
  const fracA = moveA ? (moveB ? 0.5 : 1) : 0;
  const fracB = moveB ? (moveA ? 0.5 : 1) : 0;
  if (moveA) {
    a.x -= shiftX * fracA;
    a.y -= shiftY * fracA;
  }
  if (moveB) {
    b.x += shiftX * fracB;
    b.y += shiftY * fracB;
  }
  return true;
}

/** Keeps themes apart from each other (dragging their own items along on
 * any shift), then pushes items off themes and off each other. Call after
 * every structural change. `jitter`, if given, nudges everything by a
 * small random amount first — used by the manual "Rearrange" action to
 * give a locally-stable-but-cramped layout room to actually spread out. */
export function declutter<T extends Positioned & { id: string }, I extends Positioned & { themeId: string }>(
  themes: T[],
  items: I[],
  jitter?: number,
): void {
  if (jitter) {
    themes.forEach((t) => {
      t.x += (Math.random() * 2 - 1) * jitter;
      t.y += (Math.random() * 2 - 1) * jitter;
    });
    items.forEach((it) => {
      it.x += (Math.random() * 2 - 1) * jitter;
      it.y += (Math.random() * 2 - 1) * jitter;
    });
  }

  const before = new Map(themes.map((t) => [t.id, { x: t.x, y: t.y }]));

  for (let iter = 0; iter < 60; iter++) {
    let moved = false;
    for (let i = 0; i < themes.length; i++) {
      for (let j = i + 1; j < themes.length; j++) {
        if (separate(themes[i], THEME_W, THEME_H, themes[j], THEME_W, THEME_H, THEME_THEME_PAD, true, true)) {
          moved = true;
        }
      }
    }
    themes.forEach((t) => {
      t.x = clamp(t.x, THEME_W / 2 + 20, CANVAS_W - THEME_W / 2 - 20);
      t.y = clamp(t.y, THEME_H / 2 + 20, CANVAS_H - THEME_H / 2 - 20);
    });
    if (!moved) break;
  }

  themes.forEach((t) => {
    const b = before.get(t.id);
    if (!b) return;
    const dx = t.x - b.x;
    const dy = t.y - b.y;
    if (dx || dy) {
      items.filter((it) => it.themeId === t.id).forEach((it) => {
        it.x += dx;
        it.y += dy;
      });
    }
  });

  for (let iter = 0; iter < 150; iter++) {
    let moved = false;
    for (const it of items) {
      for (const t of themes) {
        if (separate(it, ITEM_W, ITEM_H, t, THEME_W, THEME_H, THEME_ITEM_PAD, true, false)) moved = true;
      }
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (separate(items[i], ITEM_W, ITEM_H, items[j], ITEM_W, ITEM_H, ITEM_ITEM_PAD, true, true)) moved = true;
      }
    }
    items.forEach((it) => {
      it.x = clamp(it.x, ITEM_W / 2 + 10, CANVAS_W - ITEM_W / 2 - 10);
      it.y = clamp(it.y, ITEM_H / 2 + 10, CANVAS_H - ITEM_H / 2 - 10);
    });
    if (!moved) break;
  }
}

/** Initial guess near a theme — declutter() does the real work of
 * guaranteeing no overlap; this just biases the starting direction. */
export function placeNearTheme(theme: Positioned): Positioned {
  const angle = Math.random() * Math.PI * 2;
  const r = (THEME_W + ITEM_W) / 2 + THEME_ITEM_PAD + Math.random() * 30;
  return {
    x: clamp(theme.x + Math.cos(angle) * r, ITEM_W / 2 + 10, CANVAS_W - ITEM_W / 2 - 10),
    y: clamp(theme.y + Math.sin(angle) * r, ITEM_H / 2 + 10, CANVAS_H - ITEM_H / 2 - 10),
  };
}
