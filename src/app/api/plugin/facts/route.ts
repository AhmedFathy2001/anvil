import { POST as submitRoute } from '@/app/api/events/[eventId]/submissions/route';
import { boardFor, loadTrackedConfig } from '@/lib/pluginFacts/load';
import { coalesce, matchFacts, type Credit } from '@/lib/pluginFacts/match';
import { parseFacts } from '@/lib/pluginFacts/parse';
import { planSubmissions, type Coop } from '@/lib/pluginFacts/plan';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_SUBMISSIONS = 40;

// POST /api/plugin/facts — what a `rules` plugin saw (loot, hauls, kills, and `tile` facts for the
// tiles it judges itself: timed, deathless, LMS, PvP, diary, combat task, clog, gain), for the site to credit.
// The plugin no longer picks tiles: lib/pluginFacts/match decides, and every credit goes through the
// submissions route exactly as the plugin's own POST used to, so caps, completions, the live push and
// staff review are unchanged. The reply carries each touched tile's corrected count, which the
// client adopts over its instant local guess.

export async function POST(request: Request) {
  const rl = await rateLimit(request, 'plugin-facts', { limit: 240, windowMs: 60_000 });
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const facts = parseFacts(body?.facts);
  if (facts.length === 0) return Response.json({ credits: [], notes: [] });

  const loaded = await loadTrackedConfig(request);
  if (!loaded.ok) return Response.json({ error: 'No config' }, { status: loaded.status });
  const cfg = loaded.cfg;

  const matched = matchFacts(facts, cfg);
  const credits = coalesce(matched.credits);
  const img = typeof body?.img === 'string' && body.img.length <= 512 ? body.img : null;
  const proof = body?.proof && typeof body.proof === 'object' ? (body.proof as Record<string, unknown>) : null;
  const coop = body?.coop && typeof body.coop === 'object' ? (body.coop as Coop) : null;
  const units = new Map((cfg.trackedKills ?? []).map((k) => [k.tileId, k.unit?.trim() || 'kill']));
  const plans = planSubmissions(credits, (c: Credit) => boardFor(cfg, c.board), img, proof, coop, units);

  // One at a time, and a bounded number per request: same-tile credits must land in order (the
  // completion check reads the previous one), and one request must not fan out without limit.
  const results: { tileId: number; ok: boolean; completed: boolean; error?: string }[] = [];
  for (const p of plans.slice(0, MAX_SUBMISSIONS)) {
    results.push(await (async () => {
      const headers = new Headers(request.headers);
      headers.set('content-type', 'application/json');
      headers.delete('content-length');
      if (p.board.clan) headers.set('x-anvil-clan-slug', p.board.clan);
      const url = new URL(`/api/events/${p.board.eventId}/submissions`, request.url);
      const res = await submitRoute(new Request(url, { method: 'POST', headers, body: JSON.stringify(p.body) }), {
        params: Promise.resolve({ eventId: String(p.board.eventId) }),
      });
      const json = (await res.json().catch(() => ({}))) as { completed?: boolean; error?: string };
      return { tileId: p.credit.tileId, ok: res.ok, completed: !!json.completed, error: res.ok ? undefined : json.error };
    })());
  }

  const byTile = new Map<number, { ok: boolean; completed: boolean; error?: string }>();
  for (const r of results) {
    const had = byTile.get(r.tileId);
    byTile.set(r.tileId, {
      ok: (had?.ok ?? true) && r.ok,
      completed: (had?.completed ?? false) || r.completed,
      error: had?.error ?? r.error,
    });
  }
  // A proof the plugin filed for one tile used to end on "Submitted: <tile>"; it is said from here now.
  const notes = [...matched.notes];
  for (const c of credits) if (c.kind === 'tile' && img && byTile.get(c.tileId)?.ok) notes.push(`Submitted: ${c.label}`);
  return Response.json({
    // A replayed older proof on a drop/kill/value tile has no count of the plugin's rule to correct.
    credits: credits.filter((c) => !(c.kind === 'tile' && (c.tileKind === 'drop' || c.tileKind === 'kill' || c.tileKind === 'value'))).map((c) => ({
      t: c.tileId,
      kind: c.kind,
      label: c.label,
      amount: c.amount,
      have: c.have,
      of: c.of,
      ...(c.quiet ? { quiet: true } : {}),
      ...byTile.get(c.tileId),
    })),
    notes,
  });
}
