import { parseEventRules, visibleTiles } from '@/lib/eventRules';
import { type Action, type Node, col, count, row, text } from './nodes';
import { FAINT, PROGRESS, SOFT, clip, link, section, title } from './sections';

// "Tracked on screen": every tile this client has pinned over the game, on any board it's on. One
// compact card, shown on every board type (race page, bingo, leagues) whenever anything is pinned.

export interface PinRow {
  tileId: number;
  label: string;
  /** The board (event) the tile belongs to. */
  eventId: number;
  /** That board's name when it isn't the one being shown, else null. */
  board: string | null;
  cur: number | null;
  goal: number | null;
  done: boolean;
}

/** The card: name, progress and a ✕ per row; "Untrack all" over this board's pins when there are several. */
export function trackedCard(rows: PinRow[], eventId: number, then: Action): Node | null {
  if (!rows.length) return null;
  const lines = rows.map((p) => {
    const prog = p.done ? text('Done', 'done', { font: 'small' }) : p.goal && p.goal > 1 ? text(`${count(Math.min(p.cur ?? 0, p.goal))} / ${count(p.goal)}`, PROGRESS, { font: 'small', live: { tile: p.tileId, cur: p.cur ?? 0, goal: p.goal, fmt: 'of' } }) : undefined;
    const x = text('✕', SOFT, { chip: '#3a3a3a', font: 'small', w: 18, align: 'c', tip: 'Untrack this tile', on: { a: 'pin', event: p.eventId, tile: p.tileId, on: false, then } });
    const name = col([text(clip(p.label, 22), 'text', { tip: p.label }), ...(p.board ? [text(clip(p.board, 30), FAINT, { font: 'small' })] : [])], { gap: 1 });
    // No blank under the name: progress gets a thin bar
    const body = p.goal && p.goal > 1 && !p.done ? col([name, { t: 'bar', pct: Math.round((Math.min(p.cur ?? 0, p.goal) * 100) / p.goal), color: 'progress', h: 4, bg: 'panel' }], { gap: 3 }) : name;
    // Nothing to show under the name: one tight line, name and ✕, no extra column.
    if (body === name && !prog && !p.board) return row(undefined, text(clip(p.label, 26), 'text', { tip: p.label }), x, { gap: 6, pad: 6, bg: 'raised' });
    return row(undefined, body, row(prog, undefined, x, { gap: 6 }), { gap: 6, pad: 6, bg: 'raised' });
  });
  const here = rows.filter((p) => p.eventId === eventId).length;
  return section([
    row(undefined, title('Tracked on screen'), rows.length > 1 && here > 1 ? link('Untrack all', { a: 'pin', event: eventId, tile: 0, on: false, then }, 'Take every tile pinned on this board off the screen') : undefined),
    ...lines,
  ], { gap: 5 });
}

/**
 * Of tiles looked up by id, the ones the board shows its viewers: its tiles revealed at all, and past
 * the reveal rules (an unannounced mission or a not-yet-drawn tile never gets a label). Pure.
 */
export function revealedTileIds<T extends { id: number; eventId: number }>(found: T[], evs: { id: number; rules: string | null; tilesRevealed: boolean | number | null }[]): Set<number> {
  const shown = new Set<number>();
  for (const ev of evs) {
    if (!ev.tilesRevealed) continue;
    const mine = found.filter((f) => f.eventId === ev.id);
    for (const t of visibleTiles(parseEventRules(ev.rules), mine as never[]) as T[]) shown.add(t.id);
  }
  return shown;
}
