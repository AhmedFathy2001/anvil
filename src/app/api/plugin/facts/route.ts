import { POST as submitRoute } from '@/app/api/events/[eventId]/submissions/route';
import { boardFor, loadTrackedConfig } from '@/lib/pluginFacts/load';
import { coalesce, matchFacts, type Credit } from '@/lib/pluginFacts/match';
import { MAX_FACTS, parseFacts } from '@/lib/pluginFacts/parse';
import { creditOutcome, planSubmissions, retryFacts, type Coop, type Outcome } from '@/lib/pluginFacts/plan';
import { readBody, storeImage } from '@/lib/pluginFacts/request';
import { named } from '@/lib/pluginFacts/rules';
import { LAB_CLAN_SLUG } from '@/lib/labRules';
import { newProofKey } from '@/lib/proofAfter';
import { afterReply, sweepOverdueProofs } from '@/lib/proofFinish';
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
//
// The screenshot can ride along (multipart: `body` = the JSON, `file` = the image) instead of a separate
// POST /api/upload first: one round trip, stored by that same route in-process, and only when a fact
// actually credits something.
//
// CREDIT FIRST, PROOF AFTER (lib/proofAfter). A current plugin sends the screenshot-worthy facts with
// no image and `proofPending: true` (its `proof` meta as before), the moment they happen. Everything
// files as if the picture were there; each submission that would have carried it is marked as
// waiting, and the reply adds `proofKey` (and `proofFor`, those tiles' labels) when at least one was
// filed. The plugin uploads the picture to POST /api/plugin/facts/proof under that key; a credit
// still waiting a minute after filing is reversed (lib/proofFinish sweepOverdueProofs). No stamp and
// no Discord post until the picture lands. Without `proofPending` nothing changes.

export async function POST(request: Request) {
  // Where a proof's seconds go (config build, image store, each filing), logged while we tune it.
  const t0 = Date.now();
  const marks: Record<string, number> = {};
  const mark = (k: string) => (marks[k] = Date.now() - t0);
  const rl = await rateLimit(request, 'plugin-facts', { limit: 240, windowMs: 60_000 });
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 });

  const { body, file } = await readBody(request);
  const facts = parseFacts(body?.facts);
  // Past the per-request cap: not looked at, sent back to try again.
  const overflow = Array.isArray(body?.facts) ? parseFacts((body.facts as unknown[]).slice(MAX_FACTS), Infinity) : [];
  if (facts.length === 0) return Response.json({ credits: [], notes: [], ...(overflow.length ? { retry: overflow } : {}) });

  mark('read');
  const loaded = await loadTrackedConfig(request);
  mark('config');
  if (!loaded.ok) return Response.json({ error: 'No config' }, { status: loaded.status });
  const cfg = loaded.cfg;

  const matched = matchFacts(facts, cfg);
  // A fact that matched nothing on the site (the plugin thought it did): worth a trace while rules settle.
  const hit = new Set(matched.credits.flatMap((c) => c.fi ?? []));
  facts.forEach((f, i) => {
    if (!hit.has(i)) console.warn('[plugin/facts] unmatched', { k: f.k, t: (f as { t?: number }).t ?? null });
  });
  const credits = coalesce(matched.credits);
  let img = typeof body?.img === 'string' && body.img.length <= 512 ? body.img : null;
  // The picture follows: only when none came with this request (an older plugin's shapes win).
  const pendingKey = body?.proofPending === true && !file && !img && credits.length ? newProofKey() : null;
  if (file && !img && credits.length) {
    // A passing failure answers 503, so the plugin keeps the proof and sends it again.
    const stored = await storeImage(request, file);
    if ('error' in stored) return Response.json({ error: stored.error }, { status: stored.status });
    img = stored.url;
    mark('image');
  }
  const proof = body?.proof && typeof body.proof === 'object' ? (body.proof as Record<string, unknown>) : null;
  const coop = body?.coop && typeof body.coop === 'object' ? (body.coop as Coop) : null;
  const units = new Map((cfg.trackedKills ?? []).map((k) => [k.tileId, k.unit?.trim() || 'kill']));
  const plans = planSubmissions(credits, (c: Credit) => boardFor(cfg, c.board), img, proof, coop, units, pendingKey);

  // One at a time, and a bounded number per request: same-tile credits must land in order (the
  // completion check reads the previous one), and one request must not fan out without limit.
  // After the first passing failure (the database is likely down) the rest are not tried: they retry.
  const results: { tileId: number; ok: boolean; completed: boolean; error?: string }[] = [];
  const outcomes = new Map<Credit, Outcome[]>();
  let failing = false;
  // The tiles whose filed submission now waits for the picture (named in the reply).
  const waiting = new Set<string>();
  for (const [n, p] of plans.entries()) {
    let outcome: Outcome = 'retry';
    if (n < MAX_SUBMISSIONS && !failing) {
      try {
        const headers = new Headers(request.headers);
        headers.set('content-type', 'application/json');
        headers.delete('content-length');
        // Address the board's own clan — except the hidden lab clan, which holds no seats: the token
        // would resolve no member there and every lab credit came back 401. A lab board is reached
        // from the caller's own address instead (lib/eventScope labEventForPluginRequest).
        if (p.board.clan && p.board.clan !== LAB_CLAN_SLUG) headers.set('x-anvil-clan-slug', p.board.clan);
        const url = new URL(`/api/events/${p.board.eventId}/submissions`, request.url);
        const res = await submitRoute(new Request(url, { method: 'POST', headers, body: JSON.stringify(p.body) }), {
          params: Promise.resolve({ eventId: String(p.board.eventId) }),
        });
        const json = (await res.json().catch(() => ({}))) as { completed?: boolean; error?: string; awaitingProof?: boolean };
        // Only a row actually stored with the key waits (a replay outside the lab answers ok, files nothing).
        if (res.ok && pendingKey && json.awaitingProof) waiting.add(p.credit.label);
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
    mark(`file${n}`);
  }
  console.info('[plugin/facts] timing', { ms: Date.now() - t0, ...marks, facts: facts.length, filings: plans.length });
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
  for (const c of credits) if (c.kind === 'tile' && (img || pendingKey) && byTile.get(c.tileId)?.ok) notes.push(`Submitted: ${c.label}`);
  // Credits whose picture never came, reversed on the way out (the lifecycle tick does it too).
  afterReply(() => sweepOverdueProofs(Date.now(), 10));
  return Response.json({
    // A replayed older proof on a drop/kill/value tile has no count of the plugin's rule to correct.
    credits: credits.filter((c) => !(c.kind === 'tile' && (c.tileKind === 'drop' || c.tileKind === 'kill' || c.tileKind === 'value'))).map((c) => ({
      t: c.tileId,
      kind: c.kind,
      // Another board's tile says which board ("Wintertodt crate · Chat Test"): the plugin's "Tile
      // complete" line is this label, and two boards can share a tile name.
      label: named(c),
      amount: c.amount,
      // A refused credit never counted: the count from before it, not the one it would have made.
      have: byTile.get(c.tileId)?.ok === false && byTile.get(c.tileId)?.error !== 'Will retry' ? Math.max(0, c.have - c.amount) : c.have,
      of: c.of,
      ...(c.quiet ? { quiet: true } : {}),
      ...byTile.get(c.tileId),
    })),
    notes,
    ...(retry.length ? { retry } : {}),
    ...(waiting.size ? { proofKey: pendingKey, proofFor: [...waiting] } : {}),
  });
}
