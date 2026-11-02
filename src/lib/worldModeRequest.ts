import { NextResponse } from 'next/server';

import { resolveWorldMode, worldModeDef, type WorldMode } from '@/lib/worldModes';

/**
 * The game mode a plugin request was made from (lib/worldModes), or null for the main game.
 *
 * A notification carries its own copy (`world` in the body) — the plugin freezes it in when the post
 * is made, so one resent from its outbox later isn't filed under whatever world the player is on by
 * then — and that copy wins. Everything else reads the X-World-* headers the plugin stamps on every
 * request. A plugin that predates both only ever said `seasonal: true`, which was always Leagues.
 */
export function worldModeOf(
  request: Request,
  body?: { world?: unknown; seasonal?: unknown } | null,
): WorldMode | null {
  const world = body?.world;
  if (world && typeof world === 'object') {
    const w = world as { types?: unknown; activity?: unknown };
    return resolveWorldMode(w.types, w.activity);
  }
  const types = request.headers.get('X-World-Types');
  if (types) return resolveWorldMode(types, request.headers.get('X-World-Activity'));
  if (body?.seasonal === true) {
    const leagues = worldModeDef('leagues')!;
    return { key: leagues.key, label: leagues.label, icon: leagues.icon, known: true };
  }
  return null;
}

/**
 * For routes that CREDIT something — a tile, a competition, the live-stats overlay, a profile.
 * A separate-save world's kills, drops, XP and collection log are not the player's main-game
 * progression, so they're accepted and dropped: 202 with the reason, so the plugin neither retries
 * nor shows an error, and a person debugging sees why nothing moved. `counted` is a board's opt-in
 * (rules.worldModes): those modes count like the main game.
 */
export function worldModeIgnored(request: Request, counted: readonly string[] = []): NextResponse | null {
  const mode = worldModeOf(request);
  if (!mode || counted.includes(mode.key)) return null;
  return NextResponse.json({ ok: true, ignored: 'world-mode', mode: mode.label }, { status: 202 });
}
