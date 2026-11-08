import { GET as configRoute } from '@/app/api/plugin/config/route';
import type { FactBoard, Tracked } from '@/lib/pluginFacts/match';
import type { RulesConfigIn } from '@/lib/pluginFacts/rules';

/** The parts of the plugin config the rules and the facts endpoint read. */
export type TrackedConfig = Tracked &
  RulesConfigIn & {
    event?: { id: number } | null;
    team?: { id: number } | null;
    player?: { id: number } | null;
  };

/**
 * This caller's config, exactly as the plugin would receive it (multi-board folding included), by
 * calling the config route in-process with the caller's own auth headers. Never conditional: an
 * If-None-Match from the caller must not turn this into an empty 304.
 */
export async function loadTrackedConfig(request: Request): Promise<{ ok: true; cfg: TrackedConfig } | { ok: false; status: number }> {
  const headers = new Headers(request.headers);
  headers.delete('if-none-match');
  const url = new URL('/api/plugin/config', request.url);
  const res = await configRoute(new Request(url, { method: 'GET', headers }));
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, cfg: (await res.json()) as TrackedConfig };
}

/** The board a credit lands on: its own tag, else the config's active event/team/player. */
export function boardFor(cfg: TrackedConfig, board: FactBoard | null | undefined): FactBoard | null {
  if (board) return board;
  if (!cfg.event || !cfg.team || !cfg.player) return null;
  return { eventId: cfg.event.id, teamId: cfg.team.id, playerId: cfg.player.id };
}
