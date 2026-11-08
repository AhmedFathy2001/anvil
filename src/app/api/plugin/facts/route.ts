import { POST as submitRoute } from '@/app/api/events/[eventId]/submissions/route';
import { boardFor, loadTrackedConfig } from '@/lib/pluginFacts/load';
import { coalesce, matchFacts, type Credit } from '@/lib/pluginFacts/match';
import { MAX_FACTS, parseFacts } from '@/lib/pluginFacts/parse';
import { creditOutcome, planSubmissions, retryFacts, type Coop, type Outcome } from '@/lib/pluginFacts/plan';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_SUBMISSIONS = 40;

// POST /api/plugin/facts — what a `rules` plugin saw (loot, hauls, kills, and `tile` facts for the
// tiles it judges itself: timed, deathless, LMS, PvP, diary, combat task, clog, gain), for the site to credit.
// The plugin no longer picks tiles: lib/pluginFacts/match decides, and every credit goes through the
// submissions route exactly as the plugin's own POST used to, so caps, completions, the live push and
// staff review are unchanged. The reply carries each touched tile's corrected count, which the
// client adopts over its instant local guess.
//
// A credit whose filing failed for a passing reason (a 5xx, a throw, a rate limit, or past this
// request's cap) is not lost: its facts come back in `retry`, with the tiles they did land on in
// `done`, and the plugin keeps the proof (or the queued facts) and sends exactly those again.

export async function POST(request: Request) {
  const rl = await rateLimit(request, 'plugin-facts', { limit: 240, windowMs: 60_000 });
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const facts = parseFacts(body?.facts);
  // Past the per-request cap: not looked at, sent back to try again.
  const overflow = Array.isArray(body?.facts) ? parseFacts((body.facts as unknown[]).slice(MAX_FACTS), Infinity) : [];
  if (facts.length === 0) return Response.json({ credits: [], notes: [], ...(overflow.length ? { retry: overflow } : {}) });

  const loaded = await loadTrackedConfig(request);
  if (!loaded.ok) return Response.json({ error: 'No config' }, { status: loaded.status });
  const cfg = loaded.cfg;

  const matched = matchFacts(facts, cfg);
  // A fact that matched nothing on the site (the plugin thought it did): worth a trace while rules settle.
  const hit = new Set(matched.credits.flatMap((c) => c.fi ?? []));
  facts.forEach((f, i) => {
    if (!hit.has(i)) console.warn('[plugin/facts] unmatched', { k: f.k, t: (f as { t?: number }).t ?? null });
  });
  const credits = coalesce(matched.credits);
  const img = typeof body?.img === 'string' && body.img.length <= 512 ? body.img : null;
  const proof = body?.proof && typeof body.proof === 'object' ? (body.proof as Record<string, unknown>) : null;
  const coop = body?.coop && typeof body.coop === 'object' ? (body.coop as Coop) : null;
  const units = new Map((cfg.trackedKills ?? []).map((k) => [k.tileId, k.unit?.trim() || 'kill']));
  const plans = planSubmissions(credits, (c: Credit) => boardFor(cfg, c.board), img, proof, coop, units);

  // One at a time, and a bounded number per request: same-tile credits must land in order (the
  // completion check reads the previous one), and one request must not fan out without limit.
  // After the first passing failure (the database is likely down) the rest are not tried: they retry.
  const results: { tileId: number; ok: boolean; completed: boolean; error?: string }[] = [];
  const outcomes = new Map<Credit, Outcome[]>();
  let failing = false;
  for (const [n, p] of plans.entries()) {
    let outcome: Outcome = 'retry';
    if (n < MAX_SUBMISSIONS && !failing) {
      try {
        const headers = new Headers(request.headers);
        headers.set('content-type', 'application/json');
        headers.delete('content-length');
        if (p.board.clan) headers.set('x-anvil-clan-slug', p.board.clan);
        const url = new URL(`/api/events/${p.board.eventId}/submissions`, request.url);
        const res = await submitRoute(new Request(url, { method: 'POST', headers, body: JSON.stringify(p.body) }), {
          params: Promise.resolve({ eventId: String(p.board.eventId) }),
        });
        const json = (await res.json().catch(() => ({}))) as { completed?: boolean; error?: string };
        outcome = res.ok ? 'ok' : res.status >= 500 || res.status === 429 ? 'retry' : 'refused';
        if (outcome !== 'retry') results.push({ tileId: p.credit.tileId, ok: res.ok, completed: !!json.completed, error: res.ok ? undefined : json.error });
        // A refusal used to vanish: the plugin had already said the line. Leave a trace to debug it by.
        if (outcome === 'refused') console.warn('[plugin/facts] refused', { event: p.board.eventId, tile: p.credit.tileId, kind: p.credit.kind, status: res.status, error: json.error });
      } catch (e) {
        console.error('[plugin/facts] filing failed', e);
      }
    }
    if (outcome === 'retry') {
      failing = true;
      results.push({ tileId: p.credit.tileId, ok: false, completed: false, error: 'Will retry' });
    }
    outcomes.set(p.credit, [...(outcomes.get(p.credit) ?? []), outcome]);
  }
  const retry = [
    ...retryFacts(facts, credits, (c) => (outcomes.has(c) ? creditOutcome(outcomes.get(c)!) : undefined)),
    ...overflow,
  ];

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
    ...(retry.length ? { retry } : {}),
  });
}
