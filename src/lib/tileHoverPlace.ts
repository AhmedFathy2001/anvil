// Where a board tile's hover card goes. Above or below the tile it sat on the neighbouring row's tile names,
// so it goes OUTSIDE the board where there is room: beside it, then under it, then over it. Only when the
// board fills the window does it fall back to the side of the tile with more room. Always fully on screen.
// PURE: tests/tile-hover-place.test.ts.

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Size {
  w: number;
  h: number;
}

const GAP = 8;
const MARGIN = 8;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function placeHoverCard(tile: Box, board: Box | null, card: Size, viewport: Size): { left: number; top: number } {
  const maxLeft = viewport.w - card.w - MARGIN;
  const maxTop = viewport.h - card.h - MARGIN;
  const tileMidY = (tile.top + tile.bottom) / 2;
  const tileMidX = (tile.left + tile.right) / 2;
  const fits = (left: number, top: number) => left >= MARGIN && top >= MARGIN && left <= maxLeft && top <= maxTop;
  if (board) {
    const sideTop = clamp(tileMidY - card.h / 2, MARGIN, Math.max(MARGIN, maxTop));
    const right = { left: board.right + GAP, top: sideTop };
    if (fits(right.left, right.top)) return right;
    const left = { left: board.left - GAP - card.w, top: sideTop };
    if (fits(left.left, left.top)) return left;
    const colLeft = clamp(tileMidX - card.w / 2, MARGIN, Math.max(MARGIN, maxLeft));
    const below = { left: colLeft, top: board.bottom + GAP };
    if (fits(below.left, below.top)) return below;
    const above = { left: colLeft, top: board.top - GAP - card.h };
    if (fits(above.left, above.top)) return above;
  }
  // The board fills the window: beside the tile itself, whichever side has more room (covers its neighbour, not the tile).
  const roomRight = viewport.w - tile.right;
  const roomLeft = tile.left;
  const sideLeft = roomRight >= roomLeft ? tile.right + GAP : tile.left - GAP - card.w;
  return {
    left: clamp(sideLeft, MARGIN, Math.max(MARGIN, maxLeft)),
    top: clamp(tileMidY - card.h / 2, MARGIN, Math.max(MARGIN, maxTop)),
  };
}
