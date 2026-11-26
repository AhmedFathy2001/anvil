import { POST as submitRoute } from '@/app/api/events/[eventId]/submissions/route';
import { boardFor, loadTrackedConfig } from '@/lib/pluginFacts/load';
import { coalesce, matchFacts, type Credit } from '@/lib/pluginFacts/match';
import { MAX_FACTS, parseFacts } from '@/lib/pluginFacts/parse';
import { decideFactClaim, settledIds, splitDuplicates } from '@/lib/pluginFacts/factIds';
import { factOwner, settledFactIds, settleFacts, tileFactIds } from '@/lib/pluginFacts/factIdStore';
import { creditOutcome, planSubmissions, retryFacts, type Coop, type Outcome } from '@/lib/pluginFacts/plan';
import { readBody, storeImage } from '@/lib/pluginFacts/request';
import { markJudged } from '@/lib/pluginFacts/judged';
import { named } from '@/lib/pluginFacts/rules';
import { LAB_CLAN_SLUG } from '@/lib/labRules';
import { newProofKey } from '@/lib/proofAfter';
import { afterReply, sweepOverdueProofs } from '@/lib/proofFinish';
import { rateLimit } from '@/lib/rate-limit';
import { setProvenClan } from '@/lib/requestHeaderProof';
import { resolvePluginMember } from '@/lib/auth';
import { creditRushKills } from '@/lib/itemHuntDb';
import { worldModeOf } from '@/lib/worldModeRequest';

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
//
// FACT IDS (lib/pluginFacts/factIds). A fact may carry `id`, made once by the plugin and sent again
// unchanged, so a fact whose first send may or may not have landed can simply be sent again. One
// already answered is set aside here before matching; one whose credit on a tile is already in is
// answered by the submissions route as accepted and files nothing (the id is taken in the same
// transaction as the credit). Either way it is never under `retry`, and `duplicates` counts them.
// A fact sent back under `retry` keeps its `id` and is not remembered. No id: exactly as before.

export async function POST(request: Request) {
  // Where a proof's seconds go (config build, image store, each filing), logged while we tune it.
  const t0 = Date.now();
  const marks: Record<string, number> = {};
  const mark = (k: string) => (marks[k] = Date.now() - t0);
  const rl = await rateLimit(request, 'plugin-facts', { limit: 240, windowMs: 60_000 });
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 });

  const { body, file } = await readBody(request);
  const sent = parseFacts(body?.facts);
  // Past the per-request cap: not looked at, sent back to try again.
  const overflow = Array.isArray(body?.facts) ? parseFacts((body.facts as unknown[]).slice(MAX_FACTS), Infinity) : [];
  // Facts already answered for good are set aside: never matched, never filed, never sent back.
  // Failing to read the store only skips this shortcut; the credit's own transaction still guards.
  const sentIds = sent.flatMap((f) => f.id ?? []);
  const owner = sentIds.length ? await factOwner(request) : null;
  const settled = owner ? await settledFactIds(owner, sentIds).catch(() => new Set<string>()) : new Set<string>();
  const { fresh: facts, duplicateIds } = splitDuplicates(sent, settled);
  const duplicate = new Set(duplicateIds);
  // A running Boss Rush counts kill facts first, board or no board (lib/itemHuntDb creditRushKills):
  // each fact once per rush, by its id. A failure here never stands in the way of a board's credit.
  const rushHit = new Set<number>();
  const kills = facts.flatMap((f, i) => (f.k === 'kill' ? [{ i, fact: { id: f.id, n: f.n } }] : []));
  if (kills.length) {
    const member = await resolvePluginMember(request).catch(() => null);
    if (member) {
      const rushOwner = owner ?? { userId: member.userId, accountId: member.accountId };
      const done = await creditRushKills(member, rushOwner, member.clanId, kills.map((k) => k.fact), new Date(), worldModeOf(request)?.key ?? null).catch((err) => {
        console.warn('[plugin/facts] rush credit failed', err);
        return { credited: 0, factIndexes: [] as number[] };
      });
      for (const j of done.factIndexes) rushHit.add(kills[j].i);
    }
  }
  if (facts.length === 0) {
    return Response.json({ credits: [], notes: [], ...(overflow.length ? { retry: overflow } : {}), ...(duplicate.size ? { duplicates: duplicate.size } : {}) });
  }

  mark('read');
  const loaded = await loadTrackedConfig(request);
  mark('config');
  if (!loaded.ok) return Response.json({ error: 'No config' }, { status: loaded.status });
  const cfg = loaded.cfg;

  const matched = matchFacts(facts, cfg);
  // A fact that matched nothing on the site (the plugin thought it did): worth a trace while rules settle.
  const hit = new Set(matched.credits.flatMap((c) => c.fi ?? []));
  facts.forEach((f, i) => {
    if (!hit.has(i) && !rushHit.has(i)) console.warn('[plugin/facts] unmatched', { k: f.k, t: (f as { t?: number }).t ?? null });
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
  // Fact ids: the (id, tile) pairs filed by this request, the credits answered as already in, and the
  // tiles a sent-back fact is already in on (found only when its filing was turned away).
  const filed = new Set<string>();
  const replayed = new Set<Credit>();
  const alreadyOn = new Map<string, Set<number>>();
  for (const [n, p] of plans.entries()) {
    let outcome: Outcome = 'retry';
    // A pair rides the first filing for it only: a second ping, or a second item on the same tile,
    // is the same fact's same credit and must not be turned away by its own id.
    const factIds = [...new Set((p.credit.fi ?? []).flatMap((i) => facts[i].id ?? []))].filter((id) => !filed.has(`${id}:${p.credit.tileId}`));
    if (n < MAX_SUBMISSIONS && !failing) {
      try {
        const headers = new Headers(request.headers);
        headers.set('content-type', 'application/json');
        headers.delete('content-length');
        // Address the board's own clan — except the hidden lab clan, which holds no seats: the token
        // would resolve no member there and every lab credit came back 401. A lab board is reached
        // from the caller's own address instead (lib/eventScope labEventForPluginRequest).
        // Signed like middleware's own: lib/clanContext only reads a proven slug.
        if (p.board.clan && p.board.clan !== LAB_CLAN_SLUG) await setProvenClan(headers, p.board.clan);
        const url = new URL(`/api/events/${p.board.eventId}/submissions`, request.url);
        // Marked as site-judged only when match checked the tile's conditions (lib/pluginFacts/judged).
        const req = new Request(url, { method: 'POST', headers, body: JSON.stringify(factIds.length ? { ...p.body, factIds } : p.body) });
        const res = await submitRoute(p.credit.judged ? markJudged(req) : req, {
          params: Promise.resolve({ eventId: String(p.board.eventId) }),
        });
        const json = (await res.json().catch(() => ({}))) as { completed?: boolean; error?: string; awaitingProof?: boolean; duplicate?: boolean; factsSeen?: string[] };
        // Only a row actually stored with the key waits (a replay outside the lab answers ok, files nothing).
        if (res.ok && pendingKey && json.awaitingProof) waiting.add(p.credit.label);
        outcome = res.ok ? 'ok' : res.status >= 500 || res.status === 429 ? 'retry' : 'refused';
        if (res.ok && !json.duplicate) for (const id of factIds) filed.add(`${id}:${p.credit.tileId}`);
        let again = res.ok && json.duplicate === true;
        if (res.status === 409 && Array.isArray(json.factsSeen)) {
          // Several facts folded into one credit, some already in: sent back, those marked done here.
          outcome = 'retry';
          for (const id of json.factsSeen) alreadyOn.set(id, (alreadyOn.get(id) ?? new Set()).add(p.credit.tileId));
        } else if (outcome === 'refused' && owner && factIds.length) {
          // Turned away by a rule the first send itself tripped ("Tile already complete"): if every
          // one of its facts is in on this tile, this is that send again, not a refusal.
          const seen = await tileFactIds(owner, factIds, p.credit.tileId).catch(() => new Set<string>());
          again = decideFactClaim(factIds.length, seen.size) === 'duplicate';
          if (again) outcome = 'ok';
        }
        if (again) {
          replayed.add(p.credit);
          for (const i of p.credit.fi ?? []) if (facts[i].id) duplicate.add(facts[i].id!);
          results.push({ tileId: p.credit.tileId, ok: true, completed: false });
        } else if (outcome !== 'retry') results.push({ tileId: p.credit.tileId, ok: res.ok, completed: !!json.completed, error: res.ok ? undefined : json.error });
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
    ...retryFacts(facts, credits, (c) => (outcomes.has(c) ? creditOutcome(outcomes.get(c)!) : undefined)).map((f) => {
      const on = f.id ? alreadyOn.get(f.id) : undefined;
      return on ? { ...f, done: [...new Set([...(f.done ?? []), ...on])] } : f;
    }),
    ...overflow,
  ];
  // Answered for good (credited, refused for good, or nothing to credit): remembered, so a later send
  // is set aside up front. Never a fact that is being sent back. Best effort: each credit's own id is
  // already stored with it, so losing this costs a replay some work, never a second credit.
  if (owner) await settleFacts(owner, settledIds(facts, retry)).catch((e) => console.warn('[plugin/facts] ids not settled', (e as Error).message));

  const parts = new Set<number>();
  for (const [key, list] of Object.entries(cfg as unknown as Record<string, unknown>)) {
    if (!key.startsWith('tracked') || !Array.isArray(list)) continue;
    for (const e of list as { tileId?: number; partOf?: number | null }[]) if (e.partOf != null && e.tileId != null) parts.add(e.tileId);
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
  for (const c of credits) if (c.kind === 'tile' && (img || pendingKey) && byTile.get(c.tileId)?.ok) notes.push(`Submitted: ${c.label}`);
  // A raid tile is judged here (lib/tileConditions), so the plugin says nothing of its own: its
  // progress line is said from here, once the credit is actually in.
  for (const c of credits) {
    if (c.kind !== 'raid' || replayed.has(c) || !byTile.get(c.tileId)?.ok) continue;
    notes.push(`Tile progress: ${named(c)} (${Math.min(c.have, c.of)}/${c.of})`);
  }
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
      // Nor did one that was already in: the count the plugin was given already holds it.
      have: replayed.has(c) || (byTile.get(c.tileId)?.ok === false && byTile.get(c.tileId)?.error !== 'Will retry') ? Math.max(0, c.have - c.amount) : c.have,
      of: c.of,
      ...(c.quiet ? { quiet: true } : {}),
      ...byTile.get(c.tileId),
      // A combo's part is not a tile of its own: the combo is announced, from the next config.
      ...(parts.has(c.tileId) ? { completed: false } : {}),
    })),
    notes,
    ...(retry.length ? { retry } : {}),
    ...(duplicate.size ? { duplicates: duplicate.size } : {}),
    ...(waiting.size ? { proofKey: pendingKey, proofFor: [...waiting] } : {}),
  });
}
