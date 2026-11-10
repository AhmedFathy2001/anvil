// How a race map fits its box (components/board/RaceRouteMap). Pure, so tests/race-map-layout
// runs it directly.
//
// The map's natural shape is steps left to right, roads stacked. That only reads while it stays
// near full size: shrunk past ~85% the tiles, step names and "+" buttons get too small to read or
// tap. Below that it turns: steps run top to bottom and the roads stand side by side as columns,
// each at a readable width, so a phone or a narrow column (devtools, a side panel) still gets
// full-size tiles. Measured on the map's OWN width, never the window's.

/** Horizontal map: the gap between steps, the padding at each end, the road-name gutter. */
export const H_COL = 168;
export const H_PAD = 70;
export const H_LANE = 58;
/** Vertical map: the step-name gutter, the narrowest and widest a road column gets. */
export const V_GUTTER = 62;
export const V_COL_MIN = 96;
export const V_COL_MAX = 150;
/** The smallest the horizontal map may shrink before it turns vertical. */
export const MIN_SCALE = 0.85;

export type RaceMapLayout =
  | { vertical: false; scale: number }
  /** `scrolls`: too many roads for the box even at the narrowest column — the columns scroll sideways. */
  | { vertical: true; colW: number; scrolls: boolean };

/** The horizontal map's natural width for this many steps and roads (the widest step). */
export function naturalWidth(steps: number, roads: number): number {
  return H_PAD + (roads > 1 ? H_LANE : 0) + H_PAD + Math.max(0, steps - 1) * H_COL;
}

/**
 * The layout for a box this wide (px). 0 (not measured yet, or server-rendered) keeps the natural
 * horizontal map. `canTurn` false: shrink only, never vertical (scrolls past MIN_SCALE as before).
 */
export function layoutFor(width: number, steps: number, roads: number, canTurn = true): RaceMapLayout {
  if (width <= 0) return { vertical: false, scale: 1 };
  const room = (width - 8) / naturalWidth(steps, roads);
  if (room >= MIN_SCALE || !canTurn || steps <= 1) return { vertical: false, scale: Math.min(1, Math.max(MIN_SCALE, room)) };
  const fill = (width - 8 - V_GUTTER) / Math.max(1, roads);
  const colW = Math.min(V_COL_MAX, Math.max(V_COL_MIN, Math.floor(fill)));
  return { vertical: true, colW, scrolls: V_GUTTER + roads * colW + 8 > width };
}
