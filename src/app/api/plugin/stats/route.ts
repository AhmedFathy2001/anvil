import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, tiles, teams, events, completions } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { verifyPluginToken } from '@/lib/auth';
import { statKeys } from '@/lib/tileKinds';
import { bossKeyForName, parsePluginStats } from '@/lib/pluginStats';
import { notifyTileCompletion } from '@/lib/discord';

// Real-time boss-KC ingest. The plugin posts {stats:[{name,kc}]} with ABSOLUTE counts (no image)
// for bosses the event tracks; the event/team/player are resolved from the account-token auth, so a
// caller can only report its own KC. We store the max per key in players.plugin_stats (kept apart
// from the hiscores snapshot so the cron never clobbers it), then re-check the affected boss-KC
// tiles so they complete immediately instead of waiting on the ~1h hiscores lag. The cron folds the
// same max into its gains and prunes a plugin entry once hiscores catches up. See lib/pluginStats.

// Absolute-KC sanity ceiling — reject obviously bogus pushes. No legit boss KC approaches this.
const MAX_KC = 1_000_000;

// Read a boss score for one hiscores key out of a stored hiscores JSON blob (-1 unranked -> 0).
function bossScore(json: string | null, key: string): number {
  if (!json) return 0;
  try {
    const parsed = JSON.parse(json) as { bosses?: Record<string, { score?: number }> };
    const s = parsed.bosses?.[key]?.score ?? 0;
    return s < 0 ? 0 : s;
  } catch {
    return 0;
  }
}

export async function POST(request: Request) {
  const auth = await verifyPluginToken(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <accountToken>' }, { status: 401 });
  }

  let body: { stats?: Array<{ name?: string; kc?: number }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const incoming = Array.isArray(body?.stats) ? body.stats : [];
  if (incoming.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const player = await db.query.players.findFirst({ where: eq(players.id, auth.playerId) });
  if (!player || player.teamId !== auth.teamId) {
    return NextResponse.json({ error: 'Player is not on the authed team' }, { status: 403 });
  }

  // Map each pushed in-game name -> hiscores key, keeping the max absolute count per key.
  const pushed: Record<string, number> = {};
  for (const s of incoming) {
    if (!s || typeof s.name !== 'string' || typeof s.kc !== 'number') continue;
    if (!Number.isFinite(s.kc) || s.kc < 0 || s.kc > MAX_KC) continue;
    const key = bossKeyForName(s.name);
    if (!key) continue;
    pushed[key] = Math.max(pushed[key] ?? 0, Math.floor(s.kc));
  }
  if (Object.keys(pushed).length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  // Merge into stored plugin_stats — absolute counts only ever rise, so keep the max per key.
  const stored = parsePluginStats(player.pluginStats);
  let changed = false;
  for (const [key, kc] of Object.entries(pushed)) {
    if (kc > (stored[key] ?? 0)) {
      stored[key] = kc;
      changed = true;
    }
  }
  if (changed) {
    await db.update(players).set({ pluginStats: JSON.stringify(stored) }).where(eq(players.id, player.id));
  }

  // Re-evaluate boss-KC tiles tracking any updated key so a real-time clear completes now.
  const updatedKeys = new Set(Object.keys(pushed));
  const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, auth.eventId));
  const statTiles = eventTiles.filter(
    (t) =>
      t.trackedStat &&
      (t.statType === 'boss' || t.statType === 'kc') &&
      t.statGoal &&
      // Admin flipped this tile to manual — don't auto-credit from plugin-pushed stats.
      !t.autoTrackDisabled &&
      statKeys(t.trackedStat).some((k) => updatedKeys.has(k)),
  );
  if (statTiles.length === 0) {
    return NextResponse.json({ ok: true, updated: Object.keys(pushed).length, completed: [] });
  }

  const teamPlayers = await db
    .select()
    .from(players)
    .where(and(eq(players.eventId, auth.eventId), eq(players.teamId, auth.teamId)));
  const tileIds = eventTiles.map((t) => t.id);
  const existing = tileIds.length
    ? await db.select().from(completions).where(inArray(completions.tileId, tileIds))
    : [];
  const done = new Set(existing.map((c) => `${c.teamId}-${c.tileId}`));

  const event = await db.query.events.findFirst({ where: eq(events.id, auth.eventId) });
  const team = await db.query.teams.findFirst({ where: eq(teams.id, auth.teamId) });

  // A player's gain for a (possibly composite) stat = sum over keys of max(0, effective - baseline),
  // where effective current = max(hiscores, plugin-pushed). Mirrors the cron / gains route.
  const gainFor = (p: (typeof teamPlayers)[number], keys: string[]): number => {
    const plug = parsePluginStats(p.pluginStats);
    let g = 0;
    for (const k of keys) {
      const baseline = bossScore(p.statsSnapshot, k);
      const current = Math.max(bossScore(p.cachedStats, k), plug[k] ?? 0);
      g += Math.max(0, current - baseline);
    }
    return g;
  };

  const completed: string[] = [];
  for (const tile of statTiles) {
    const compKey = `${auth.teamId}-${tile.id}`;
    if (done.has(compKey)) continue;
    const keys = statKeys(tile.trackedStat);
    const meets =
      tile.trackingMode === 'individual'
        ? teamPlayers.some((p) => gainFor(p, keys) >= tile.statGoal!)
        : teamPlayers.reduce((sum, p) => sum + gainFor(p, keys), 0) >= tile.statGoal!;
    if (!meets) continue;

    await db.insert(completions).values({ teamId: auth.teamId, tileId: tile.id }).onConflictDoNothing();
    done.add(compKey);
    completed.push(tile.label);
    if (event && team) {
      notifyTileCompletion({
        eventName: event.name,
        tileLabel: tile.label,
        teamName: team.name,
        teamColor: team.color,
        tileType: tile.tileType,
        trackedStat: tile.trackedStat,
        statType: tile.statType,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, updated: Object.keys(pushed).length, completed });
}
