// The in-game lines for a reveal (lib/revealPush): tiles opening on a showdown / lucky draw / bounty
// board, and missions going live. Pure — no database — so the wording and the visibility gate are
// tested on their own. The plugin prints each line as it comes ("[Anvil] …"); all wording lives here.

import { isMissionTile, missionClaimCap, parseEventRules, parseTileMissionRules, visibleTiles } from '@/lib/eventRules';

export interface RevealedTile {
  id: number;
  label: string;
  points: number;
  mission: number | boolean | null;
  rules: string | null;
  revealedAt: string | null;
  closedAt: string | null;
  parentTileId?: number | null;
}

/**
 * Of the tiles a reveal just flipped, the ones a board's players may now see: nothing while the host
 * keeps the whole board hidden (tilesRevealed), else the board's reveal rules (lib/eventRules
 * visibleTiles — an unannounced mission never passes), and never one already closed or a combo's part.
 * The same gate every player-facing read uses (lib/tilesForViewer); visibility is per board, not team.
 */
export function playerVisibleReveals<T extends RevealedTile>(
  event: { tilesRevealed: number | boolean | null; rules: string | null },
  flipped: T[],
): T[] {
  if (!event.tilesRevealed) return [];
  return visibleTiles(parseEventRules(event.rules), flipped).filter(
    (t) => t.revealedAt != null && t.closedAt == null && t.parentTileId == null,
  );
}

/** 0.5h → "30m", 2h → "2h", 1.5h → "1h 30m", 72h → "3d". */
export function shortDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min}m`;
  if (min < 48 * 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(min / 1440)}d`;
}

const MAX_LINE = 150;

/** "A, B, C" — as many names as fit on one chat line, then "+2 more". */
function nameList(labels: string[], room: number): string {
  let out = '';
  for (let i = 0; i < labels.length; i++) {
    const next = out ? `${out}, ${labels[i]}` : labels[i];
    const rest = labels.length - i - 1;
    if (out && next.length + (rest ? ` +${rest} more`.length : 0) > room) return `${out} +${labels.length - i} more`;
    out = next;
  }
  return out;
}

function missionTail(t: RevealedTile, nowMs: number): string {
  const m = parseTileMissionRules(t.rules);
  const parts: string[] = [];
  if (missionClaimCap(m) === 1) parts.push('first team takes it');
  if (m.expiryHours != null && t.revealedAt) {
    const left = Date.parse(t.revealedAt) + m.expiryHours * 3_600_000 - nowMs;
    if (Number.isFinite(left) && left > 0) parts.push(`ends in ${shortDuration(left)}`);
  }
  return parts.length ? ` — ${parts.join(', ')}` : '';
}

/**
 * One reveal's lines for one board: a single tile or mission gets its own line, several at once
 * collapse into one ("3 new tiles on Lab session #14: A, B, C"). Tiles first, then missions.
 */
export function revealLines(board: string, tiles: RevealedTile[], pointsMode: boolean, nowMs: number): string[] {
  const lines: string[] = [];
  const plain = tiles.filter((t) => !isMissionTile(t));
  const missions = tiles.filter(isMissionTile);
  const pts = (t: RevealedTile) => (pointsMode ? ` (${t.points} pt${t.points === 1 ? '' : 's'})` : '');
  if (plain.length === 1) lines.push(`New tile: ${plain[0].label} · ${board}${pts(plain[0])}`);
  else if (plain.length > 1) {
    const head = `${plain.length} new tiles on ${board}: `;
    lines.push(head + nameList(plain.map((t) => t.label), MAX_LINE - head.length));
  }
  if (missions.length === 1) lines.push(`Mission live: ${missions[0].label} · ${board}${missionTail(missions[0], nowMs)}`);
  else if (missions.length > 1) {
    const head = `${missions.length} missions live on ${board}: `;
    lines.push(head + nameList(missions.map((t) => t.label), MAX_LINE - head.length));
  }
  return lines;
}
